import { NextResponse, type NextRequest } from 'next/server';
import { GATE_COOKIE, gateDecision } from '@demo-kit/gate';

/**
 * The passcode gate, and the only Next-aware code it needs. `@demo-kit/gate` takes plain
 * values and returns a decision; this file turns a NextRequest into the one and the answer
 * back into a NextResponse.
 *
 * With no `DEMO_PASSCODE` set there is no gate at all, so a fresh checkout runs with no
 * setup. `/api/health` is exempt inside the package, because the deploy verifier polls it
 * and has no cookie.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const decision = gateDecision({
    pathname,
    search,
    hasCookie: req.cookies.has(GATE_COOKIE),
  });
  if (decision.allowed) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = decision.gatePath;
  url.search = '';
  url.searchParams.set('next', decision.next);
  return NextResponse.redirect(url);
}

/**
 * Next reads this by static analysis, so the literal has to be written out here rather than
 * imported from the package. `public/` is deliberately inside it: the hosted deck lives
 * there and is gated by the same cookie with no extra wiring.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
