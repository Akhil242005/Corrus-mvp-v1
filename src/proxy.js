import { NextResponse } from 'next/server';

export function proxy(request) {
  const { pathname } = request.nextUrl;

  const appMode = process.env.APP_MODE;

  // If APP_MODE is not set, default to allowing all routes (local development convenience)
  if (!appMode) {
    return NextResponse.next();
  }

  // 1. CANDIDATE MODE
  if (appMode === 'candidate') {
    const isAllowed =
      pathname === '/' ||
      pathname === '/oauth-success' ||
      pathname.startsWith('/auth/') ||
      pathname === '/dashboard' ||
      pathname.startsWith('/dashboard/') ||
      pathname.startsWith('/api/auth/') ||
      pathname === '/api/login' ||
      pathname === '/api/register' ||
      pathname === '/api/profile' ||
      pathname === '/api/submissions' ||
      pathname.startsWith('/api/submissions/') ||
      pathname === '/api/competitions' ||
      pathname.startsWith('/api/competitions/') ||
      pathname === '/api/webhooks/github';

    if (!isAllowed) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 });
      }
      return NextResponse.rewrite(new URL('/_not-found', request.url));
    }
  }

  // 2. COMPANY MODE
  if (appMode === 'company') {
    const isAllowed =
      pathname === '/company-auth' ||
      pathname.startsWith('/company-auth/') ||
      pathname === '/oauth-success' ||
      pathname === '/company' ||
      pathname.startsWith('/company/') ||
      pathname.startsWith('/api/company/') ||
      pathname === '/api/webhooks/github';

    if (!isAllowed) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 });
      }
      return NextResponse.rewrite(new URL('/_not-found', request.url));
    }
  }

  // 3. ADMIN MODE
  if (appMode === 'admin') {
    const isAllowed =
      pathname === '/admin' ||
      pathname.startsWith('/admin/') ||
      pathname.startsWith('/api/admin/');

    if (!isAllowed) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 });
      }
      return NextResponse.rewrite(new URL('/_not-found', request.url));
    }
  }

  return NextResponse.next();
}

// Optimize execution by filtering out static files and assets early
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, logo.png, etc. (static public directory files)
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
