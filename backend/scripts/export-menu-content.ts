/**
 * Izvozi sav tekst menija (nazivi + opisi kategorija i artikala) u JSON,
 * da se može prevesti i vratiti kroz seed-menu-translations.ts.
 *
 * Pokretanje na serveru iz platform/backend:
 *   npx tsx scripts/export-menu-content.ts
 *
 * Rezultat: scripts/menu-content.json  (pošalji ga nazad developeru na prevod)
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/lib/prisma.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const categories = await prisma.menuCategory.findMany({
    orderBy: { id: 'asc' },
    include: { items: { orderBy: { id: 'asc' } } },
  });

  const out = {
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    items: categories.flatMap((c) =>
      c.items.map((i) => ({ id: i.id, name: i.name, description: i.description ?? '' }))
    ),
  };

  const path = join(__dirname, 'menu-content.json');
  writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
  console.log(
    `✔ Izvezeno ${out.categories.length} kategorija i ${out.items.length} artikala → ${path}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
