import { legacyRedirect } from '@/lib/legacyRedirect';

/** Stari: /tables?eventId=<id> → /s/<slug> (raspored sjedenja) */
export default async function LegacyTables({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string; id?: string }>;
}) {
  const { eventId, id } = await searchParams;
  return legacyRedirect('tables', eventId ?? id, (slug) => `/s/${slug}`);
}
