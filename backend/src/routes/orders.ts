import { Router } from 'express';
import type { Request } from 'express';
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

    const orders = await prisma.order.findMany({
      where: {
        venueId,
        ...(status && ['pending', 'accepted', 'rejected', 'completed'].includes(status)
          ? { status: status as never }
          : {}),
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
