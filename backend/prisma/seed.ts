import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

function requiredEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.startsWith('CHANGE_ME')) {
    console.error(`❌ Postavi ${key} u .env prije seed-a (bez default lozinki!)`);
    process.exit(1);
  }
  return val;
}

async function main() {
  const superadminEmail = requiredEnv('SEED_SUPERADMIN_EMAIL');
  const superadminPassword = requiredEnv('SEED_SUPERADMIN_PASSWORD');
  const clientEmail = requiredEnv('SEED_DEMO_CLIENT_EMAIL');
  const clientPassword = requiredEnv('SEED_DEMO_CLIENT_PASSWORD');

  const superadmin = await prisma.user.upsert({
    where: { email: superadminEmail },
    update: {},
    create: {
      email: superadminEmail,
      name: 'Administrator',
      role: 'superadmin',
      passwordHash: await bcrypt.hash(superadminPassword, 12),
    },
  });

  const client = await prisma.user.upsert({
    where: { email: clientEmail },
    update: {},
    create: {
      email: clientEmail,
      name: 'Demo Kafić',
      role: 'client',
      passwordHash: await bcrypt.hash(clientPassword, 12),
    },
  });

  // Demo venue s popunjenim menijem — da svaka stranica ima šta prikazati
  let venue = await prisma.venue.findFirst({ where: { ownerUserId: client.id } });
  if (!venue) {
    venue = await prisma.venue.create({
      data: {
        slug: nanoid(12),
        ownerUserId: client.id,
        name: 'Caffe Demo',
        address: 'Ferhadija 12, Sarajevo',
        phone: '+387 61 000 000',
        currency: 'BAM',
        defaultLang: 'bs',
        theme: { primaryColor: '#D4AF37', backgroundColor: '#0f0f0f', textColor: '#fdfbf7', mode: 'dark' },
      },
    });

    const menu = await prisma.menu.create({
      data: { venueId: venue.id, name: 'Glavni meni' },
    });

    const categories = [
      {
        name: 'Topli napici',
        kind: 'drink' as const,
        items: [
          { name: 'Espresso', price: '2.50', description: 'Klasični italijanski espresso' },
          { name: 'Cappuccino', price: '3.50', description: 'Espresso s mliječnom pjenom' },
          { name: 'Bosanska kafa', price: '3.00', description: 'Tradicionalno servirana uz rahat lokum', isFeatured: true },
          { name: 'Čaj (voćni/zeleni/crni)', price: '2.50' },
        ],
      },
      {
        name: 'Hladni napici',
        kind: 'drink' as const,
        items: [
          { name: 'Cijeđena narandža', price: '4.50', description: 'Svježe cijeđena', isFeatured: true },
          { name: 'Limunada', price: '3.50', description: 'Domaća limunada s mentom' },
          { name: 'Coca-Cola / Fanta / Sprite', price: '3.00' },
          { name: 'Negazirana voda 0.33', price: '2.00' },
        ],
      },
      {
        name: 'Doručak',
        kind: 'food' as const,
        items: [
          { name: 'Omlet sa sirom', price: '6.50', description: 'Tri jaja, mladi sir, tost' },
          { name: 'Uštipci sa kajmakom', price: '5.50', description: 'Domaći uštipci, kajmak, ajvar', isFeatured: true },
          { name: 'Tost sendvič', price: '5.00', description: 'Šunka, sir, povrće' },
          { name: 'Palačinke (nutella/džem/med)', price: '5.50', discountPercent: 10 },
        ],
      },
    ];

    for (const [ci, cat] of categories.entries()) {
      const category = await prisma.menuCategory.create({
        data: { menuId: menu.id, name: cat.name, kind: cat.kind, sortOrder: ci },
      });
      for (const [ii, item] of cat.items.entries()) {
        await prisma.menuItem.create({
          data: {
            categoryId: category.id,
            name: item.name,
            description: item.description,
            price: item.price,
            isFeatured: item.isFeatured ?? false,
            discountPercent: item.discountPercent,
            sortOrder: ii,
          },
        });
      }
    }
  }

  // Demo osoblje: konobar + kuhinja za demo kafić
  const staffAccounts = [
    { email: 'konobar@specialday.ba', name: 'Konobar Demo', staffRole: 'waiter' as const },
    { email: 'kuhinja@specialday.ba', name: 'Kuhinja Demo', staffRole: 'kitchen' as const },
  ];
  for (const account of staffAccounts) {
    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: account.email,
          name: account.name,
          role: 'staff',
          // ista demo lozinka kao klijent — SAMO za lokalni razvoj
          passwordHash: await bcrypt.hash(clientPassword, 12),
          staffOf: { create: { venueId: venue.id, role: account.staffRole } },
        },
      });
      console.log(`   osoblje:    ${account.email} (${account.staffRole})`);
    }
  }

  // Demo event za galeriju/pozivnice/sjedenje
  let event = await prisma.event.findFirst({ where: { ownerUserId: superadmin.id } });
  if (!event) {
    event = await prisma.event.create({
      data: {
        slug: nanoid(12),
        ownerUserId: superadmin.id,
        name: 'Demo Vjenčanje',
        eventDate: new Date('2026-09-12'),
        clientNames: 'Amina & Emir',
      },
    });
  }

  console.log('✅ Seed gotov:');
  console.log(`   superadmin: ${superadmin.email}`);
  console.log(`   klijent:    ${client.email}`);
  console.log(`   venue:      ${venue.name}  → /m/${venue.slug}`);
  console.log(`   event:      ${event.name}  → /g/${event.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
