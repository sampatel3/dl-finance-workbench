import type { MetadataRoute } from 'next';
import { demoManifest } from '@demo-kit/shell';
import {
  DEMO_BACKGROUND_COLOR,
  DEMO_DESCRIPTION,
  DEMO_ICON_BACKGROUND,
  DEMO_NAME,
  DEMO_SHORT_NAME,
} from '../lib/demo';

/**
 * Installable as an app. Added to a phone's home screen the demo opens without browser
 * chrome, which is the difference between showing someone a website and showing them a
 * product.
 *
 * The return type is Next's; the value comes from the kit, which declares the shape itself
 * rather than depending on Next. Assigning one to the other is the assertion that the two
 * agree — if Next changes the manifest type, this line stops compiling.
 */

export default function manifest(): MetadataRoute.Manifest {
  return demoManifest({
    name: DEMO_NAME,
    shortName: DEMO_SHORT_NAME,
    description: DEMO_DESCRIPTION,
    backgroundColor: DEMO_BACKGROUND_COLOR,
    themeColor: DEMO_ICON_BACKGROUND,
  });
}
