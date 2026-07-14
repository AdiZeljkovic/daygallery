/**
 * Jednokratni uvoz recenzije-kampanja iz starog day-gallery sistema.
 * Pokretanje na serveru iz platform/backend:
 *   npx tsx scripts/import-reviews.ts
 * Idempotentno — preskače kampanje koje već postoje (po nazivu).
 */
import 'dotenv/config';
import { nanoid } from 'nanoid';
import { prisma } from '../src/lib/prisma.js';
import { processImage } from '../src/services/imageService.js';

const OLD_API = 'https://day-gallery.com/api/reviews';

interface OldReview {
  name: string;
  logoImage?: string | null;
  googleReviewLink?: string | null;
  protectionEnabled?: number | boolean;
}

async function main() {
  console.log('Dohvaćam recenzije sa', OLD_API, '...');
  const res = await fetch(OLD_API);
  if (!res.ok) throw new Error(`Stari API vratio ${res.status}`);
  const list = (await res.json()) as OldReview[];
  console.log(`Pronađeno ${list.length} kampanja.\n`);

  for (const r of list) {
    const name = String(r.name ?? '').trim();
    if (!name) continue;

    const existing = await prisma.reviewCampaign.findFirst({ where: { name } });
    if (existing) {
      console.log(`↷ preskačem (već postoji): ${name}`);
      continue;
    }

    const campaign = await prisma.reviewCampaign.create({
      data: {
        slug: nanoid(10),
        name,
        googleReviewUrl: r.googleReviewLink || null,
        gateEnabled: r.protectionEnabled === 1 || r.protectionEnabled === true,
      },
    });

    // logo (preuzmi sa R2, obradi u webp, spremi)
    if (r.logoImage) {
      try {
        const imgRes = await fetch(r.logoImage);
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const processed = await processImage(buf, `reviews/${campaign.id}`, {
            maxDim: 512,
            quality: 82,
          });
          await prisma.reviewCampaign.update({
            where: { id: campaign.id },
            data: { logoPath: processed.filePath },
          });
        } else {
          console.log(`  (logo nije preuzet — HTTP ${imgRes.status})`);
        }
      } catch (e) {
        console.log(`  (logo greška: ${e instanceof Error ? e.message : e})`);
      }
    }

    console.log(`✓ uvezeno: ${name}  →  /r/${campaign.slug}`);
  }

  await prisma.$disconnect();
  console.log('\nGotovo.');
}

main().catch(async (e) => {
  console.error('Greška:', e);
  await prisma.$disconnect();
  process.exit(1);
});
