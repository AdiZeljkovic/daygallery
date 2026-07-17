import { redirect } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Server-side: stari day-gallery ID → novi slug → redirect na novu rutu.
 * Koristi se u legacy stranicama koje hvataju stare QR/link oblike.
 * `newPath(slug)` gradi odredišni URL (npr. (slug) => `/m/${slug}`).
 */
export async function legacyRedirect(
  type: 'menu' | 'gallery' | 'upload' | 'tables' | 'invite' | 'review',
  id: string | undefined,
  newPath: (slug: string) => string
): Promise<never> {
  let slug: string | null = null;

  if (id) {
    try {
      const res = await fetch(`${API}/api/public/legacy/${type}/${encodeURIComponent(id)}`, {
        cache: 'no-store',
      });
      if (res.ok) slug = ((await res.json()) as { slug: string }).slug;
    } catch {
      // mreža/backend nedostupan → fallback ispod
    }
  }

  // VAŽNO: redirect() baca NEXT_REDIRECT — mora biti IZVAN try/catch,
  // inače catch proguta preusmjeravanje.
  redirect(slug ? newPath(slug) : '/');
}
