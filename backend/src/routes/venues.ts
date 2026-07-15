import { Router } from 'express';
import { nanoid } from 'nanoid';
import { createVenueSchema, updateVenueSchema } from '@platform/shared';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/requireOwnership.js';
import { requireVenueAccess } from '../middleware/venueAccess.js';

export const venuesRouter = Router();

venuesRouter.use(requireAuth);

/** Klijent vidi samo svoje objekte; superadmin sve. */
venuesRouter.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const venues = await prisma.venue.findMany({
      where: user.role === 'superadmin' ? {} : { ownerUserId: user.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(venues);
  } catch (err) {
    next(err);
  }
});

/** Privatne žalbe (recenzije < 4★) — šef i menadžer objekta. */
venuesRouter.get('/:id/feedback', requireVenueAccess(['manager']), async (req, res, next) => {
  try {
    const feedback = await prisma.privateFeedback.findMany({
      where: { venueId: Number(req.params.id) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(feedback);
  } catch (err) {
    next(err);
  }
});

venuesRouter.get('/:id', requireVenueAccess(), async (req, res, next) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        menus: { select: { id: true, name: true, isActive: true } },
        owner: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true } },
      },
    });
    if (!venue) return res.status(404).json({ error: 'Objekat nije pronađen' });
    res.json(venue);
  } catch (err) {
    next(err);
  }
});

/** Kreiranje objekta — samo superadmin (dodjeljuje vlasnika-klijenta). */
venuesRouter.post('/', requireRole('superadmin'), validate(createVenueSchema), async (req, res, next) => {
  try {
    const { ownerUserId, ...data } = req.body;
    const owner = ownerUserId ?? req.user!.id;

    const ownerExists = await prisma.user.findUnique({ where: { id: owner } });
    if (!ownerExists) return res.status(400).json({ error: 'Vlasnik ne postoji' });

    const venue = await prisma.venue.create({
      data: { ...data, slug: nanoid(12), ownerUserId: owner },
    });
    res.status(201).json(venue);
  } catch (err) {
    next(err);
  }
});

venuesRouter.patch('/:id', requireOwnership('venue'), validate(updateVenueSchema), async (req, res, next) => {
  try {
    // vlasnika i grupu smije mijenjati samo superadmin
    const { ownerUserId, theme, groupId, ...data } = req.body;
    const patch: Record<string, unknown> =
      req.user!.role === 'superadmin' && ownerUserId ? { ...data, ownerUserId } : data;
    if (req.user!.role === 'superadmin' && groupId !== undefined) patch.groupId = groupId;

    // theme se MERGE-a s postojećim — da upload pozadine (backgroundImagePath) preživi izmjene boja
    if (theme) {
      const existing = await prisma.venue.findUnique({
        where: { id: Number(req.params.id) },
        select: { theme: true },
      });
      patch.theme = { ...((existing?.theme as object) ?? {}), ...theme };
    }

    const venue = await prisma.venue.update({
      where: { id: Number(req.params.id) },
      data: patch,
    });
    res.json(venue);
  } catch (err) {
    next(err);
  }
});

venuesRouter.delete('/:id', requireRole('superadmin'), async (req, res, next) => {
  try {
    await prisma.venue.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
