import { legacyRedirect } from '@/lib/legacyRedirect';

/** Stari: /upload?id=<eventId> (i /e/[id]) → /g/<slug> (guest upload) */
export default async function LegacyUpload({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; eventId?: string }>;
}) {
  const { id, eventId } = await searchParams;
  return legacyRedirect('upload', id ?? eventId, (slug) => `/g/${slug}`);
}
