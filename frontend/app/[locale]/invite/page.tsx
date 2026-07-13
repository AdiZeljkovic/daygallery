import { legacyRedirect } from '@/lib/legacyRedirect';

/** Stari: /invite?id=<inviteId> → /i/<slug> */
export default async function LegacyInvite({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; inviteId?: string }>;
}) {
  const { id, inviteId } = await searchParams;
  return legacyRedirect('invite', id ?? inviteId, (slug) => `/i/${slug}`);
}
