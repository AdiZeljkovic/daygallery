import { legacyRedirect } from '@/lib/legacyRedirect';

/** Stari QR po stolovima: day-gallery.com/menu?id=<stariMenuId> → /m/<slug> */
export default async function LegacyMenu({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return legacyRedirect('menu', id, (slug) => `/m/${slug}`);
}
