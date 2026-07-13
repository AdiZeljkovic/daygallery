import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { bulkTablesSchema, updateTableSchema } from '@platform/shared';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/requireOwnership.js';
import { HttpError } from '../middleware/errorHandler.js';

export const tablesRouter = Router();
tablesRouter.use(requireAuth);

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

async function assertTableOwnership(req: Request, tableId: number) {
  if (req.user!.role === 'superadmin') return;
  const table = await prisma.seatingTable.findUnique({
    where: { id: tableId },
    select: { event: { select: { ownerUserId: true } } },
  });
  if (!table) throw new HttpError(404, 'Sto nije pronađen');
  if (table.event.ownerUserId !== req.user!.id) throw new HttpError(403, 'Nemate pristup');
}

tablesRouter.get(
  '/events/:id/tables',
  requireOwnership('event'),
  wrap(async (req, res) => {
    const tables = await prisma.seatingTable.findMany({
      where: { eventId: Number(req.params.id) },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(tables);
  })
);

/** Bulk kreiranje: N stolova od startNumber, jedan insert. */
tablesRouter.post(
  '/events/:id/tables/bulk',
  requireOwnership('event'),
  validate(bulkTablesSchema),
  wrap(async (req, res) => {
    const eventId = Number(req.params.id);
    const { count, type, startNumber } = req.body;

    const existing = await prisma.seatingTable.count({ where: { eventId } });
    await prisma.seatingTable.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        eventId,
        label: String(startNumber + i),
        type,
        sortOrder: existing + i,
      })),
    });
    res.status(201).json({ created: count });
  })
);

tablesRouter.patch(
  '/tables/:id',
  validate(updateTableSchema),
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    await assertTableOwnership(req, id);
    const table = await prisma.seatingTable.update({ where: { id }, data: req.body });
    res.json(table);
  })
);

tablesRouter.delete(
  '/tables/:id',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    await assertTableOwnership(req, id);
    await prisma.seatingTable.delete({ where: { id } });
    res.json({ success: true });
  })
);
