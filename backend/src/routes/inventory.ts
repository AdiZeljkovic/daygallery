import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireVenueAccess, resolveVenueAccess } from '../middleware/venueAccess.js';
import { HttpError } from '../middleware/errorHandler.js';

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

const itemSchema = z.object({
  name: z.string().trim().min(1, 'Naziv je obavezan').max(120),
  unit: z.string().trim().min(1).max(20).default('kom'),
  quantity: z.coerce.number().min(0).max(999999),
  lowStockAt: z.coerce.number().min(0).max(999999).nullable().optional(),
});

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/** Opći inventar — čitaju svi članovi objekta. */
inventoryRouter.get(
  '/venues/:id/inventory',
  requireVenueAccess(),
  wrap(async (req, res) => {
    const items = await prisma.inventoryItem.findMany({
      where: { venueId: Number(req.params.id) },
      orderBy: { name: 'asc' },
    });
    res.json(items);
  })
);

inventoryRouter.post(
  '/venues/:id/inventory',
  requireVenueAccess(['manager']),
  validate(itemSchema),
  wrap(async (req, res) => {
    const item = await prisma.inventoryItem.create({
      data: { ...req.body, venueId: Number(req.params.id) },
    });
    res.status(201).json(item);
  })
);

async function assertInventoryManager(req: Request, itemId: number) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new HttpError(404, 'Stavka nije pronađena');
  const access = await resolveVenueAccess(req.user!, item.venueId, ['manager']);
  if (!access) throw new HttpError(403, 'Nemate pristup');
  return item;
}

inventoryRouter.patch(
  '/inventory/:itemId',
  validate(itemSchema.partial()),
  wrap(async (req, res) => {
    const itemId = Number(req.params.itemId);
    await assertInventoryManager(req, itemId);
    const item = await prisma.inventoryItem.update({ where: { id: itemId }, data: req.body });
    res.json(item);
  })
);

inventoryRouter.delete(
  '/inventory/:itemId',
  wrap(async (req, res) => {
    const itemId = Number(req.params.itemId);
    await assertInventoryManager(req, itemId);
    await prisma.inventoryItem.delete({ where: { id: itemId } });
    res.json({ success: true });
  })
);
