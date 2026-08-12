import { NextResponse } from 'next/server';
import { submitPasscode } from '@demo-kit/gate';

/**
 * The passcode check.
 *
 * `nodejs`, not Edge, and that is not a preference: the attempt limiter is module-level
 * memory, and Edge middleware runs before this route in a different runtime where the
 * accept/reject outcome is not yet known. The placement is the design.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const form = await request.formData();
  const result = submitPasscode({
    supplied: String(form.get('passcode') ?? ''),
    next: String(form.get('next') ?? '/'),
    /* The limiter is per IP, and this header is the only one a demo behind Vercel can trust;
       anything x-forwarded-for shaped is caller-supplied. */
    ip: request.headers.get('x-real-ip') ?? 'unknown',
  });

  if (result.outcome !== 'accepted') {
    const url = new URL('/gate', request.url);
    url.searchParams.set('next', result.next);
    url.searchParams.set('error', result.outcome === 'blocked' ? 'blocked' : 'wrong');
    if (result.retryAfterMs > 0) {
      url.searchParams.set('retry', String(Math.ceil(result.retryAfterMs / 1000)));
    }
    return NextResponse.redirect(url, { status: 303 });
  }

  const res = NextResponse.redirect(new URL(result.next, request.url), { status: 303 });
  res.cookies.set(result.cookie.name, result.cookie.value, result.cookie.options);
  return res;
}
