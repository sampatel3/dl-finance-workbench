/**
 * The indexed trend, and the two claims it makes.
 *
 * **Every series starts at 100.** That is what makes one axis legitimate for four measures in three
 * units, and it is the assertion that fails if anyone later "improves" this by plotting raw values —
 * which would silently put £12.4m and 41.8% on one scale and make the margin line a flat zero.
 *
 * **A point is the measure, not a copy of it.** The values come through `computeMeasure` at each month,
 * so a point on this chart and the headline above it are one computation. Asserted against the measure
 * layer directly, because a series built from its own arithmetic is a second source of truth.
 *
 * The divergence sentence is the part a reader will quote in a meeting, so it is checked for the thing
 * that makes it useful — a *month* — rather than for its wording.
 */

import { describe, expect, it } from 'vitest';
import { SEED_END, monthScope } from '@kestrel/model';
import { computeMeasure } from '@kestrel/measures';

import { DEFAULT_TREND, TREND_MEASURES, buildTrend, divergenceOf, selectedTrend } from './trend';
import { ALL_MONTHS, contextOf, viewOf } from './world';

const ctx = () => contextOf(viewOf());

describe('the indexed trend', () => {
  it('rebases every series to 100 at the opening month', () => {
    const trend = buildTrend(ctx(), ALL_MONTHS, SEED_END, ['revenue', 'gross_margin', 'ebitda']);
    expect(trend.series).toHaveLength(3);
    for (const series of trend.series) {
      const first = series.points.find((point) => point.indexed !== null);
      expect(first?.indexed, `${series.label} does not start at 100`).toBeCloseTo(100, 6);
    }
  });

  it('and each point is the measure computed at that month, not a second arithmetic', () => {
    const trend = buildTrend(ctx(), ALL_MONTHS, SEED_END, ['revenue']);
    const series = trend.series[0];
    expect(series).toBeDefined();
    for (const point of series?.points ?? []) {
      const direct = computeMeasure('revenue', { ...ctx(), scope: monthScope(point.month) }).value;
      expect(point.value, `${point.month} disagrees with the measure layer`).toBe(direct);
    }
  });

  it('and the window ends at the selected month rather than at the end of the model', () => {
    /* A historical selection has closed months after it. Slicing the last twelve of the model would
       move the chart into the future without saying so. */
    const earlier = '2026-03';
    const trend = buildTrend(ctx(), ALL_MONTHS, earlier, ['revenue']);
    expect(trend.months.at(-1)).toBe(earlier);
    expect(trend.months).toHaveLength(12);
  });

  it('and keeps the real values, because an index cannot say what anything is', () => {
    const trend = buildTrend(ctx(), ALL_MONTHS, SEED_END, ['revenue', 'gross_margin']);
    const revenue = trend.series.find((s) => s.measureId === 'revenue');
    const margin = trend.series.find((s) => s.measureId === 'gross_margin');
    // Different units, on one chart, both still readable in their own terms.
    expect(revenue?.unit).toBe('currency');
    expect(margin?.unit).toBe('percent');
    expect(revenue?.points.at(-1)?.value).toBeGreaterThan(1_000_000);
    expect(margin?.points.at(-1)?.value).toBeLessThan(1);
  });
});

describe('divergence', () => {
  it('names the month the lines parted, which is the question the section asks', () => {
    const trend = buildTrend(ctx(), ALL_MONTHS, SEED_END, ['revenue', 'ebitda', 'net_income']);
    const divergence = divergenceOf(trend.series);
    if (divergence === null) {
      // A legitimate outcome, and the surface says so rather than printing an empty panel.
      expect(trend.divergence).toBeNull();
      return;
    }
    expect(divergence.leader.measureId).not.toBe(divergence.laggard.measureId);
    expect(divergence.gap).toBeGreaterThan(0);
    // The sentence is worth quoting only if it carries a period.
    if (divergence.from !== undefined) {
      expect(divergence.statement).toMatch(
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}/,
      );
    }
  });

  it('and reports nothing when a single series is on the chart', () => {
    // One line cannot diverge from anything, and a divergence claim about it would be fiction.
    const trend = buildTrend(ctx(), ALL_MONTHS, SEED_END, ['revenue']);
    expect(trend.divergence).toBeNull();
  });
});

describe('the selection', () => {
  it('falls back to a readable default rather than to an empty chart', () => {
    expect(selectedTrend(undefined)).toEqual([...DEFAULT_TREND]);
    expect(selectedTrend('not-a-measure')).toEqual([...DEFAULT_TREND]);
    expect(selectedTrend('')).toEqual([...DEFAULT_TREND]);
  });

  it('and keeps only the measures this chart offers', () => {
    expect(selectedTrend('revenue,cash,net_income')).toEqual(['revenue', 'net_income']);
  });

  it('and every offered measure exists in the catalogue', () => {
    /* A trend listing a measure the catalogue does not hold would throw on the one click that selects
       it — the failure a curated list produces, and the reason this is asserted rather than reviewed. */
    for (const entry of TREND_MEASURES) {
      expect(() => computeMeasure(entry.id, ctx())).not.toThrow();
    }
  });
});
