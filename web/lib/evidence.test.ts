import { describe, expect, it } from 'vitest';

import { measureEvidenceHref } from './evidence';
import { viewOf } from './world';

describe('measure evidence links', () => {
  it('preserves the full reporting identity and opens the cited-measure summary', () => {
    const view = viewOf({
      period: 'quarter',
      month: '2026-06',
      comparator: 'budget',
      lens: 'constant',
    });
    const url = new URL(measureEvidenceHref('ebitda', view), 'https://demo.invalid');

    expect(url.pathname).toBe('/app/explore');
    expect(url.searchParams.get('period')).toBe('quarter');
    expect(url.searchParams.get('month')).toBe('2026-06');
    expect(url.searchParams.get('comparator')).toBe('budget');
    expect(url.searchParams.get('lens')).toBe('constant');
    expect(url.searchParams.get('measure')).toBe('ebitda');
    expect(url.searchParams.get('focus')).toBe('section-cited-measure');
  });
});
