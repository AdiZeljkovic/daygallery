import { legacyRedirect } from '@/lib/legacyRedirect';

/** Stari podijeljeni link: day-gallery.com/recenzije?id=<stariReviewId> → /r/<slug> */
export default async function LegacyRecenzije({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return legacyRedirect('review', id, (slug) => `/r/${slug}`);
}
