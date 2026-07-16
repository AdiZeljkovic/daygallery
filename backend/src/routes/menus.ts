import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  createCategorySchema,
  updateCategorySchema,
  createItemSchema,
  updateItemSchema,
} from '@platform/shared';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireVenueAccess, resolveVenueAccess } from '../middleware/venueAccess.js';
import { HttpError } from '../middleware/errorHandler.js';
import { imageUpload, processImage, deleteImageFiles } from '../services/imageService.js';

export const menusRouter = Router();
menusRouter.use(requireAuth);

/**
 * Pravo uređivanja kroz lanac: menu/category/item → venue.
 * Uređivati smiju superadmin, vlasnik (Šef) i manager osoblje.
 */
async function assertOwnership(
  req: Request,
  level: 'menu' | 'category' | 'item',
  id: number
): Promise<void> {
  let venueId: number | undefined;
  if (level === 'menu') {
    const row = await prisma.menu.findUnique({ where: { id }, select: { venueId: true } });
    venueId = row?.venueId;
  } else if (level === 'category') {
    const row = await prisma.menuCategory.findUnique({
      where: { id },
      select: { menu: { select: { venueId: true } } },
    });
    venueId = row?.menu.venueId;
  } else {
    const row = await prisma.menuItem.findUnique({
      where: { id },
      select: { category: { select: { menu: { select: { venueId: true } } } } },
    });
    venueId = row?.category.menu.venueId;
  }

  if (venueId === undefined) throw new HttpError(404, 'Nije pronađeno');
  // artikli se uređuju i iz Inventara (stanje) — dovoljan je bilo koji od ta dva modula
  const modules: ('menu' | 'inventory')[] = level === 'item' ? ['menu', 'inventory'] : ['menu'];
  const access = await resolveVenueAccess(req.user!, venueId, ['manager'], modules);
  if (!access) throw new HttpError(403, 'Nemate pristup ovom resursu');
}

const idParam = (req: Request, name = 'id'): number => {
  const id = Number(req.params[name]);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Neispravan ID');
  return id;
};

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

// ---------------------------------------------------------------
// Meni (tree za editor) — auto-kreira glavni meni ako ne postoji
// ---------------------------------------------------------------

menusRouter.get(
  '/venues/:id/menu',
  requireVenueAccess(), // čitanje: i osoblje (inventar prikaz)
  wrap(async (req, res) => {
    const venueId = idParam(req);
    // Prevodi se uključuju SAMO za editor (?translations=1). Inventar/kolo ih ne
    // trebaju — bez njih payload je višestruko manji (7 jezika × svaki artikal).
    const withTranslations = req.query.translations === '1';
    const menuInclude = {
      categories: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          translations: withTranslations,
          items: {
            orderBy: { sortOrder: 'asc' as const },
            include: { translations: withTranslations },
          },
        },
      },
    };

    let menu = await prisma.menu.findFirst({
      where: { venueId, isActive: true },
      include: menuInclude,
    });

    if (!menu) {
      await prisma.menu.create({ data: { venueId, name: 'Glavni meni' } });
      menu = await prisma.menu.findFirst({
        where: { venueId, isActive: true },
        include: menuInclude,
      });
    }
    res.json(menu);
  })
);

// ---------------------------------------------------------------
// Kategorije
// ---------------------------------------------------------------

menusRouter.post(
  '/menus/:menuId/categories',
  validate(createCategorySchema),
  wrap(async (req, res) => {
    const menuId = idParam(req, 'menuId');
    await assertOwnership(req, 'menu', menuId);

    const count = await prisma.menuCategory.count({ where: { menuId } });
    const category = await prisma.menuCategory.create({
      data: { ...req.body, menuId, sortOrder: req.body.sortOrder || count },
    });
    res.status(201).json(category);
  })
);

menusRouter.patch(
  '/categories/:id',
  validate(updateCategorySchema),
  wrap(async (req, res) => {
    const id = idParam(req);
    await assertOwnership(req, 'category', id);

    const { translations, ...data } = req.body;
    const category = await prisma.menuCategory.update({ where: { id }, data });

    if (translations) {
      for (const t of translations) {
        await prisma.menuCategoryTranslation.upsert({
          where: { categoryId_lang: { categoryId: id, lang: t.lang } },
          update: { name: t.name },
          create: { categoryId: id, lang: t.lang, name: t.name },
        });
      }
    }
    res.json(category);
  })
);

menusRouter.delete(
  '/categories/:id',
  wrap(async (req, res) => {
    const id = idParam(req);
    await assertOwnership(req, 'category', id);

    const items = await prisma.menuItem.findMany({
      where: { categoryId: id },
      select: { imagePath: true },
    });
    await prisma.menuCategory.delete({ where: { id } });
    await deleteImageFiles(...items.map((i) => i.imagePath));
    res.json({ success: true });
  })
);

// ---------------------------------------------------------------
// Artikli
// ---------------------------------------------------------------

menusRouter.post(
  '/categories/:id/items',
  validate(createItemSchema),
  wrap(async (req, res) => {
    const categoryId = idParam(req);
    await assertOwnership(req, 'category', categoryId);

    const count = await prisma.menuItem.count({ where: { categoryId } });
    const item = await prisma.menuItem.create({
      data: {
        ...req.body,
        description: req.body.description || null,
        categoryId,
        sortOrder: req.body.sortOrder || count,
      },
    });
    res.status(201).json(item);
  })
);

menusRouter.patch(
  '/items/:id',
  validate(updateItemSchema),
  wrap(async (req, res) => {
    const id = idParam(req);
    await assertOwnership(req, 'item', id);

    const { translations, ...data } = req.body;
    if (data.description === '') (data as Record<string, unknown>).description = null;

    const item = await prisma.menuItem.update({ where: { id }, data });

    if (translations) {
      for (const t of translations) {
        await prisma.menuItemTranslation.upsert({
          where: { itemId_lang: { itemId: id, lang: t.lang } },
          update: { name: t.name, description: t.description || null },
          create: { itemId: id, lang: t.lang, name: t.name, description: t.description || null },
        });
      }
    }
    res.json(item);
  })
);

menusRouter.delete(
  '/items/:id',
  wrap(async (req, res) => {
    const id = idParam(req);
    await assertOwnership(req, 'item', id);

    const item = await prisma.menuItem.delete({ where: { id } });
    await deleteImageFiles(item.imagePath);
    res.json({ success: true });
  })
);

// ---------------------------------------------------------------
// Slika artikla
// ---------------------------------------------------------------

menusRouter.post(
  '/items/:id/image',
  imageUpload.single('image'),
  wrap(async (req, res) => {
    const id = idParam(req);
    await assertOwnership(req, 'item', id);
    if (!req.file) throw new HttpError(400, 'Slika nedostaje');

    const item = await prisma.menuItem.findUnique({
      where: { id },
      select: {
        imagePath: true,
        category: { select: { menu: { select: { venueId: true } } } },
      },
    });
    if (!item) throw new HttpError(404, 'Artikal nije pronađen');

    const processed = await processImage(
      req.file.buffer,
      `venues/${item.category.menu.venueId}/items`,
      { maxDim: 1000 }
    );
    await deleteImageFiles(item.imagePath, item.imagePath?.replace('.webp', '_thumb.webp'));

    const updated = await prisma.menuItem.update({
      where: { id },
      data: { imagePath: processed.filePath },
    });
    res.json(updated);
  })
);

menusRouter.delete(
  '/items/:id/image',
  wrap(async (req, res) => {
    const id = idParam(req);
    await assertOwnership(req, 'item', id);

    const item = await prisma.menuItem.findUnique({ where: { id }, select: { imagePath: true } });
    await deleteImageFiles(item?.imagePath, item?.imagePath?.replace('.webp', '_thumb.webp'));
    const updated = await prisma.menuItem.update({ where: { id }, data: { imagePath: null } });
    res.json(updated);
  })
);

// ---------------------------------------------------------------
// Logo objekta
// ---------------------------------------------------------------

menusRouter.post(
  '/venues/:id/logo',
  requireVenueAccess(['manager']),
  imageUpload.single('image'),
  wrap(async (req, res) => {
    const venueId = idParam(req);
    if (!req.file) throw new HttpError(400, 'Slika nedostaje');

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { logoPath: true },
    });
    const processed = await processImage(req.file.buffer, `venues/${venueId}/branding`, {
      maxDim: 600,
    });
    await deleteImageFiles(venue?.logoPath, venue?.logoPath?.replace('.webp', '_thumb.webp'));

    const updated = await prisma.venue.update({
      where: { id: venueId },
      data: { logoPath: processed.filePath },
    });
    res.json(updated);
  })
);

// ---------------------------------------------------------------
// Pozadinska slika menija — čuva se u theme JSON-u (branding)
// ---------------------------------------------------------------

menusRouter.post(
  '/venues/:id/background',
  requireVenueAccess(['manager']),
  imageUpload.single('image'),
  wrap(async (req, res) => {
    const venueId = idParam(req);
    if (!req.file) throw new HttpError(400, 'Slika nedostaje');

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { theme: true },
    });
    const theme = (venue?.theme as Record<string, unknown> | null) ?? {};
    const oldBg = typeof theme.backgroundImagePath === 'string' ? theme.backgroundImagePath : null;

    const processed = await processImage(req.file.buffer, `venues/${venueId}/branding`, {
      maxDim: 2400,
      quality: 72,
    });
    await deleteImageFiles(oldBg, oldBg?.replace('.webp', '_thumb.webp'));

    const updated = await prisma.venue.update({
      where: { id: venueId },
      data: { theme: { ...theme, backgroundImagePath: processed.filePath } },
    });
    res.json(updated);
  })
);

// ---------------------------------------------------------------
// Promo slika (baner na vrhu menija)
// ---------------------------------------------------------------

menusRouter.post(
  '/venues/:id/promo',
  requireVenueAccess(['manager']),
  imageUpload.single('image'),
  wrap(async (req, res) => {
    const venueId = idParam(req);
    if (!req.file) throw new HttpError(400, 'Slika nedostaje');

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { promoImagePath: true },
    });
    const processed = await processImage(req.file.buffer, `venues/${venueId}/branding`, {
      maxDim: 1600,
      quality: 78,
    });
    await deleteImageFiles(venue?.promoImagePath, venue?.promoImagePath?.replace('.webp', '_thumb.webp'));

    const updated = await prisma.venue.update({
      where: { id: venueId },
      data: { promoImagePath: processed.filePath },
    });
    res.json(updated);
  })
);

menusRouter.delete(
  '/venues/:id/promo',
  requireVenueAccess(['manager']),
  wrap(async (req, res) => {
    const venueId = idParam(req);
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { promoImagePath: true },
    });
    await deleteImageFiles(venue?.promoImagePath, venue?.promoImagePath?.replace('.webp', '_thumb.webp'));
    const updated = await prisma.venue.update({
      where: { id: venueId },
      data: { promoImagePath: null },
    });
    res.json(updated);
  })
);
