import { Router } from 'express';
import { createOrderSchema, createRsvpSchema } from '@platform/shared';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { orderLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import { createOrder, toOrderDTO } from '../services/orderService.js';
import { imageUpload, processImage } from '../services/imageService.js';
import { io } from '../sockets/index.js';

export const publicRouter = Router();

/**
 * Legacy resolver — stari day-gallery ID → novi slug.
 * Odštampani QR kodovi kodiraju npr. /menu?id=<stariMenuId>; Next legacy
 * stranice zovu ovaj endpoint da saznaju novi slug i preusmjere.
 */
publicRouter.get('/legacy/:type/:legacyId', async (req, res, next) => {
  try {
    const { type, legacyId } = req.params;
    let slug: string | null = null;

    if (type === 'menu' || type === 'venue') {
      const v = await prisma.venue.findUnique({ where: { legacyId }, select: { slug: true } });
      slug = v?.slug ?? null;
    } else if (type === 'event' || type === 'gallery' || type === 'upload' || type === 'tables') {
      const e = await prisma.event.findUnique({ where: { legacyId }, select: { slug: true } });
      slug = e?.slug ?? null;
    } else if (type === 'invite') {
      const i = await prisma.invite.findUnique({ where: { legacyId }, select: { slug: true } });
      slug = i?.slug ?? null;
    } else {
      return res.status(400).json({ error: 'Nepoznat tip' });
    }

    if (!slug) return res.status(404).json({ error: 'Nije pronađeno' });
    res.json({ slug });
  } catch (err) {
    next(err);
  }
});

/**
 * Javni meni po venue slug-u — samo aktivne kategorije/dostupni artikli,
 * uključuje prevode i temu. Bez autha (QR target).
 */
publicRouter.get('/venues/:slug/menu', async (req, res, next) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        slug: true,
        name: true,
        logoPath: true,
        address: true,
        phone: true,
        currency: true,
        defaultLang: true,
        theme: true,
        googleReviewUrl: true,
        isActive: true,
        menus: {
          where: { isActive: true },
          take: 1,
          select: {
            categories: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                name: true,
                kind: true,
                translations: true,
                items: {
                  where: { isAvailable: true },
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    price: true,
                    imagePath: true,
                    discountPercent: true,
                    isFeatured: true,
                    translations: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!venue || !venue.isActive) {
      return res.status(404).json({ error: 'Objekat nije pronađen' });
    }

    const { menus, isActive: _isActive, ...venueData } = venue;
    res.json({ ...venueData, categories: menus[0]?.categories ?? [] });
  } catch (err) {
    next(err);
  }
});

/** Gost šalje narudžbu — rate-limited, total se računa server-side. */
publicRouter.post(
  '/venues/:slug/orders',
  orderLimiter,
  validate(createOrderSchema),
  async (req, res, next) => {
    try {
      const dto = await createOrder(req.params.slug, req.body);
      res.status(201).json(dto);
    } catch (err) {
      next(err);
    }
  }
);

// ===============================================================
// Event galerija (guest)
// ===============================================================

/** Info o eventu za upload stranicu. */
publicRouter.get('/events/:slug', async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { slug: req.params.slug },
      select: {
        slug: true,
        name: true,
        eventDate: true,
        clientNames: true,
        coverImage: { select: { filePath: true } },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event nije pronađen' });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

/** Gost uploaduje slike — multipart, ≤10 fajlova po zahtjevu, rate-limited. */
publicRouter.post(
  '/events/:slug/images',
  uploadLimiter,
  imageUpload.array('images', 10),
  async (req, res, next) => {
    try {
      const event = await prisma.event.findUnique({
        where: { slug: req.params.slug },
        select: { id: true },
      });
      if (!event) return res.status(404).json({ error: 'Event nije pronađen' });

      const files = (req.files as Express.Multer.File[]) ?? [];
      if (!files.length) return res.status(400).json({ error: 'Nema fajlova' });

      const saved = [];
      for (const file of files) {
        const processed = await processImage(file.buffer, `events/${event.id}/gallery`);
        const image = await prisma.eventImage.create({
          data: {
            eventId: event.id,
            filePath: processed.filePath,
            thumbPath: processed.thumbPath,
            width: processed.width,
            height: processed.height,
            bytes: processed.bytes,
            // sve slike čekaju odobrenje superadmina (rok 24h)
            status: 'pending',
          },
        });
        saved.push(image);
      }

      // admin galerija se osvježava uživo
      io?.to(`event:${event.id}`).emit('gallery:new', { count: saved.length });

      res.status(201).json({ uploaded: saved.length });
    } catch (err) {
      next(err);
    }
  }
);

/** Galerija eventa — samo odobrene slike; slug je privatni link. */
publicRouter.get('/events/:slug/gallery', async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { slug: req.params.slug },
      select: {
        slug: true,
        name: true,
        eventDate: true,
        clientNames: true,
        images: {
          where: { status: 'approved' },
          orderBy: { uploadedAt: 'desc' },
          select: { id: true, filePath: true, thumbPath: true, width: true, height: true, uploadedAt: true },
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event nije pronađen' });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

/** Javna galerija za landing — slike označene za javni prikaz. */
publicRouter.get('/gallery', async (_req, res, next) => {
  try {
    const images = await prisma.eventImage.findMany({
      where: { status: 'approved', inPublicGallery: true, event: { isPublicGallery: true } },
      orderBy: { uploadedAt: 'desc' },
      take: 48,
      select: {
        id: true,
        thumbPath: true,
        filePath: true,
        width: true,
        height: true,
        event: { select: { name: true, clientNames: true } },
      },
    });
    res.json(images);
  } catch (err) {
    next(err);
  }
});

// ===============================================================
// Pozivnice + RSVP (guest)
// ===============================================================

/** Javna pozivnica po slug-u. */
publicRouter.get('/invites/:slug', async (req, res, next) => {
  try {
    const invite = await prisma.invite.findUnique({
      where: { slug: req.params.slug },
      select: {
        slug: true,
        variant: true,
        title: true,
        hostNames: true,
        date: true,
        time: true,
        location: true,
        message: true,
        coverImagePath: true,
        weddingDetails: true,
        schedule: {
          orderBy: { sortOrder: 'asc' },
          select: { time: true, title: true, location: true },
        },
      },
    });
    if (!invite) return res.status(404).json({ error: 'Pozivnica nije pronađena' });
    res.json(invite);
  } catch (err) {
    next(err);
  }
});

/** Gost šalje RSVP — rate limit dijeli s orderLimiter (5/min/IP). */
publicRouter.post(
  '/invites/:slug/rsvp',
  orderLimiter,
  validate(createRsvpSchema),
  async (req, res, next) => {
    try {
      const invite = await prisma.invite.findUnique({
        where: { slug: req.params.slug },
        select: { id: true },
      });
      if (!invite) return res.status(404).json({ error: 'Pozivnica nije pronađena' });

      await prisma.rsvp.create({
        data: {
          inviteId: invite.id,
          name: req.body.name,
          phone: req.body.phone || null,
          attending: req.body.attending,
          plusOnes: req.body.plusOnes,
          note: req.body.note || null,
        },
      });
      res.status(201).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// ===============================================================
// Raspored sjedenja (guest)
// ===============================================================

publicRouter.get('/events/:slug/tables', async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { slug: req.params.slug },
      select: {
        name: true,
        clientNames: true,
        eventDate: true,
        tables: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, label: true, type: true, guests: true },
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event nije pronađen' });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

/** Gostova status stranica — publicId (nanoid) je autorizacija sam po sebi. */
publicRouter.get('/orders/:publicId', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { publicId: req.params.publicId },
      include: { items: true, venue: { select: { name: true, currency: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Narudžba nije pronađena' });
    res.json({ ...toOrderDTO(order), venueName: order.venue.name, currency: order.venue.currency });
  } catch (err) {
    next(err);
  }
});
