import { legacyRedirect } from '@/lib/legacyRedirect';

/** Stari: /gallery?id=<eventId> → /gallery/<slug> */
export default async function LegacyGallery({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return legacyRedirect('gallery', id, (slug) => `/gallery/${slug}`);
}
