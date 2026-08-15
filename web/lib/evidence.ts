import type { SegmentCode } from '@kestrel/model';
import type { ComparatorId } from '@kestrel/measures';

import type { View } from './world';
import { hrefFor } from './world';

/** A URL that opens the exact cited measure summary plus its supporting time-series grid and drill. */
export function measureEvidenceHref(
  measureId: string,
  view: View,
  options: { readonly comparatorId?: ComparatorId; readonly segmentId?: SegmentCode } = {},
): string {
  const origin = 'https://finance-workbench.invalid';
  const url = new URL(
    hrefFor(
      '/explore',
      view,
      options.comparatorId === undefined ? {} : { comparator: options.comparatorId },
    ),
    origin,
  );
  url.searchParams.set('rows', 'measure');
  url.searchParams.set('cols', 'period');
  url.searchParams.set('measure', measureId);
  if (options.segmentId !== undefined) url.searchParams.set('segment', options.segmentId);
  url.searchParams.set('focus', 'section-cited-measure');
  return `${url.pathname}${url.search}`;
}
