import { ImageResponse } from 'next/og';
import { iconElement, resolveIcon } from '@demo-kit/shell';
import { DEMO_ICON_BACKGROUND, DEMO_MARK } from '../../lib/demo';

/**
 * The app icon, drawn rather than stored — so it can never drift from the mark in the header
 * or on the gate. `?size=` picks the size the manifest asked for; `?pad=1` insets the mark
 * for a maskable crop.
 *
 * The route is on the gate's exemption list, together with the manifest: an icon that
 * redirects to the passcode page makes add-to-home-screen fail on every demo, and neither
 * the mark nor the manifest discloses anything the gate page does not already show.
 */

export const runtime = 'nodejs';

export function GET(request: Request) {
  const icon = resolveIcon(request.url);
  return new ImageResponse(
    iconElement({ text: DEMO_MARK, background: DEMO_ICON_BACKGROUND }, icon),
    { width: icon.size, height: icon.size },
  );
}
