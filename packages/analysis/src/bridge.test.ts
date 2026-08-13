/**
 * The bridge.
 *
 * One property matters more than every other assertion in this file: **the bars sum to the total.**
 * A decomposition that does not add up has explained nothing, and a residual is where an unstated
 * attribution convention hides. It is asserted across scopes, comparators, entity slices and both
 * bridgeable accounts, because a decomposition that sums for July against forecast and not for the
 * half-year against budget is a decomposition that happens to be right once.
 */

import { describe, expect, it } from 'vitest';

import {
  ACTUAL_VERSION,
  CALENDAR_YEAR,
  SEED_END,
  buildWorld,
  halfYearScope,
  monthScope,
  priorYearScope,
  quarterScope,
  subtree,
  ytdScope,
} from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { allEntityIds, compareMeasure, computeMeasure, formatValue } from '@kestrel/measures';

import {
  buildBridge,
  ebitdaBridge,
  grossProfitBridge,
  principalDriver,
  principalSegment,
} from './bridge.ts';
import type { Bridge } from './bridge.ts';

const world = buildWorld({ seed: 'kestrel-industrial-group' });

function ctx(overrides: Partial<MeasureContext> = {}): MeasureContext {
  return {
    store: world.store,
    rates: world.rates,
    scope: monthScope(SEED_END),
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
    lens: 'reported',
    entityIds: allEntityIds(),
    ...overrides,
  };
}

const contributions = (bridge: Bridge): number =>
  bridge.bars
    .filter((bar) => bar.kind !== 'opening' && bar.kind !== 'closing')
    .reduce((sum, bar) => sum + bar.value, 0);

describe('the bars sum to the total', () => {
  const scopes = [
    monthScope(SEED_END),
    quarterScope(2026, 2, CALENDAR_YEAR),
    halfYearScope(2026, 1, CALENDAR_YEAR),
    ytdScope(SEED_END, CALENDAR_YEAR),
  ];
  const comparators = [
    { id: 'prior_year' as const },
    { id: 'prior_period' as const },
    { id: 'budget' as const },
    { id: 'forecast' as const, versionId: 'v6' },
  ];

  it('on every scope, every comparator and both accounts', () => {
    const failures: string[] = [];
    for (const scope of scopes) {
      for (const comparator of comparators) {
        for (const measureId of ['revenue', 'cost_of_sales'] as const) {
          const bridge = buildBridge({ measureId, ctx: ctx({ scope }), comparator });
          if (!bridge.sums) {
            failures.push(
              `${measureId} ${scope.label} vs ${comparator.id}: ${contributions(bridge)} vs ${bridge.total}`,
            );
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('and for a single entity, which is where a mix bar has nowhere to hide', () => {
    for (const entityId of allEntityIds()) {
      const bridge = buildBridge({
        measureId: 'revenue',
        ctx: ctx({ entityIds: subtree(entityId) }),
        comparator: { id: 'prior_year' },
      });
      expect(bridge.sums).toBe(true);
    }
  });

  it('and the gross-profit bridge, which is composed from the other two', () => {
    const bridge = grossProfitBridge({
      ctx: ctx(),
      comparator: { id: 'forecast', versionId: 'v6' },
    });
    expect(bridge.sums).toBe(true);
    // Composed rather than recomputed, so it must agree with the measure layer at both ends.
    expect(bridge.to).toBe(computeMeasure('gross_profit', ctx()).value);
  });

  it('and the EBITDA bridge across every supported scope and comparator', () => {
    const failures: string[] = [];
    for (const scope of scopes) {
      for (const comparator of comparators) {
        const bridge = ebitdaBridge({ ctx: ctx({ scope }), comparator });
        if (!bridge.sums || Math.round(contributions(bridge)) !== Math.round(bridge.total)) {
          failures.push(
            `${scope.label} vs ${comparator.id}: ${contributions(bridge)} vs ${bridge.total}`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('and the EBITDA bridge for every entity slice', () => {
    for (const entityId of allEntityIds()) {
      const bridge = ebitdaBridge({
        ctx: ctx({ entityIds: subtree(entityId) }),
        comparator: { id: 'forecast', versionId: 'v6' },
      });
      expect(bridge.sums, entityId).toBe(true);
      expect(bridge.to, entityId).toBe(
        computeMeasure('ebitda', ctx({ entityIds: subtree(entityId) })).value,
      );
    }
  });

  it('and in constant currency, including historical comparators', () => {
    const scope = quarterScope(2026, 2, CALENDAR_YEAR);
    const constantCtx = ctx({
      scope,
      lens: 'constant',
      comparativeScope: priorYearScope(scope),
    });

    for (const comparator of comparators) {
      const bridge = ebitdaBridge({ ctx: constantCtx, comparator });
      const comparison = compareMeasure('ebitda', constantCtx, comparator);
      expect(bridge.sums, comparator.id).toBe(true);
      expect(Math.round(contributions(bridge)), comparator.id).toBe(Math.round(bridge.total));
      expect(bridge.from, comparator.id).toBe(comparison.comparativeValue);
      expect(bridge.to, comparator.id).toBe(comparison.current.value);
    }
  });
});

describe('the EBITDA bridge explains profit, not only revenue', () => {
  const comparator = { id: 'forecast' as const, versionId: 'v6' };

  it('reuses the gross-profit explanation and names every governed opex component', () => {
    const grossProfit = grossProfitBridge({ ctx: ctx(), comparator });
    const bridge = ebitdaBridge({ ctx: ctx(), comparator });
    const contributionKinds = bridge.bars
      .filter((bar) => bar.kind !== 'opening' && bar.kind !== 'closing')
      .map((bar) => bar.kind);

    for (const bar of grossProfit.bars.filter(
      (candidate) => candidate.kind !== 'opening' && candidate.kind !== 'closing',
    )) {
      expect(
        bridge.bars.some(
          (candidate) => candidate.kind === bar.kind && candidate.value === bar.value,
        ),
      ).toBe(true);
    }
    expect(contributionKinds).toEqual(
      expect.arrayContaining(['staff_cost', 'other_opex', 'unmapped_opex']),
    );
    expect(bridge.bars.some((bar) => bar.label === 'Operating expense')).toBe(false);
  });

  it('expresses each expense movement with the correct EBITDA sign', () => {
    const bridge = ebitdaBridge({ ctx: ctx(), comparator });
    const components = [
      ['staff_cost', 'staff_cost'],
      ['other_opex', 'other_opex'],
      ['unmapped_opex', 'unmapped_opex'],
    ] as const;

    for (const [kind, measureId] of components) {
      const comparison = compareMeasure(measureId, ctx(), comparator);
      const expected = (comparison.comparativeValue ?? 0) - (comparison.current.value ?? 0);
      expect(bridge.bars.find((bar) => bar.kind === kind)?.value).toBeCloseTo(expected, 6);
    }
  });

  it('uses the governed EBITDA figures as both terminals', () => {
    const comparison = compareMeasure('ebitda', ctx(), comparator);
    const bridge = ebitdaBridge({ ctx: ctx(), comparator });

    expect(bridge.from).toBe(comparison.comparativeValue);
    expect(bridge.to).toBe(comparison.current.value);
    expect(bridge.total).toBe(bridge.to - bridge.from);
    expect(bridge.sums).toBe(true);
  });
});

describe('the residual is named and small', () => {
  it('is reported as a bar rather than absorbed into the arithmetic', () => {
    const bridge = buildBridge({
      measureId: 'revenue',
      ctx: ctx(),
      comparator: { id: 'forecast', versionId: 'v6' },
    });
    // Either there is no residual, or there is a bar called "Other" carrying it. What must never
    // happen is a residual that exists and is invisible.
    const other = bridge.bars.find((bar) => bar.kind === 'other');
    if (bridge.residual !== 0) expect(other?.value).toBe(bridge.residual);
    else expect(other).toBeUndefined();
  });

  it('and is smaller than the smallest real bar on the demo’s own data', () => {
    // A demo-grade guarantee, not a product-grade one: messier data has a larger residual and the
    // product has to say so rather than absorb it. Asserted here so the demo cannot quietly drift
    // into a decomposition that explains half the variance.
    const bridge = buildBridge({
      measureId: 'revenue',
      ctx: ctx(),
      comparator: { id: 'forecast', versionId: 'v6' },
    });
    const real = bridge.bars
      .filter((bar) => !['opening', 'closing', 'other'].includes(bar.kind))
      .map((bar) => Math.abs(bar.value));
    expect(Math.abs(bridge.residual)).toBeLessThan(Math.min(...real));
  });
});

describe('the terminals are the figures on the card above', () => {
  it('so the bridge cannot disagree with the measure it decomposes', () => {
    const comparator = { id: 'forecast' as const, versionId: 'v6' };
    const bridge = buildBridge({ measureId: 'revenue', ctx: ctx(), comparator });
    expect(bridge.to).toBe(computeMeasure('revenue', ctx()).value);
    expect(bridge.total).toBe(bridge.to - bridge.from);
    expect(formatValue(bridge.to, 'currency')).toBe('£12.4m');
  });
});

describe('FX is separated before anything commercial is attributed', () => {
  it('so a sterling-only slice has no FX bar at all', () => {
    // Manufacturing and Services both report in sterling. If translation were leaking into the price
    // bar, this slice would still show one.
    const bridge = buildBridge({
      measureId: 'revenue',
      ctx: ctx({ entityIds: ['manufacturing', 'services'] }),
      comparator: { id: 'prior_year' },
    });
    expect(bridge.bars.find((bar) => bar.kind === 'fx')).toBeUndefined();
  });

  it('and a group bridge does', () => {
    const bridge = buildBridge({
      measureId: 'revenue',
      ctx: ctx(),
      comparator: { id: 'prior_year' },
    });
    const fx = bridge.bars.find((bar) => bar.kind === 'fx');
    expect(fx).toBeDefined();
    expect(fx?.value).not.toBe(0);
  });
});

describe('segments with no natural unit are reported whole', () => {
  it('rather than having a price invented for them', () => {
    // Project revenue is recognised over time and has no units. A product that assumes everything is
    // unitised divides its revenue by a quantity of zero and reports a price effect of infinity, or
    // silently drops it.
    const bridge = buildBridge({
      measureId: 'revenue',
      ctx: ctx({ entityIds: ['gulf'] }),
      comparator: { id: 'prior_year' },
    });
    const rate = bridge.bars.find((bar) => bar.kind === 'rate');
    expect(rate).toBeDefined();
    expect(rate?.bySegment?.has('projects')).toBe(true);
    // And it is not silently folded into price.
    const price = bridge.bars.find((bar) => bar.kind === 'price');
    expect(price?.bySegment?.has('projects')).toBe(false);
  });
});

describe('a bridge cannot widen a mandatory segment slice', () => {
  it('contains contributions from the selected segment only', () => {
    const bridge = buildBridge({
      measureId: 'revenue',
      ctx: ctx({ segmentId: 'contracts' }),
      comparator: { id: 'forecast', versionId: 'v6' },
    });
    const segmentKeys = bridge.bars.flatMap((bar) => [...(bar.bySegment?.keys() ?? [])]);

    expect(new Set(segmentKeys)).toEqual(new Set(['contracts']));
    expect(bridge.sums).toBe(true);
  });
});

describe('the caption the concept slide asks for', () => {
  it('names the largest driver and the segment behind it, computed rather than written', () => {
    // PLANTED 1 — July revenue beat forecast v6 mainly on volume, which is the slide's own sentence.
    const bridge = buildBridge({
      measureId: 'revenue',
      ctx: ctx(),
      comparator: { id: 'forecast', versionId: 'v6' },
    });
    const driver = principalDriver(bridge);
    expect(driver?.kind).toBe('volume');
    expect(driver?.value ?? 0).toBeGreaterThan(0);

    const segment = principalSegment(driver!);
    expect(segment).toBeDefined();
    expect(segment?.label).toBeTruthy();
  });

  it('and the beat is around the £0.7m the slide quotes', () => {
    const bridge = buildBridge({
      measureId: 'revenue',
      ctx: ctx(),
      comparator: { id: 'forecast', versionId: 'v6' },
    });
    const beat = bridge.total / 100 / 1e6;
    expect(beat).toBeGreaterThan(0.4);
    expect(beat).toBeLessThan(1.1);
  });
});

describe('a trend cannot be bridged', () => {
  it('and says why rather than returning an empty decomposition', () => {
    // There are no quantities behind a fitted line, so there is nothing to attribute. Returning zero
    // bars that sum to the total would be technically true and completely useless.
    expect(() =>
      buildBridge({ measureId: 'revenue', ctx: ctx(), comparator: { id: 'trend' } }),
    ).toThrow(/trend cannot be bridged/i);
  });

  it('including EBITDA, because its gross-profit explanation still needs quantities', () => {
    expect(() => ebitdaBridge({ ctx: ctx(), comparator: { id: 'trend' } })).toThrow(
      /trend cannot be bridged/i,
    );
  });
});
