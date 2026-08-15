import Link from 'next/link';
import { cookies } from 'next/headers';
import {
  SKIN_COOKIE,
  SCHEME_COOKIE,
  STYLE_COOKIE,
  SchemeToggle,
  SkinToggle,
  StyleToggle,
  resolveScheme,
  resolveStyle,
  TourNotes,
  TourWindow,
  productHref,
  resolveShellView,
} from '@demo-kit/shell';
import { TOUR } from '../lib/tour';
import { DEMO_NAME } from '../lib/demo';
import { resolveWorkbenchSkin } from '../lib/skin';

/**
 * The landing page is the demo shell, not the product.
 *
 * A reader arriving at the root meets the product framed and explained rather than dropped
 * into it with no idea what they are looking at. The product itself lives at `/app` and
 * carries none of this.
 *
 * `link` is `next/link`, so changing step, device or mode is a soft navigation that reframes
 * the window instead of reloading the app inside it.
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
  const skin = resolveWorkbenchSkin(jar.get(SKIN_COOKIE)?.value);
  const scheme = resolveScheme(jar.get(SCHEME_COOKIE)?.value ?? 'deeplight');
  const style = resolveStyle(jar.get(STYLE_COOKIE)?.value);

  return (
    <TourWindow
      src={
        view.mode === 'free'
          ? productHref({ view: 'inner', shell: 'free' })
          : view.step.href
      }
      title={DEMO_NAME}
      view={view}
      skin={skin}
      link={Link}
      /* In the control bar rather than the notes: `notes` is guided-only, so a reader who
         switched to free view had no treatment controls at all. */
      controls={
        <>
          <SkinToggle skin={skin} />
          <SchemeToggle scheme={scheme} />
          <StyleToggle style={style} />
        </>
      }
      notes={<TourNotes tour={TOUR} view={view} link={Link} />}
    />
  );
}
