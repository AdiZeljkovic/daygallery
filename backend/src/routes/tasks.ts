import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireVenueAccess, resolveVenueAccess } from '../middleware/venueAccess.js';
import { HttpError } from '../middleware/errorHandler.js';
import { io } from '../sockets/index.js';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Naziv je obavezan').max(150),
  note: z.string().trim().max(500).optional().or(z.literal('')),
  kind: z.enum(['task', 'shift']).default('task'),
  assigneeUserId: z.number().int().positive().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Neispravan datum'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']).default('none'),
  recurrenceUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
const parseDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/**
 * Ekspanduje ponavljajući task u datume pojava unutar [from, to].
 */
function expandOccurrences(
  task: { date: Date; recurrence: string; recurrenceUntil: Date | null },
  from: Date,
  to: Date
): string[] {
  const first = task.date;
  const until = task.recurrenceUntil && task.recurrenceUntil < to ? task.recurrenceUntil : to;
  if (first > until) return [];

  if (task.recurrence === 'none') {
    return first >= from && first <= to ? [toDateStr(first)] : [];
  }

  const dates: string[] = [];
  if (task.recurrence === 'daily') {
    for (let d = first < from ? from : first; d <= until; d = addDays(d, 1)) {
      dates.push(toDateStr(d));
    }
  } else if (task.recurrence === 'weekly') {
    // prva pojava >= from sa istim danom u sedmici
    let d = first;
    if (d < from) {
      const diffDays = Math.ceil((from.getTime() - d.getTime()) / 86_400_000);
      d = addDays(d, Math.ceil(diffDays / 7) * 7);
    }
    for (; d <= until; d = addDays(d, 7)) dates.push(toDateStr(d));
  } else if (task.recurrence === 'monthly') {
    const dayOfMonth = first.getUTCDate();
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    for (let m = new Date(cursor); m <= until; m.setUTCMonth(m.getUTCMonth() + 1)) {
      const candidate = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), dayOfMonth));
      // preskoči mjesece bez tog dana (31. u februaru) — JS bi prelio u sljedeći mjesec
      if (candidate.getUTCMonth() !== m.getUTCMonth()) continue;
      if (candidate >= first && candidate >= from && candidate <= until) {
        dates.push(toDateStr(candidate));
      }
    }
  }
  return dates;
}

/**
 * GET /venues/:id/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Vraća pojave taskova/smjena u rasponu, sa statusom završenosti.
 * Konobar/kuhinja vide samo svoje + zajedničke ("svi"); šef vidi sve.
 */
tasksRouter.get(
  '/venues/:id/tasks',
  requireVenueAccess(),
  wrap(async (req, res) => {
    const venueId = Number(req.params.id);
    const from = parseDate(String(req.query.from ?? toDateStr(new Date())));
    const to = parseDate(String(req.query.to ?? toDateStr(addDays(new Date(), 6))));
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) {
      throw new HttpError(400, 'Neispravan raspon datuma');
    }
    if ((to.getTime() - from.getTime()) / 86_400_000 > 62) {
      throw new HttpError(400, 'Raspon je predug (max 62 dana)');
    }

    const access = req.venueAccess!;
    const isWorker = access.via === 'waiter' || access.via === 'kitchen';

    const tasks = await prisma.task.findMany({
      where: {
        venueId,
        AND: [
          {
            OR: [
              { recurrence: 'none', date: { gte: from, lte: to } },
              {
                recurrence: { not: 'none' },
                date: { lte: to },
                OR: [{ recurrenceUntil: null }, { recurrenceUntil: { gte: from } }],
              },
            ],
          },
          // konobar/kuhinja vide samo svoje + zajedničke
          ...(isWorker
            ? [{ OR: [{ assigneeUserId: null }, { assigneeUserId: req.user!.id }] }]
            : []),
        ],
      },
      include: {
        assignee: { select: { id: true, name: true } },
        completions: { where: { date: { gte: from, lte: to } } },
      },
      orderBy: [{ kind: 'desc' }, { startTime: 'asc' }],
    });

    const occurrences = tasks.flatMap((task) => {
      const doneByDate = new Map(task.completions.map((c) => [toDateStr(c.date), c]));
      return expandOccurrences(task, from, to).map((date) => ({
        taskId: task.id,
        date,
        title: task.title,
        note: task.note,
        kind: task.kind,
        startTime: task.startTime,
        endTime: task.endTime,
        recurrence: task.recurrence,
        assignee: task.assignee,
        done: doneByDate.has(date),
        doneAt: doneByDate.get(date)?.doneAt ?? null,
      }));
    });

    res.json(occurrences);
  })
);

/** Kreiranje — samo šef (vlasnik/manager). Radnici dobiju notifikaciju. */
tasksRouter.post(
  '/venues/:id/tasks',
  requireVenueAccess(['manager'], 'id', ['tasks']),
  validate(taskSchema),
  wrap(async (req, res) => {
    const venueId = Number(req.params.id);
    const { date, recurrenceUntil, startTime, endTime, note, ...data } = req.body;

    const task = await prisma.task.create({
      data: {
        ...data,
        note: note || null,
        startTime: startTime || null,
        endTime: endTime || null,
        date: parseDate(date),
        recurrenceUntil: recurrenceUntil ? parseDate(recurrenceUntil) : null,
        venueId,
        createdById: req.user!.id,
      },
      include: { assignee: { select: { id: true, name: true } } },
    });

    io?.to(`venue:${venueId}`).emit('task:new', {
      taskId: task.id,
      title: task.title,
      kind: task.kind,
      date: toDateStr(task.date),
      assignee: task.assignee,
    });

    res.status(201).json(task);
  })
);

async function assertTaskManager(req: Request, taskId: number) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new HttpError(404, 'Zadatak nije pronađen');
  const access = await resolveVenueAccess(req.user!, task.venueId, ['manager'], ['tasks']);
  if (!access) throw new HttpError(403, 'Nemate pristup');
  return task;
}

tasksRouter.patch(
  '/tasks/:taskId',
  validate(taskSchema.partial()),
  wrap(async (req, res) => {
    const taskId = Number(req.params.taskId);
    await assertTaskManager(req, taskId);

    const { date, recurrenceUntil, startTime, endTime, note, ...data } = req.body;
    const patch: Record<string, unknown> = { ...data };
    if (date !== undefined) patch.date = parseDate(date);
    if (recurrenceUntil !== undefined) {
      patch.recurrenceUntil = recurrenceUntil ? parseDate(recurrenceUntil) : null;
    }
    if (startTime !== undefined) patch.startTime = startTime || null;
    if (endTime !== undefined) patch.endTime = endTime || null;
    if (note !== undefined) patch.note = note || null;

    const task = await prisma.task.update({ where: { id: taskId }, data: patch });
    res.json(task);
  })
);

tasksRouter.delete(
  '/tasks/:taskId',
  wrap(async (req, res) => {
    const taskId = Number(req.params.taskId);
    await assertTaskManager(req, taskId);
    await prisma.task.delete({ where: { id: taskId } });
    res.json({ success: true });
  })
);

/** Označavanje pojave završenom / poništavanje — svi članovi objekta. */
tasksRouter.post(
  '/tasks/:taskId/complete',
  validate(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), done: z.boolean().default(true) })),
  wrap(async (req, res) => {
    const taskId = Number(req.params.taskId);
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new HttpError(404, 'Zadatak nije pronađen');

    const access = await resolveVenueAccess(req.user!, task.venueId);
    if (!access) throw new HttpError(403, 'Nemate pristup');

    const date = parseDate(req.body.date);
    if (req.body.done) {
      await prisma.taskCompletion.upsert({
        where: { taskId_date: { taskId, date } },
        update: {},
        create: { taskId, date, doneById: req.user!.id },
      });
    } else {
      await prisma.taskCompletion.deleteMany({ where: { taskId, date } });
    }
    res.json({ success: true });
  })
);
