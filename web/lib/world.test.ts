import { describe, expect, it } from 'vitest';

import { computeMeasure } from '@kestrel/measures';

import { contextOf, scopeLabel, viewOf } from './world';

describe('view period scopes', () => {
  it('stops an in-progress quarter at the selected through-month', () => {
    const view = viewOf({ period: 'quarter', month: '2026-07' });

    expect(view.scope).toMatchObject({
      type: 'QUARTER',
      startMonth: '2026-07',
      endMonth: '2026-07',
    });
    expect(scopeLabel(view.periodKind, view.scope)).toBe('Q3 2026 through Jul 2026');
    expect(() => computeMeasure('revenue', contextOf(view))).not.toThrow();
  });

  it('keeps a completed quarter as its full three-month window', () => {
    const view = viewOf({ period: 'quarter', month: '2026-06' });

    expect(view.scope).toMatchObject({
      type: 'QUARTER',
      startMonth: '2026-04',
      endMonth: '2026-06',
    });
    expect(scopeLabel(view.periodKind, view.scope)).toBe('Q2 2026');
  });
});
