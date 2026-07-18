import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

// Next.js 16 renamed `middleware.ts`/`middleware()` to `proxy.ts`/`proxy()`.
// This only does a fast cookie-presence redirect for UX; the actual session/DB
// validity check happens per-request via getCurrentUser() in route handlers
// and server components, since proxy should stay a lightweight routing gate.
const PROTECTED_PREFIXES = ['/app'];
const AUTH_PAGES = ['/login', '/register'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value;

  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.includes(pathname) && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/app';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/login', '/register'],
};
