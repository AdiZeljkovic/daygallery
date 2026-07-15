/**
 * Jednokratni uvoz korisnika iz starog day-gallery sistema u novu bazu.
 * Pokretanje na serveru iz platform/backend:
 *   npx tsx scripts/import-users.ts
 *
 * Šta radi:
 *  - povuče stare korisnike sa day-gallery.pages.dev/api/admin/users
 *  - preskače 'admin' (superadmin već postoji u novom sistemu)
 *  - kreira svakog kao role=client, email = <username>@day-gallery.com,
 *    lozinka = bcrypt(stara plaintext lozinka) → mogu se odmah prijaviti istom lozinkom
 *  - poveže objekte: stari allowedMenus (legacy menu id) → Venue.legacyId → ownerUserId
 *  Idempotentno — ako korisnik (email) već postoji, ne duplira, samo (re)dodijeli objekte.
 *
 * ⚠️ Stare lozinke su bile JAVNO vidljive → reci korisnicima da ih promijene nakon prijave.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/services/authService.js';

const OLD_API = 'https://day-gallery.pages.dev/api/admin/users';
const EMAIL_DOMAIN = 'day-gallery.com';

interface OldUser {
  username: string;
  password: string;
  allowedMenus?: string[];
}

async function main() {
  console.log('Dohvaćam korisnike sa', OLD_API, '...');
  const res = await fetch(OLD_API);
  if (!res.ok) throw new Error(`Stari API vratio ${res.status}`);
  const list = (await res.json()) as OldUser[];
  console.log(`Pronađeno ${list.length} korisnika.\n`);

  for (const u of list) {
    const username = String(u.username ?? '').trim();
    if (!username) continue;
    if (username.toLowerCase() === 'admin') {
      console.log('↷ preskačem "admin" (superadmin već postoji)');
      continue;
    }

    const email = `${username.toLowerCase()}@${EMAIL_DOMAIN}`;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: username,
          role: 'client',
          passwordHash: await hashPassword(String(u.password ?? '')),
        },
      });
      console.log(`✓ kreiran korisnik: ${email}  (lozinka: ${u.password})`);
    } else {
      console.log(`↷ korisnik već postoji: ${email}`);
    }

    // Poveži objekte preko starog menu ID-a
    for (const legacyId of u.allowedMenus ?? []) {
      const venue = await prisma.venue.findUnique({
        where: { legacyId },
        select: { id: true, name: true, ownerUserId: true },
      });
      if (!venue) {
        console.log(`   (objekt za legacyId ${legacyId} nije pronađen u novoj bazi)`);
        continue;
      }
      if (venue.ownerUserId === user.id) {
        console.log(`   = već vlasnik: ${venue.name}`);
        continue;
      }
      await prisma.venue.update({ where: { id: venue.id }, data: { ownerUserId: user.id } });
      console.log(`   → dodijeljen objekt: ${venue.name}`);
    }
  }

  await prisma.$disconnect();
  console.log('\nGotovo. Reci korisnicima da promijene lozinku (bile su javne).');
}

main().catch(async (e) => {
  console.error('Greška:', e);
  await prisma.$disconnect();
  process.exit(1);
});
