import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createRequire } from 'node:module';
import type { Archiver, ArchiverOptions } from 'archiver';
const archiver = createRequire(import.meta.url)('archiver') as (
  format: 'zip',
  options?: ArchiverOptions
) => Archiver;
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/requireOwnership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { deleteImageFiles } from '../services/imageService.js';

export const eventsRouter = Router();
eventsRouter.use(requireAuth);

const createEventSchema = z.object({
  name: z.string().trim().min(1, 'Naziv je obavezan').max(150),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  clientNames: z.string().trim().max(200).optional().or(z.literal('')),
  isPublicGallery: z.boolean().default(false),
  autoApprove: z.boolean().default(true),
  ownerUserId: z.number().int().positive().optional(),
});

const updateEventSchema = createEventSchema.partial();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

// ---------------------------------------------------------------
// Moderacija (superadmin) — MORA biti registrovana prije '/:id' ruta
// ---------------------------------------------------------------

/** Sve pending slike svih galerija, najstarije prve (rok odobrenja 24h). */
eventsRouter.get(
  '/moderation/pending',
  requireRole('superadmin'),
  wrap(async (_req, res) => {
    const images = await prisma.eventImage.findMany({
      where: { status: 'pending' },
      orderBy: { uploadedAt: 'asc' },
      include: { event: { select: { id: true, name: true, clientNames: true } } },
      take: 500, // moderacija u serijama — panel ne mora vući hiljade odjednom
    });
    res.json(images);
  })
);

/** Odobri sve pending slike SVIH galerija. */
eventsRouter.post(
  '/moderation/approve-all',
  requireRole('superadmin'),
  wrap(async (_req, res) => {
    const result = await prisma.eventImage.updateMany({
      where: { status: 'pending' },
      data: { status: 'approved' },
    });
    res.json({ approved: result.count });
  })
);

/** Lista eventa — klijent svoje, superadmin sve. */
eventsRouter.get(
  '/',
  wrap(async (req, res) => {
    const user = req.user!;
    const events = await prisma.event.findMany({
      where: user.role === 'superadmin' ? {} : { ownerUserId: user.id },
      include: {
        owner: { select: { id: true, name: true } },
        coverImage: { select: { thumbPath: true } },
        _count: { select: { images: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json(events);
  })
);

eventsRouter.get(
  '/:id',
  requireOwnership('event'),
  wrap(async (req, res) => {
    // vlasnik galerije vidi SAMO odobrene slike; superadmin sve (za moderaciju)
    const isSuperadmin = req.user!.role === 'superadmin';
    const event = await prisma.event.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        images: {
          where: isSuperadmin ? {} : { status: 'approved' },
          orderBy: { uploadedAt: 'desc' },
          take: 2000, // sigurnosni limit — spriječi da ogromna galerija obori panel
        },
        coverImage: { select: { id: true, thumbPath: true } },
      },
    });
    if (!event) throw new HttpError(404, 'Event nije pronađen');
    res.json(event);
  })
);

eventsRouter.post(
  '/',
  requireRole('superadmin'),
  validate(createEventSchema),
  wrap(async (req, res) => {
    const { ownerUserId, eventDate, ...data } = req.body;
    const event = await prisma.event.create({
      data: {
        ...data,
        clientNames: data.clientNames || null,
        eventDate: eventDate ? new Date(eventDate) : null,
        slug: nanoid(12),
        ownerUserId: ownerUserId ?? req.user!.id,
      },
    });
    res.status(201).json(event);
  })
);

eventsRouter.patch(
  '/:id',
  requireOwnership('event'),
  validate(updateEventSchema),
  wrap(async (req, res) => {
    const { ownerUserId, eventDate, ...data } = req.body;
    const patch: Record<string, unknown> = { ...data };
    if (eventDate !== undefined) patch.eventDate = eventDate ? new Date(eventDate) : null;
    if (req.user!.role === 'superadmin' && ownerUserId) patch.ownerUserId = ownerUserId;

    const event = await prisma.event.update({ where: { id: Number(req.params.id) }, data: patch });
    res.json(event);
  })
);

eventsRouter.delete(
  '/:id',
  requireRole('superadmin'),
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const images = await prisma.eventImage.findMany({
      where: { eventId: id },
      select: { filePath: true, thumbPath: true },
    });
    await prisma.event.delete({ where: { id } });
    await deleteImageFiles(...images.flatMap((i) => [i.filePath, i.thumbPath]));
    res.json({ success: true });
  })
);

// ---------------------------------------------------------------
// Slike: moderacija — SAMO superadmin (rok 24h)
// ---------------------------------------------------------------

const patchImageSchema = z.object({
  status: z.enum(['pending', 'approved']).optional(),
  inPublicGallery: z.boolean().optional(),
});

eventsRouter.patch(
  '/images/:imageId',
  requireRole('superadmin'),
  validate(patchImageSchema),
  wrap(async (req, res) => {
    const imageId = Number(req.params.imageId);
    const image = await prisma.eventImage.update({ where: { id: imageId }, data: req.body });
    res.json(image);
  })
);

/** Odobri sve pending slike eventa jednim klikom. */
eventsRouter.post(
  '/:id/images/approve-all',
  requireRole('superadmin'),
  wrap(async (req, res) => {
    const result = await prisma.eventImage.updateMany({
      where: { eventId: Number(req.params.id), status: 'pending' },
      data: { status: 'approved' },
    });
    res.json({ approved: result.count });
  })
);

eventsRouter.delete(
  '/images/:imageId',
  requireRole('superadmin'),
  wrap(async (req, res) => {
    const image = await prisma.eventImage.delete({ where: { id: Number(req.params.imageId) } });
    await deleteImageFiles(image.filePath, image.thumbPath);
    res.json({ success: true });
  })
);

/** Postavi cover eventa na postojeću sliku. */
eventsRouter.post(
  '/:id/cover/:imageId',
  requireOwnership('event'),
  wrap(async (req, res) => {
    const eventId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const image = await prisma.eventImage.findUnique({ where: { id: imageId } });
    if (!image || image.eventId !== eventId) throw new HttpError(404, 'Slika nije pronađena');

    const event = await prisma.event.update({
      where: { id: eventId },
      data: { coverImageId: imageId },
    });
    res.json(event);
  })
);

// ---------------------------------------------------------------
// ZIP download — streaming, bez učitavanja svega u memoriju
// ---------------------------------------------------------------

eventsRouter.get(
  '/:id/images/zip',
  requireOwnership('event'),
  wrap(async (req, res) => {
    const event = await prisma.event.findUnique({
      where: { id: Number(req.params.id) },
      include: { images: { where: { status: 'approved' } } },
    });
    if (!event) throw new HttpError(404, 'Event nije pronađen');
    if (!event.images.length) throw new HttpError(400, 'Nema odobrenih slika');

    const safeName = event.name.replace(/[^\w\d-]/g, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_slike.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err: Error) => {
      console.error('ZIP error:', err);
      res.destroy();
    });
    archive.pipe(res);

    for (const [i, img] of event.images.entries()) {
      const abs = path.resolve(env.uploadsDir, img.filePath);
      if (!abs.startsWith(path.resolve(env.uploadsDir))) continue;
      archive.file(abs, { name: `${safeName}/slika_${String(i + 1).padStart(3, '0')}.webp` });
    }
    await archive.finalize();
  })
);
