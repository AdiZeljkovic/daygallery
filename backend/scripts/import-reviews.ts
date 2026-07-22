/**
 * Jednokratni uvoz recenzije-kampanja iz starog day-gallery sistema (Cloudflare
 * Pages + D1 + R2).
 *
 * VAŽNO: stara domena day-gallery.com sada pokazuje na NOVI sistem, pa se stari
 * API više NE MOŽE dohvatiti preko nje. Zato je izvor konfigurabilan:
 *
 *  A) Stari Pages deployment je još živ (najlakše):
 *       OLD_REVIEWS_API=https://day-gallery.pages.dev/api/reviews \
 *         npx tsx scripts/import-reviews.ts
 *
 *  B) Pages ugašen → izvezi iz D1 pa uvezi iz fajla:
 *       npx wrangler d1 execute day-gallery-db --remote \
 *         --command "SELECT * FROM reviews" --json > scripts/reviews.json
 *       npx tsx scripts/import-reviews.ts        (automatski nađe scripts/reviews.json)
 *
 * Idempotentno — preskače kampanje koje već postoje (po nazivu).
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { nanoid } from 'nanoid';
import { prisma } from '../src/lib/prisma.js';
import { processImage } from '../src/services/imageService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Stari Cloudflare Pages projekat se zove "day-gallery" → *.pages.dev
const OLD_API = process.env.OLD_REVIEWS_API ?? 'https://day-gallery.pages.dev/api/reviews';
// Stari Cloudflare sistem se gasi — arhiva u legacy-data/ je primarni izvor.
const ARCHIVE_DIR = join(__dirname, 'legacy-data');
const LOCAL_FILE = existsSync(join(ARCHIVE_DIR, 'reviews.json'))
  ? join(ARCHIVE_DIR, 'reviews.json')
  : join(__dirname, 'reviews.json');

interface OldReview {
  id?: string; // stari D1 id — čuva se kao legacyId (podijeljeni /recenzije?id=... linkovi)
  name: string;
  logoImage?: string | null;
  googleReviewLink?: string | null;
  protectionEnabled?: number | boolean;
}

/** Izvuče niz recenzija iz D1 `wrangler --json` izlaza ili običnog niza. */
function normalize(raw: unknown): OldReview[] {
  if (Array.isArray(raw)) {
    // wrangler --json → [{ results: [...] }]
    if (raw.length && typeof raw[0] === 'object' && raw[0] !== null && 'results' in raw[0]) {
      return (raw[0] as { results: OldReview[] }).results ?? [];
    }
    return raw as OldReview[];
  }
  if (raw && typeof raw === 'object' && 'results' in raw) {
    return (raw as { results: OldReview[] }).results ?? [];
  }
  return [];
}

async function loadReviews(): Promise<OldReview[]> {
  // 1) lokalni izvoz iz D1 ima prednost (radi i kad je Pages ugašen)
  if (existsSync(LOCAL_FILE)) {
    console.log(`Čitam lokalni izvoz: ${LOCAL_FILE}`);
    return normalize(JSON.parse(readFileSync(LOCAL_FILE, 'utf8')));
  }
  // 2) stari API
  console.log('Dohvaćam recenzije sa', OLD_API, '...');
  const res = await fetch(OLD_API);
  if (!res.ok) {
    throw new Error(
      `Stari API vratio ${res.status}. ` +
        `Ako je stari Pages ugašen, izvezi iz D1 u scripts/reviews.json (vidi vrh fajla).`
    );
  }
  return normalize(await res.json());
}

async function main() {
  const list = await loadReviews();
  console.log(`Pronađeno ${list.length} kampanja.\n`);
  if (!list.length) {
    console.log('Ništa za uvoz — provjeri izvor (OLD_REVIEWS_API ili scripts/reviews.json).');
    return;
  }

  let imported = 0;
  let backfilled = 0;
  for (const r of list) {
    const name = String(r.name ?? '').trim();
    if (!name) continue;
    const legacyId = r.id ? String(r.id) : null;

    // već uvezeno? (po legacyId, pa po nazivu — za ranije uvoze bez legacyId)
    const existing =
      (legacyId ? await prisma.reviewCampaign.findUnique({ where: { legacyId } }) : null) ??
      (await prisma.reviewCampaign.findFirst({ where: { name } }));

    if (existing) {
      // dopuni legacyId ako fali → stari /recenzije?id=... linkovi prorade
      if (legacyId && !existing.legacyId) {
        await prisma.reviewCampaign.update({ where: { id: existing.id }, data: { legacyId } });
        backfilled++;
        console.log(`↻ dopunjen legacyId: ${name}  →  /r/${existing.slug}`);
      } else {
        console.log(`↷ preskačem (već postoji): ${name}`);
      }
      continue;
    }

    const campaign = await prisma.reviewCampaign.create({
      data: {
        slug: nanoid(10),
        legacyId,
        name,
        googleReviewUrl: r.googleReviewLink || null,
        gateEnabled: r.protectionEnabled === 1 || r.protectionEnabled === true,
      },
    });

    // logo — prvo iz lokalne arhive (R2 se gasi), pa R2 kao rezerva
    if (r.logoImage) {
      try {
        const archived = join(
          ARCHIVE_DIR,
          'images',
          r.logoImage.replace(/.*r2\.dev\//, '').replace(/\//g, '_').replace(/[^A-Za-z0-9._-]/g, '')
        );
        const buf = existsSync(archived)
          ? readFileSync(archived)
          : await fetch(r.logoImage).then(async (res) =>
              res.ok ? Buffer.from(await res.arrayBuffer()) : null
            );
        if (buf) {
          const processed = await processImage(buf, `reviews/${campaign.id}`, {
            maxDim: 512,
            quality: 82,
          });
          await prisma.reviewCampaign.update({
            where: { id: campaign.id },
            data: { logoPath: processed.filePath },
          });
        } else {
          console.log('  (logo nije dostupan ni u arhivi ni na R2)');
        }
      } catch (e) {
        console.log(`  (logo greška: ${e instanceof Error ? e.message : e})`);
      }
    }

    imported++;
    console.log(`✓ uvezeno: ${name}  →  /r/${campaign.slug}`);
  }

  console.log(`\n✔ Gotovo. Uvezeno ${imported} novih, dopunjeno ${backfilled} postojećih (legacyId).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
