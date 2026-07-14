import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import type { CreateOrderInput, OrderDTO } from '@platform/shared';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';
import { io } from '../sockets/index.js';

const D = Prisma.Decimal;

/** Cijena nakon popusta — ista logika mora biti i na javnoj menu stranici. */
export function finalPrice(price: Prisma.Decimal, discountPercent: number | null): Prisma.Decimal {
  if (!discountPercent) return price;
  return price.mul(100 - discountPercent).div(100).toDecimalPlaces(2);
}

export function toOrderDTO(order: {
  id: number;
  publicId: string;
  venueId: number;
  tableNumber: string;
  note: string | null;
  status: string;
  total: Prisma.Decimal;
  createdAt: Date;
  items: { nameSnapshot: string; quantity: number; unitPriceSnapshot: Prisma.Decimal; lineTotal: Prisma.Decimal }[];
}): OrderDTO {
  return {
    id: order.id,
    publicId: order.publicId,
    venueId: order.venueId,
    tableNumber: order.tableNumber,
    note: order.note,
    status: order.status as OrderDTO['status'],
    total: order.total.toFixed(2),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({
      name: i.nameSnapshot,
      quantity: i.quantity,
      unitPrice: i.unitPriceSnapshot.toFixed(2),
      lineTotal: i.lineTotal.toFixed(2),
    })),
  };
}

/**
 * Kreira narudžbu za venue (po slug-u). Total se računa ISKLJUČIVO iz DB cijena —
 * klijentskim iznosima se nikad ne vjeruje. Validira da svi artikli pripadaju
 * aktivnom meniju tog objekta i da su dostupni.
 */
export async function createOrder(venueSlug: string, input: CreateOrderInput) {
  const venue = await prisma.venue.findUnique({
    where: { slug: venueSlug },
    select: { id: true, isActive: true, wheelEnabled: true, wheelPercentage: true },
  });
  if (!venue || !venue.isActive) throw new HttpError(404, 'Objekat nije pronađen');

  const itemIds = input.items.map((i) => i.itemId);
  const dbItems = await prisma.menuItem.findMany({
    where: {
      id: { in: itemIds },
      isAvailable: true,
      category: { isActive: true, menu: { venueId: venue.id, isActive: true } },
    },
    select: { id: true, name: true, price: true, discountPercent: true, isFeatured: true },
  });

  const byId = new Map(dbItems.map((i) => [i.id, i]));
  for (const line of input.items) {
    if (!byId.has(line.itemId)) {
      throw new HttpError(400, 'Neki artikli iz narudžbe više nisu dostupni');
    }
  }

  // Kolo sreće: popust vrijedi samo na osvojeni artikal (mora biti istaknut).
  const wheelId = input.wheelItemId ?? null;
  const wheelPct = venue.wheelEnabled ? (venue.wheelPercentage ?? 0) : 0;
  const wheelItem = wheelId ? byId.get(wheelId) : undefined;
  const wheelValid = !!wheelItem && wheelItem.isFeatured && wheelPct > 0;
  let wheelNote: string | null = null;

  let total = new D(0);
  const orderItems = input.items.map((line) => {
    const item = byId.get(line.itemId)!;
    // efektivni popust = bolji od artiklovog i osvojenog (za osvojeni artikal)
    let discount = item.discountPercent;
    if (wheelValid && line.itemId === wheelId) {
      discount = Math.max(item.discountPercent ?? 0, wheelPct);
      wheelNote = `🎡 Kolo sreće: -${wheelPct}% na ${item.name}`;
    }
    const unit = finalPrice(item.price, discount);
    const lineTotal = unit.mul(line.quantity).toDecimalPlaces(2);
    total = total.add(lineTotal);
    return {
      menuItemId: item.id,
      nameSnapshot: item.name,
      unitPriceSnapshot: unit,
      quantity: line.quantity,
      lineTotal,
    };
  });

  const note = [input.note?.trim() || null, wheelNote].filter(Boolean).join(' · ') || null;

  const order = await prisma.order.create({
    data: {
      publicId: nanoid(14),
      venueId: venue.id,
      tableNumber: input.tableNumber,
      note,
      total,
      items: { create: orderItems },
    },
    include: { items: true },
  });

  const dto = toOrderDTO(order);
  io?.to(`venue:${venue.id}`).emit('order:new', dto);
  return dto;
}

/** Mijenja status; emituje i admin dashboardu i gostovoj status stranici. */
export async function updateOrderStatus(orderId: number, status: OrderDTO['status']) {
  const previous = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status, statusChangedAt: new Date() },
    include: { items: true },
  });

  // Potvrda narudžbe odbija stanje inventara (samo pri prelasku U accepted)
  if (status === 'accepted' && previous?.status !== 'accepted') {
    await deductStock(order.venueId, order.items);
  }

  const dto = toOrderDTO(order);
  io?.to(`venue:${order.venueId}`).emit('order:status', dto);
  io?.to(`order:${order.publicId}`).emit('order:status', dto);
  return dto;
}

/**
 * Odbija naručene količine od stanja artikala koji prate inventar.
 * Na 0 → artikal se automatski skriva sa javnog menija (isAvailable=false)
 * + emituju se stock:low / stock:out eventi u venue sobu.
 */
async function deductStock(
  venueId: number,
  items: { menuItemId: number | null; quantity: number }[]
) {
  for (const line of items) {
    if (!line.menuItemId) continue;

    // Atomski: čitanje + upis u jednoj transakciji, da dva konobara koja
    // istovremeno prihvate narudžbe ne prodaju istu zalihu dvaput.
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.findUnique({
        where: { id: line.menuItemId! },
        select: { id: true, name: true, stockQty: true, lowStockAt: true },
      });
      if (!item || item.stockQty === null) return null; // stanje se ne prati

      const newQty = Math.max(0, item.stockQty - line.quantity);
      await tx.menuItem.update({
        where: { id: item.id },
        data: { stockQty: newQty, ...(newQty === 0 ? { isAvailable: false } : {}) },
      });
      return { ...item, newQty };
    });

    if (!result) continue;

    if (result.newQty === 0) {
      io?.to(`venue:${venueId}`).emit('stock:out', { itemId: result.id, name: result.name });
    } else if (result.lowStockAt !== null && result.newQty <= result.lowStockAt) {
      io?.to(`venue:${venueId}`).emit('stock:low', {
        itemId: result.id,
        name: result.name,
        qty: result.newQty,
      });
    }
  }
}
