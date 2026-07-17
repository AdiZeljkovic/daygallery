/**
 * Uvoz POZIVNICA (+RSVP, raspored dana, cover slika) i STOLOVA iz starog
 * day-gallery sistema (Cloudflare Pages + D1 + R2).
 *
 * Zašto zaseban skript: import-daygallery.ts ima funkciju importEventsAndInvites(),
 * ali ona uvozi SAMO evente — pozivnice i stolovi nikad nisu bili implementirani.
 *
 * VAŽNO: day-gallery.com sada pokazuje na NOVI sistem, pa se stari API dohvaća
 * preko *.pages.dev (isti obrazac kao import-reviews.ts).
 *
 *   npx tsx scripts/import-invites.ts
 *   OLD_API_BASE=https://day-gallery.pages.dev npx tsx scripts/import-invites.ts
 *
 * Idempotentno — preskače već uvezeno (po legacyId), dopunjava legacyId ako fali.
 * Stolovi se vežu na event preko event.legacyId (event mora biti prethodno uvezen).
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { nanoid } from 'nanoid';
import { processImage } from '../src/services/imageService.js';

const BASE = process.env.OLD_API_BASE ?? 'https://day-gallery.pages.dev';

interface OldRsvp {
  name?: string;
  phone?: string | null;
  attending?: number | boolean;
  plusOnes?: number;
  notes?: string | null;
  timestamp?: number;
}
interface OldScheduleItem {
  time?: string;
  title?: string;
  location?: string | null;
}
interface OldInvite {
  id: string;
  names?: string | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  message?: string | null;
  event_id?: string | null;
  coverImage?: string | null;
  weddingDetails?: unknown;
  isWedding?: number | boolean;
  rsvps?: OldRsvp[];
  schedule?: OldScheduleItem[];
}
interface OldTable {
  id: string;
  event_id?: string | null;
  eventId?: string | null;
  number?: string | null;
  type?: string | null;
  guests?: string | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Skida sliku sa R2 i propušta kroz sharp pipeline. */
async function importImage(url: string | null | undefined, subdir: string) {
  if (!url || !url.startsWith('http')) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`    ⚠ cover ${res.status}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return null;
    return await processImage(buf, subdir, { maxDim: 2000 });
  } catch (e) {
    console.log(`    ⚠ cover greška: ${(e as Error).message}`);
    return null;
  }
}

// ── Pozivnice ───────────────────────────────────────────────────────────
async function importInvites() {
  const list = await get<OldInvite[]>('/api/invites');
  console.log(`\n=== POZIVNICE: ${list.length} ===`);
  let created = 0;
  let skipped = 0;

  for (const inv of list) {
    const legacyId = String(inv.id);
    const existing = await prisma.invite.findUnique({ where: { legacyId } });
    if (existing) {
      console.log(`↷ već uvezena: ${inv.names || legacyId}  →  /i/${existing.slug}`);
      skipped++;
      continue;
    }

    // stari event_id → novi event (ako pozivnica pripada galeriji)
    let eventId: number | null = null;
    if (inv.event_id) {
      const ev = await prisma.event.findUnique({
        where: { legacyId: String(inv.event_id) },
        select: { id: true },
      });
      eventId = ev?.id ?? null;
    }

    const names = (inv.names || '').trim() || 'Pozivnica';
    const isWedding = inv.isWedding === 1 || inv.isWedding === true;

    const invite = await prisma.invite.create({
      data: {
        slug: nanoid(12),
        legacyId,
        eventId,
        variant: isWedding ? 'wedding' : 'standard',
        title: names,
        hostNames: names,
        date: inv.date ? new Date(inv.date) : null,
        time: inv.time || null,
        location: inv.location || null,
        message: inv.message || null,
        weddingDetails: (inv.weddingDetails as object) ?? undefined,
      },
    });

    // cover slika (R2 → webp)
    const cover = await importImage(inv.coverImage, `invites/${invite.id}`);
    if (cover) {
      await prisma.invite.update({
        where: { id: invite.id },
        data: { coverImagePath: cover.filePath },
      });
    }

    // raspored dana
    const schedule = Array.isArray(inv.schedule) ? inv.schedule : [];
    for (const [i, s] of schedule.entries()) {
      if (!s?.title) continue;
      await prisma.inviteScheduleItem.create({
        data: {
          inviteId: invite.id,
          time: String(s.time ?? '').slice(0, 10),
          title: String(s.title).slice(0, 150),
          location: s.location ? String(s.location).slice(0, 200) : null,
          sortOrder: i,
        },
      });
    }

    // RSVP odgovori (stvarni gosti — najosjetljiviji dio)
    const rsvps = Array.isArray(inv.rsvps) ? inv.rsvps : [];
    for (const r of rsvps) {
      if (!r?.name) continue;
      await prisma.rsvp.create({
        data: {
          inviteId: invite.id,
          name: String(r.name).slice(0, 100),
          phone: r.phone ? String(r.phone).slice(0, 50) : null,
          attending: r.attending === 1 || r.attending === true,
          plusOnes: Number(r.plusOnes) || 0,
          note: r.notes ? String(r.notes).slice(0, 500) : null,
          ...(r.timestamp ? { createdAt: new Date(Number(r.timestamp)) } : {}),
        },
      });
    }

    created++;
    console.log(
      `✓ ${names}  →  /i/${invite.slug}   (raspored: ${schedule.length}, RSVP: ${rsvps.length}${cover ? ', cover ✓' : ''})`
    );
  }
  console.log(`— pozivnice: ${created} novih, ${skipped} preskočeno`);
}

// ── Stolovi ─────────────────────────────────────────────────────────────
async function importTables() {
  const list = await get<OldTable[]>('/api/tables');
  console.log(`\n=== STOLOVI: ${list.length} ===`);
  let created = 0;
  let skipped = 0;
  let orphan = 0;

  // grupiši po starom eventu radi sortOrder i preglednog ispisa
  const byEvent = new Map<string, OldTable[]>();
  for (const t of list) {
    const ev = String(t.event_id ?? t.eventId ?? '');
    if (!ev) continue;
    if (!byEvent.has(ev)) byEvent.set(ev, []);
    byEvent.get(ev)!.push(t);
  }

  for (const [legacyEventId, tables] of byEvent) {
    const event = await prisma.event.findUnique({
      where: { legacyId: legacyEventId },
      select: { id: true, name: true },
    });
    if (!event) {
      console.log(`⚠ event ${legacyEventId} nije uvezen — preskačem ${tables.length} stolova`);
      orphan += tables.length;
      continue;
    }

    for (const [i, t] of tables.entries()) {
      const label = String(t.number ?? '').trim() || String(i + 1);
      // idempotentno: isti event + isti label = već uvezen
      const exists = await prisma.seatingTable.findFirst({
        where: { eventId: event.id, label },
        select: { id: true },
      });
      if (exists) {
        skipped++;
        continue;
      }
      await prisma.seatingTable.create({
        data: {
          eventId: event.id,
          label: label.slice(0, 20),
          type: t.type === 'vip' ? 'vip' : 'normal',
          guests: t.guests ? String(t.guests) : null,
          sortOrder: i,
        },
      });
      created++;
    }
    console.log(`• ${event.name}: ${tables.length} stolova obrađeno`);
  }
  console.log(`— stolovi: ${created} novih, ${skipped} preskočeno, ${orphan} bez eventa`);
}

async function main() {
  console.log('Izvor:', BASE);
  await importInvites();
  await importTables();
  console.log('\n✔ Gotovo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
