import { describe, expect, it } from 'vitest';

import { MONTHS, monthScope, priorYearScope } from '@kestrel/model';
import { computeMeasure } from '@kestrel/measures';

import { deterministicOverviewNarration, overviewRevenueSeries } from './overview';
import { contextOf, scopeLabel, viewOf } from './world';

describe('Overview revenue trend follows the selected through-month', () => {
  it('ends at a historical selected month and never reads later closed months', () => {
    const view = viewOf({ month: '2026-04' });
    const series = overviewRevenueSeries(contextOf(view), MONTHS, view.through);

    expect(series).toHaveLength(12);
    expect(series.at(-1)?.month).toBe('2026-04');
    expect(series.map((point) => point.month)).not.toContain('2026-05');
    expect(series.map((point) => point.month)).not.toContain('2026-07');
  });

  it('returns the available history when fewer than twelve months precede the boundary', () => {
    const view = viewOf({ month: MONTHS[2] });
    const series = overviewRevenueSeries(contextOf(view), MONTHS, view.through);

    expect(series.map((point) => point.month)).toEqual(MONTHS.slice(0, 3));
  });

  it('re-bases the constant-currency comparison for every month in the window', () => {
    const view = viewOf({ month: '2026-04', lens: 'constant' });
    const ctx = contextOf(view);
    const series = overviewRevenueSeries(ctx, MONTHS, view.through);
    const first = series[0];
    expect(first).toBeDefined();

    const scope = monthScope(first!.month);
    const comparativeScope = priorYearScope(scope);
    const pointContext = { ...ctx, scope, comparativeScope };

    expect(first).toMatchObject({
      value: computeMeasure('revenue', pointContext).value,
      comparative: computeMeasure('revenue', {
        ...pointContext,
        scope: comparativeScope,
        lens: 'reported',
        comparativeScope: undefined,
      }).value,
    });
  });
});

describe('Overview narration follows the selected reporting identity', () => {
  it('states a non-default period and comparator instead of reusing the monthly cache', () => {
    const view = viewOf({
      period: 'half_year',
      month: '2026-06',
      comparator: 'prior_year',
    });
    const narration = deterministicOverviewNarration(view);

    expect(`${narration.headline} ${narration.body}`).toContain(
      scopeLabel(view.periodKind, view.scope),
    );
    expect(narration.body).toContain('against the same window a year earlier, actual');
  });

  it('recomputes figures when the selected window changes', () => {
    const month = deterministicOverviewNarration(
      viewOf({ period: 'month', month: '2026-06', comparator: 'budget' }),
    );
    const quarter = deterministicOverviewNarration(
      viewOf({ period: 'quarter', month: '2026-06', comparator: 'budget' }),
    );

    expect(month.body).not.toBe(quarter.body);
    expect(month.body).toContain('Jun 2026');
    expect(quarter.body).toContain('Q2 2026');
  });
});
