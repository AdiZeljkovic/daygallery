import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const AUTH_COOKIE = 'sd_token';

export default function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Legacy: stari day-gallery je uploadu pristupao preko naslovnice
  // (/?eventId=X ili /?eventId=X&table=Y) — preusmjeri na legacy upload resolver.
  const rootMatch = pathname === '/' || pathname === '/bs' || pathname === '/en';
  const eventId = searchParams.get('eventId');
  if (rootMatch && eventId) {
    const url = req.nextUrl.clone();
    url.pathname = '/upload';
    url.searchParams.delete('eventId');
    url.searchParams.set('id', eventId);
    return NextResponse.redirect(url);
  }

  // Guard za admin rute: bez tokena → login.
  // (Prava validacija tokena je na API-ju; ovo je samo UX preusmjeravanje.)
  const adminMatch = pathname.match(/^(?:\/(bs|en))?\/admin(?!\/login)(\/|$)/);
  if (adminMatch && !req.cookies.get(AUTH_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = `${adminMatch[1] ? `/${adminMatch[1]}` : ''}/admin/login`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
