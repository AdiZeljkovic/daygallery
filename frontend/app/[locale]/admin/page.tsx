import { redirect } from 'next/navigation';

/**
 * Index /admin — preusmjeri na dashboard.
 * (Neulogovane middleware već šalje na /admin/login; ulogovani su ranije
 * dobijali 404 jer /admin nije imao stranicu.)
 */
export default async function AdminIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(locale === 'en' ? '/en/admin/dashboard' : '/admin/dashboard');
}
