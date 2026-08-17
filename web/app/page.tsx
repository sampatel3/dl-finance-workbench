import Link from 'next/link';
import { cookies } from 'next/headers';
import {
  LIGHTNESS_COOKIE,
  SCHEME_COOKIE,
  STYLE_COOKIE,
  LightnessToggle,
  SchemeToggle,
  StyleToggle,
  resolveLightness,
  resolveScheme,
  resolveStyle,
  TourNotes,
  TourWindow,
  resolveShellView,
  productHref,
} from '@demo-kit/shell';
import { TOUR } from '../lib/tour';
import { DEMO_NAME } from '../lib/demo';

/**
 * The landing page is the demo shell, not the product.
 *
 * A reader arriving at the root meets the product framed and explained rather than dropped into
 * it with no idea what they are looking at. The product itself lives at `PRODUCT` and carries
 * none of this.
 *
 * This was inverted for a while — the workbench at the root, the tour parked at `/tour` — on the
 * reasoning that a visitor should meet the product rather than a picture of it. What that missed
 * is that the kit builds every one of the tour's own links from `SHELL`, which is `/`. With the
 * product there, the first click on Next or a device button left the tour entirely, `escapeFrame`
 * matched the product's own links and threw them to `_top`, and the scheme and style toggles —
 * which live in this page's control bar — could not be reached at all. Nothing linked to `/tour`
 * either, so the whole thing was unreachable and would not have survived being reached.
 *
 * `link` is `next/link`, so changing step, device or mode is a soft navigation that reframes the
 * window instead of reloading the app inside it.
 */

export const dynamic = 'force-dynamic';

export default async function Shell({
  searchParams,
}: {
  searchParams: Promise<{
    step?: string;
    mode?: string;
    device?: string;
    month?: string;
  }>;
}) {
  const params = await searchParams;
  const view = resolveShellView(TOUR, params);
  const jar = await cookies();
  const scheme = resolveScheme(jar.get(SCHEME_COOKIE)?.value ?? 'deeplight');
  const style = resolveStyle(jar.get(STYLE_COOKIE)?.value);
  /* Resolved the SAME WAY as in `layout.tsx`, env fallback included, or the picker shows pressed
     something the page is not wearing — which is a control a reader would reasonably call broken. */
  const lightness = resolveLightness(
    jar.get(LIGHTNESS_COOKIE)?.value,
    resolveLightness(process.env.DEMO_LIGHTNESS),
  );

  return (
    <TourWindow
      src={view.mode === 'free' ? productHref({ view: 'inner', shell: 'free' }) : view.step.href}
      title={DEMO_NAME}
      view={view}
      link={Link}
      /* In the control bar rather than the notes: `notes` is guided-only, so a reader who
         switched to free view had no treatment controls at all. */
      controls={
        <>
          <SchemeToggle scheme={scheme} />
          <StyleToggle style={style} />
          <LightnessToggle lightness={lightness} />
        </>
      }
      notes={<TourNotes tour={TOUR} view={view} link={Link} />}
    />
  );
}
