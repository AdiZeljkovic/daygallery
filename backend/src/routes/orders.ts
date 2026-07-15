import { Router } from 'express';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { updateOrderStatusSchema } from '@platform/shared';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireVenueAccess, resolveVenueAccess } from '../middleware/venueAccess.js';
import { HttpError } from '../middleware/errorHandler.js';
import { toOrderDTO, updateOrderStatus } from '../services/orderService.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

/** Lista narudžbi objekta — vlasnik i SVO osoblje (konobar, kuhinja). */
ordersRouter.get('/venues/:id/orders', requireVenueAccess(), async (req, res, next) => {
  try {
    const venueId = Number(req.params.id);
    const status = req.query.status as string | undefined;
    const take = Math.min(Number(req.query.take) || 50, 200);

    // opcioni datumski raspon (historizacija — pregled po danu)
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    const createdAt =
      from || to
        ? { ...(from && !isNaN(from.getTime()) ? { gte: from } : {}), ...(to && !isNaN(to.getTime()) ? { lte: to } : {}) }
        : undefined;

    const orders = await prisma.order.findMany({
      where: {
        venueId,
        ...(status && ['pending', 'accepted', 'rejected', 'completed'].includes(status)
          ? { status: status as never }
          : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
    res.json(orders.map(toOrderDTO));
  } catch (err) {
    next(err);
  }
});

/**
 * Promet po danu/mjesecu — historizacija (broj narudžbi + suma). Isključuje odbijene.
 * period=day → grupiše po danu; period=month → po mjesecu.
 */
ordersRouter.get('/venues/:id/orders/stats', requireVenueAccess(), async (req, res, next) => {
  try {
    const venueId = Number(req.params.id);
    const period = req.query.period === 'month' ? 'month' : 'day';
    const fmt = period === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const where: Prisma.Sql[] = [
      Prisma.sql`venue_id = ${venueId}`,
      Prisma.sql`status <> 'rejected'`,
    ];
    if (from && !isNaN(from.getTime())) where.push(Prisma.sql`created_at >= ${from}`);
    if (to && !isNaN(to.getTime())) where.push(Prisma.sql`created_at <= ${to}`);

    const rows = await prisma.$queryRaw<{ bucket: string; orders: bigint; revenue: string | null }[]>(Prisma.sql`
      SELECT DATE_FORMAT(created_at, ${fmt}) AS bucket,
             COUNT(*) AS orders,
             COALESCE(SUM(total), 0) AS revenue
      FROM orders
      WHERE ${Prisma.join(where, ' AND ')}
      GROUP BY bucket
      ORDER BY bucket DESC
      LIMIT 400
    `);

    res.json(
      rows.map((r) => ({
        bucket: String(r.bucket),
        orders: Number(r.orders),
        revenue: Number(r.revenue ?? 0).toFixed(2),
      }))
    );
  } catch (err) {
    next(err);
  }
});

/** Promjena statusa — vlasnik i svo osoblje objekta (kuhinja označava "Spremno"). */
ordersRouter.patch('/orders/:id/status', validate(updateOrderStatusSchema), async (req: Request, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Neispravan ID');

    const order = await prisma.order.findUnique({ where: { id }, select: { venueId: true } });
    if (!order) throw new HttpError(404, 'Narudžba nije pronađena');

    const access = await resolveVenueAccess(req.user!, order.venueId);
    if (!access) throw new HttpError(403, 'Nemate pristup ovoj narudžbi');

    const dto = await updateOrderStatus(id, req.body.status);
    res.json(dto);
  } catch (err) {
    next(err);
  }
});
