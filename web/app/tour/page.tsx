import Link from 'next/link';
import { cookies } from 'next/headers';
import {
  SCHEME_COOKIE,
  STYLE_COOKIE,
  SchemeToggle,
  StyleToggle,
  resolveScheme,
  resolveStyle,
  TourNotes,
  TourWindow,
  resolveShellView,
} from '@demo-kit/shell';
import { TOUR } from '../../lib/tour';
import { DEMO_NAME } from '../../lib/demo';

/**
 * The tour: the demo shell, at its own address.
 *
 * It used to be the landing page, and the product lived at `/app`. That was the kit's default and it
 * had the priority backwards for this demo: everything a visitor is being shown is the workbench, and
 * making them meet a device frame first put a picture of the product where the product should be. The
 * workbench is now the application at the root and this is a stop on the way, not the front door.
 *
 * A reader arriving at the root meets the product framed and explained rather than dropped
 * into it with no idea what they are looking at. The product itself lives at `/` and
 * carries none of this.
 *
 * `link` is `next/link`, so changing step, device or mode is a soft navigation that reframes
 * the window instead of reloading the app inside it.
 */

/**
 * The product URL the window frames.
 *
 * Written here rather than taken from the kit's `productHref`, which resolves to the kit's own
 * `PRODUCT = '/app'`. This demo's product is the site, so its root is the thing to frame — and the
 * kit is right for every demo that keeps the split, so this is an override rather than a fix.
 */
function freeModeHref(): string {
  return '/?view=inner&shell=free';
}

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

  return (
    <TourWindow
      src={
        view.mode === 'free'
          ? freeModeHref()
          : view.step.href
      }
      title={DEMO_NAME}
      view={view}
      link={Link}
      /* In the control bar rather than the notes: `notes` is guided-only, so a reader who
         switched to free view had no treatment controls at all. */
      controls={
        <>
          <SchemeToggle scheme={scheme} />
          <StyleToggle style={style} />
        </>
      }
      notes={<TourNotes tour={TOUR} view={view} link={Link} />}
    />
  );
}
