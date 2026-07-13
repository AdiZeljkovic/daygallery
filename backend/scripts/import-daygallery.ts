/**
 * Migracija produkcijskih podataka sa starog day-gallery sistema.
 * Povlači slike sa R2 kroz naš sharp pipeline, čuva stari ID (legacyId)
 * da odštampani QR kodovi (/menu?id=<legacyId>) nastave raditi.
 *
 * Idempotentno: ponovni run preskače već uvezene resurse (po legacyId).
 * Pokretanje:  npx tsx scripts/import-daygallery.ts <putanja-do-json-foldera>
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { processImage } from '../src/services/imageService.js';

const prisma = new PrismaClient();
const DIR = process.argv[2];
if (!DIR || !fs.existsSync(path.join(DIR, 'menus.json'))) {
  console.error('Koristi: npx tsx scripts/import-daygallery.ts <folder-sa-json>');
  process.exit(1);
}

const read = (f: string) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

// Mapiranje starih menija na vlasnike (email + generisana lozinka za Šefa)
const OWNER_EMAILS: Record<string, string> = {
  'Bistro Boss': 'boss@day-gallery.com',
  'ĆEVABDŽINICA ZMAJ STANICA SARAJEVO': 'zmaj@day-gallery.com',
  'Gradska kavana Arsenal Restaurant': 'arsenal@day-gallery.com',
  'Gastro pub Vučko Malta': 'vucko@day-gallery.com',
  'Restoran Dženita': 'dzenita@day-gallery.com',
};

const createdCredentials: { name: string; email: string; password: string }[] = [];

/** Skida sliku sa R2 i propušta kroz sharp pipeline; vraća obrađenu sliku ili null. */
async function importImage(url: string | undefined | null, subdir: string, maxDim: number) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`    ⚠ slika ${res.status}: ${url.slice(-40)}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return null;
    return await processImage(buf, subdir, { maxDim });
  } catch (e) {
    console.warn(`    ⚠ slika greška: ${(e as Error).message}`);
    return null;
  }
}

async function ensureOwner(menuName: string) {
  const email = OWNER_EMAILS[menuName] ?? `${nanoid(6)}@day-gallery.com`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const password = `Sef${nanoid(8)}`;
  const user = await prisma.user.create({
    data: {
      email,
      name: menuName,
      role: 'client',
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  createdCredentials.push({ name: menuName, email, password });
  return user;
}

const kindFromGroup = (group: unknown): 'food' | 'drink' =>
  group === 'pica' ? 'drink' : 'food';

async function importMenus() {
  const menus = read('menus.json');
  console.log(`\n=== MENIJI: ${menus.length} ===`);

  for (const m of menus) {
    const existing = await prisma.venue.findUnique({ where: { legacyId: m.id } });
    if (existing) {
      console.log(`\n• ${m.name} — već uvezen (preskačem)`);
      continue;
    }

    console.log(`\n• ${m.name}`);
    const owner = await ensureOwner(m.name);

    // theme: stari theme može biti string ('dark') ili JSON — koristimo naš default + brend
    let theme: Prisma.InputJsonValue = {
      primaryColor: '#d4af37',
      backgroundColor: '#0c0b09',
      textColor: '#f5f1e8',
      mode: 'dark',
    };

    const venue = await prisma.venue.create({
      data: {
        slug: nanoid(12),
        legacyId: m.id,
        ownerUserId: owner.id,
        name: m.name,
        currency: m.currency || 'BAM',
        defaultLang: m.baseLanguage || 'bs',
        phone: m.contactPhone || null,
        googleReviewUrl: m.googleReviewLink || null,
        reviewGateEnabled: !!m.googleReviewProtectionEnabled,
        theme,
      },
    });

    // logo + pozadina
    const logo = await importImage(m.logoImage, `venues/${venue.id}/branding`, 600);
    const logoPath = logo?.filePath ?? null;
    const bg = await importImage(m.backgroundImage, `venues/${venue.id}/branding`, 2400);
    const bgPath = bg?.filePath ?? null;
    if (logoPath || bgPath) {
      await prisma.venue.update({
        where: { id: venue.id },
        data: {
          logoPath,
          theme: { ...(theme as object), ...(bgPath ? { backgroundImagePath: bgPath } : {}) },
        },
      });
    }

    const menu = await prisma.menu.create({ data: { venueId: venue.id, name: 'Glavni meni' } });

    let cats: any[] = [];
    try {
      cats = JSON.parse(m.categories || '[]');
    } catch {
      console.warn('    ⚠ neispravan categories JSON');
    }

    let itemCount = 0;
    let imgCount = 0;
    for (const [ci, c] of cats.entries()) {
      const category = await prisma.menuCategory.create({
        data: {
          menuId: menu.id,
          name: c.name || 'Bez naziva',
          kind: kindFromGroup(c.group),
          sortOrder: ci,
        },
      });

      for (const [ii, item] of (c.items || []).entries()) {
        const img = await importImage(item.image, `venues/${venue.id}/items`, 1000);
        const imagePath = img?.filePath ?? null;
        if (imagePath) imgCount++;

        const price = Number(item.price) || 0;
        const discount =
          item.discount && Number(item.discount) > 0 ? Math.min(99, Number(item.discount)) : null;

        await prisma.menuItem.create({
          data: {
            categoryId: category.id,
            name: String(item.name || 'Bez naziva').slice(0, 150),
            description: item.description ? String(item.description).slice(0, 500) : null,
            price: new Prisma.Decimal(price.toFixed(2)),
            discountPercent: discount,
            isFeatured: !!item.isFeatured,
            imagePath,
            sortOrder: ii,
          },
        });
        itemCount++;
      }
      process.stdout.write(`    ${category.name}: ${(c.items || []).length} art\r`);
    }
    console.log(`    ✓ ${cats.length} kategorija, ${itemCount} artikala, ${imgCount} slika       `);
  }
}

async function importEventsAndInvites() {
  // Eventi (galerije)
  const events = read('events.json');
  console.log(`\n=== GALERIJE: ${events.length} ===`);
  for (const e of events) {
    const existing = await prisma.event.findUnique({ where: { legacyId: e.id } });
    if (existing) {
      console.log(`• ${e.name} — već uvezen`);
      continue;
    }
    // vlasnik galerije: zaseban klijent nalog po eventu
    const email = `${nanoid(6)}@day-gallery.com`;
    const password = `Gal${nanoid(8)}`;
    const owner = await prisma.user.create({
      data: {
        email,
        name: e.name || 'Galerija',
        role: 'client',
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    createdCredentials.push({ name: `Galerija: ${e.name}`, email, password });

    const event = await prisma.event.create({
      data: {
        slug: nanoid(12),
        legacyId: e.id,
        ownerUserId: owner.id,
        name: e.name || 'Galerija',
        clientNames: e.clientNames || null,
        eventDate: e.date ? new Date(e.date) : null,
        isPublicGallery: !!e.isPublicGallery,
      },
    });

    let imgCount = 0;
    for (const img of e.images || []) {
      const processed = await importImage(img.url, `events/${event.id}/gallery`, 2000);
      if (!processed) continue;
      await prisma.eventImage.create({
        data: {
          eventId: event.id,
          filePath: processed.filePath,
          thumbPath: processed.thumbPath,
          width: processed.width,
          height: processed.height,
          bytes: processed.bytes,
          status: img.approved ? 'approved' : 'pending',
          inPublicGallery: !!img.isPublicGallery,
        },
      });
      imgCount++;
    }
    console.log(`• ${e.name}: ${imgCount} slika`);
  }

  // Recenzije (review funnel)
  const reviews = read('reviews.json');
  console.log(`\n=== RECENZIJE: ${reviews.length} (info — vežu se za venue po potrebi) ===`);
  for (const r of reviews) console.log(`• ${r.name}`);
}

async function main() {
  await importMenus();
  await importEventsAndInvites();

  console.log('\n\n════════════════════════════════════════════');
  console.log('  KREIRANI NALOZI (sačuvaj — Šefovi restorana):');
  console.log('════════════════════════════════════════════');
  for (const c of createdCredentials) {
    console.log(`  ${c.name}`);
    console.log(`    email:   ${c.email}`);
    console.log(`    lozinka: ${c.password}\n`);
  }
  if (createdCredentials.length === 0) console.log('  (svi već postojali — ništa novo)');

  // spremi kredencijale u fajl za svaki slučaj
  fs.writeFileSync(
    path.join(DIR, 'kreirani-nalozi.json'),
    JSON.stringify(createdCredentials, null, 2)
  );
  console.log(`\n  Nalozi spremljeni i u: ${path.join(DIR, 'kreirani-nalozi.json')}`);
}

main()
  .catch((e) => {
    console.error('GREŠKA:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
