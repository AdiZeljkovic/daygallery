import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import { createInviteSchema, updateInviteSchema } from '@platform/shared';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { imageUpload, processImage, deleteImageFiles } from '../services/imageService.js';

export const invitesRouter = Router();
invitesRouter.use(requireAuth);

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/**
 * Ownership: pozivnica vezana za event → vlasnik eventa; bez eventa → samo superadmin.
 */
async function assertInviteOwnership(req: Request, inviteId: number) {
  if (req.user!.role === 'superadmin') return;
  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: { event: { select: { ownerUserId: true } } },
  });
  if (!invite) throw new HttpError(404, 'Pozivnica nije pronađena');
  if (invite.event?.ownerUserId !== req.user!.id) throw new HttpError(403, 'Nemate pristup');
}

/** Klijent smije vezati pozivnicu samo za svoj event. */
async function assertEventAccess(req: Request, eventId: number | null | undefined) {
  if (req.user!.role === 'superadmin') return;
  if (!eventId) throw new HttpError(403, 'Pozivnica mora biti vezana za vaš event');
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { ownerUserId: true },
  });
  if (!event || event.ownerUserId !== req.user!.id) throw new HttpError(403, 'Nemate pristup');
}

invitesRouter.get(
  '/',
  wrap(async (req, res) => {
    const user = req.user!;
    const invites = await prisma.invite.findMany({
      where: user.role === 'superadmin' ? {} : { event: { ownerUserId: user.id } },
      include: {
        event: { select: { id: true, name: true } },
        _count: { select: { rsvps: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invites);
  })
);

invitesRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    await assertInviteOwnership(req, id);
    const invite = await prisma.invite.findUnique({
      where: { id },
      include: { schedule: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!invite) throw new HttpError(404, 'Pozivnica nije pronađena');
    res.json(invite);
  })
);

invitesRouter.get(
  '/:id/rsvps',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    await assertInviteOwnership(req, id);
    const rsvps = await prisma.rsvp.findMany({
      where: { inviteId: id },
      orderBy: { createdAt: 'desc' },
    });
    const attending = rsvps.filter((r) => r.attending);
    res.json({
      rsvps,
      stats: {
        attendingCount: attending.length,
        totalGuests: attending.reduce((n, r) => n + 1 + r.plusOnes, 0),
        notAttending: rsvps.length - attending.length,
      },
    });
  })
);

invitesRouter.post(
  '/',
  validate(createInviteSchema),
  wrap(async (req, res) => {
    const { schedule, weddingDetails, date, eventId, ...data } = req.body;
    await assertEventAccess(req, eventId);

    const invite = await prisma.invite.create({
      data: {
        ...data,
        message: data.message || null,
        location: data.location || null,
        time: data.time || null,
        date: date ? new Date(date) : null,
        eventId: eventId ?? null,
        weddingDetails: weddingDetails ?? undefined,
        slug: nanoid(12),
        schedule: {
          create: schedule.map((s: { time: string; title: string; location?: string }, i: number) => ({
            time: s.time,
            title: s.title,
            location: s.location || null,
            sortOrder: i,
          })),
        },
      },
      include: { schedule: true },
    });
    res.status(201).json(invite);
  })
);

invitesRouter.patch(
  '/:id',
  validate(updateInviteSchema),
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    await assertInviteOwnership(req, id);

    const { schedule, weddingDetails, date, eventId, ...data } = req.body;
    if (eventId !== undefined) await assertEventAccess(req, eventId);

    const patch: Record<string, unknown> = { ...data };
    if (date !== undefined) patch.date = date ? new Date(date) : null;
    if (eventId !== undefined) patch.eventId = eventId;
    if (weddingDetails !== undefined) patch.weddingDetails = weddingDetails ?? undefined;
    if (data.message !== undefined) patch.message = data.message || null;
    if (data.location !== undefined) patch.location = data.location || null;
    if (data.time !== undefined) patch.time = data.time || null;

    const invite = await prisma.invite.update({ where: { id }, data: patch });

    if (schedule) {
      await prisma.inviteScheduleItem.deleteMany({ where: { inviteId: id } });
      await prisma.inviteScheduleItem.createMany({
        data: schedule.map((s: { time: string; title: string; location?: string }, i: number) => ({
          inviteId: id,
          time: s.time,
          title: s.title,
          location: s.location || null,
          sortOrder: i,
        })),
      });
    }
    res.json(invite);
  })
);

invitesRouter.delete(
  '/:id',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    await assertInviteOwnership(req, id);
    const invite = await prisma.invite.delete({ where: { id } });
    await deleteImageFiles(
      invite.coverImagePath,
      invite.coverImagePath?.replace('.webp', '_thumb.webp')
    );
    res.json({ success: true });
  })
);

invitesRouter.post(
  '/:id/cover',
  imageUpload.single('image'),
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    await assertInviteOwnership(req, id);
    if (!req.file) throw new HttpError(400, 'Slika nedostaje');

    const existing = await prisma.invite.findUnique({
      where: { id },
      select: { coverImagePath: true },
    });
    const processed = await processImage(req.file.buffer, `invites/${id}`, { maxDim: 2000 });
    await deleteImageFiles(
      existing?.coverImagePath,
      existing?.coverImagePath?.replace('.webp', '_thumb.webp')
    );

    const invite = await prisma.invite.update({
      where: { id },
      data: { coverImagePath: processed.filePath },
    });
    res.json(invite);
  })
);
