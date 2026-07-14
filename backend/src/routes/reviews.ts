import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import { createReviewCampaignSchema, updateReviewCampaignSchema } from '@platform/shared';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { imageUpload, processImage, deleteImageFiles } from '../services/imageService.js';

export const reviewsRouter = Router();

// Cijeli modul je superadmin-only.
reviewsRouter.use(requireAuth, requireRole('superadmin'));

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const idParam = (req: Request) => Number(req.params.id);

/** Lista kampanja + broj žalbi. */
reviewsRouter.get(
  '/reviews',
  wrap(async (_req, res) => {
    const campaigns = await prisma.reviewCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { feedback: true } } },
    });
    res.json(campaigns);
  })
);

/** Detalj kampanje + žalbe (ocjene < 4). */
reviewsRouter.get(
  '/reviews/:id',
  wrap(async (req, res) => {
    const campaign = await prisma.reviewCampaign.findUnique({
      where: { id: idParam(req) },
      include: { feedback: { orderBy: { createdAt: 'desc' }, take: 200 } },
    });
    if (!campaign) throw new HttpError(404, 'Recenzija nije pronađena');
    res.json(campaign);
  })
);

/** Kreiranje kampanje. */
reviewsRouter.post(
  '/reviews',
  validate(createReviewCampaignSchema),
  wrap(async (req, res) => {
    const campaign = await prisma.reviewCampaign.create({
      data: {
        slug: nanoid(10),
        name: req.body.name,
        googleReviewUrl: req.body.googleReviewUrl || null,
        gateEnabled: req.body.gateEnabled ?? true,
      },
    });
    res.status(201).json(campaign);
  })
);

/** Izmjena kampanje. */
reviewsRouter.patch(
  '/reviews/:id',
  validate(updateReviewCampaignSchema),
  wrap(async (req, res) => {
    const data: Record<string, unknown> = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.googleReviewUrl !== undefined)
      data.googleReviewUrl = req.body.googleReviewUrl || null;
    if (req.body.gateEnabled !== undefined) data.gateEnabled = req.body.gateEnabled;

    const campaign = await prisma.reviewCampaign.update({
      where: { id: idParam(req) },
      data,
    });
    res.json(campaign);
  })
);

/** Brisanje kampanje (+ slika). */
reviewsRouter.delete(
  '/reviews/:id',
  wrap(async (req, res) => {
    const campaign = await prisma.reviewCampaign.findUnique({
      where: { id: idParam(req) },
      select: { logoPath: true },
    });
    await deleteImageFiles(campaign?.logoPath, campaign?.logoPath?.replace('.webp', '_thumb.webp'));
    await prisma.reviewCampaign.delete({ where: { id: idParam(req) } });
    res.json({ success: true });
  })
);

/** Upload logotipa. */
reviewsRouter.post(
  '/reviews/:id/logo',
  imageUpload.single('image'),
  wrap(async (req, res) => {
    const id = idParam(req);
    if (!req.file) throw new HttpError(400, 'Slika nedostaje');

    const campaign = await prisma.reviewCampaign.findUnique({
      where: { id },
      select: { logoPath: true },
    });
    const processed = await processImage(req.file.buffer, `reviews/${id}`, {
      maxDim: 512,
      quality: 82,
    });
    await deleteImageFiles(campaign?.logoPath, campaign?.logoPath?.replace('.webp', '_thumb.webp'));

    const updated = await prisma.reviewCampaign.update({
      where: { id },
      data: { logoPath: processed.filePath },
    });
    res.json(updated);
  })
);

/** Uklanjanje logotipa. */
reviewsRouter.delete(
  '/reviews/:id/logo',
  wrap(async (req, res) => {
    const id = idParam(req);
    const campaign = await prisma.reviewCampaign.findUnique({
      where: { id },
      select: { logoPath: true },
    });
    await deleteImageFiles(campaign?.logoPath, campaign?.logoPath?.replace('.webp', '_thumb.webp'));
    const updated = await prisma.reviewCampaign.update({
      where: { id },
      data: { logoPath: null },
    });
    res.json(updated);
  })
);
