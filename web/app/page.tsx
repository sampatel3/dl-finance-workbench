import Link from 'next/link';
import { cookies } from 'next/headers';
import {
  SKIN_COOKIE,
  SkinToggle,
  TourNotes,
  TourWindow,
  productHref,
  resolveShellView,
  resolveSkin,
} from '@demo-kit/shell';
import { SURFACE_NOTES, TOUR } from '../lib/tour';
import { DEMO_NAME } from '../lib/demo';

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
    screen?: string;
    month?: string;
  }>;
}) {
  const view = resolveShellView(TOUR, await searchParams);
  const skin = resolveSkin((await cookies()).get(SKIN_COOKIE)?.value);

  return (
    <TourWindow
      src={view.mode === 'free' ? productHref({ view: 'inner' }) : view.step.href}
      title={DEMO_NAME}
      view={view}
      skin={skin}
      link={Link}
      surfaceNotes={SURFACE_NOTES}
      notes={
        <>
          <TourNotes tour={TOUR} view={view} link={Link} />
          {/* The treatment control is demo furniture, so it sits with the notes rather than
              on the product, which carries none. */}
          <div className="skin-row">
            <span>Surface</span>
            <SkinToggle skin={skin} />
          </div>
        </>
      }
    />
  );
}
