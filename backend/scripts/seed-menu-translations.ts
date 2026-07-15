/**
 * Upisuje prevode menija u bazu (idempotentno, upsert po (id, lang)).
 * Čita scripts/menu-translations.json — fajl koji generiše developer nakon
 * export-menu-content.ts (prevede sav tekst na de/it/es/fr/tr/ar/en).
 *
 * Pokretanje na serveru iz platform/backend:
 *   npx tsx scripts/seed-menu-translations.ts
 *
 * Format menu-translations.json:
 * {
 *   "categories": { "12": { "en": "Drinks", "de": "Getränke", ... }, ... },
 *   "items":      { "84": { "en": { "name": "...", "description": "..." }, ... }, ... }
 * }
 * (Prazni/nepostojeći jezici se preskaču. "bs" je osnovni tekst — ne upisuje se ovdje.)
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/lib/prisma.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TransFile {
  categories?: Record<string, Record<string, string>>;
  items?: Record<string, Record<string, { name?: string; description?: string }>>;
}

async function main() {
  const path = join(__dirname, 'menu-translations.json');
  if (!existsSync(path)) {
    throw new Error(`Nema ${path}. Prvo pokreni export-menu-content.ts pa generiši prevode.`);
  }
  const data = JSON.parse(readFileSync(path, 'utf8')) as TransFile;

  let cat = 0;
  let item = 0;

  for (const [id, byLang] of Object.entries(data.categories ?? {})) {
    const categoryId = Number(id);
    for (const [lang, name] of Object.entries(byLang)) {
      if (lang === 'bs' || !name?.trim()) continue;
      await prisma.menuCategoryTranslation.upsert({
        where: { categoryId_lang: { categoryId, lang } },
        update: { name: name.trim() },
        create: { categoryId, lang, name: name.trim() },
      });
      cat++;
    }
  }

  for (const [id, byLang] of Object.entries(data.items ?? {})) {
    const itemId = Number(id);
    for (const [lang, val] of Object.entries(byLang)) {
      if (lang === 'bs' || !val?.name?.trim()) continue;
      const description = val.description?.trim() || null;
      await prisma.menuItemTranslation.upsert({
        where: { itemId_lang: { itemId, lang } },
        update: { name: val.name.trim(), description },
        create: { itemId, lang, name: val.name.trim(), description },
      });
      item++;
    }
  }

  console.log(`✔ Upisano ${cat} prevoda kategorija i ${item} prevoda artikala.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
