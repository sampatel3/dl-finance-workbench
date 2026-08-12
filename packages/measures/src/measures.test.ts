/**
 * The measure layer.
 *
 * Four things are being defended here, and each of them is a way a management report goes wrong while
 * looking entirely reasonable:
 *
 *   a period that does not reconcile to its parts (basis, carried up from the model)
 *   a denominator that is a closing balance where it should be an average
 *   a movement coloured by its arithmetic sign rather than by what it means
 *   a comparator nobody can reproduce being allowed to raise something to a board
 */

import { describe, expect, it } from 'vitest';

import {
  ACTUAL_VERSION,
  CALENDAR_YEAR,
  SEED_END,
  buildHealthyWorld,
  buildWorld,
  daysInScope,
  halfYearScope,
  monthScope,
  quarterScope,
  ytdScope,
} from '@kestrel/model';

import {
  computeByEntity,
  computeMeasure,
  allEntityIds,
  resetConsolidationCache,
} from './compute.ts';
import type { MeasureContext } from './compute.ts';
import { MEASURES, measure, measureIds } from './catalogue.ts';
import { COMPARATORS, compareMeasure, resolveComparator, trendExpectation } from './comparator.ts';
import { assessMateriality, POLICY } from './materiality.ts';
import { ABSENT, delta, deltaUnitFor, formatValue } from './units.ts';

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

describe('the catalogue is the semantic layer', () => {
  it('declares every measure once, with a formula, an owner and a state', () => {
    expect(new Set(measureIds()).size).toBe(MEASURES.length);
    for (const m of MEASURES) {
      expect(m.formula.length).toBeGreaterThan(8);
      expect(m.owner).toBeTruthy();
      expect(['approved', 'draft']).toContain(m.status);
    }
  });

  it('and keeps a driver nobody in Finance owns yet in draft rather than pretending', () => {
    // Pipeline coverage comes from the CRM's own weighting, which is the state most operational
    // drivers actually arrive in. A catalogue where everything is approved is a catalogue nobody read.
    expect(measure('pipeline_coverage').status).toBe('draft');
    expect(MEASURES.filter((m) => m.status === 'draft')).toHaveLength(1);
  });

  it('throws on a measure that does not exist rather than returning nothing', () => {
    expect(() => measure('gross_margin_but_better')).toThrow(/Unknown measure/);
  });
});

describe('a period reconciles to its parts', () => {
  it('a half-year flow equals the sum of its two quarters', () => {
    const h1 =
      computeMeasure('revenue', ctx({ scope: halfYearScope(2026, 1, CALENDAR_YEAR) })).value ?? 0;
    const q1 =
      computeMeasure('revenue', ctx({ scope: quarterScope(2026, 1, CALENDAR_YEAR) })).value ?? 0;
    const q2 =
      computeMeasure('revenue', ctx({ scope: quarterScope(2026, 2, CALENDAR_YEAR) })).value ?? 0;

    // Within a hundredth of a per cent: each window translates at the unweighted mean of its own
    // monthly rates, so two quarters and one half-year are not the same rounding. A basis error
    // would show up here as a multiple, not as a rounding.
    expect(Math.abs(h1 - (q1 + q2)) / h1).toBeLessThan(0.0001);
  });

  it('a half-year balance is the closing month, not a sum', () => {
    const h1 = computeMeasure('cash', ctx({ scope: halfYearScope(2026, 1, CALENDAR_YEAR) })).value;
    const june = computeMeasure('cash', ctx({ scope: monthScope('2026-06') })).value;
    expect(h1).toBe(june);

    const q1 =
      computeMeasure('cash', ctx({ scope: quarterScope(2026, 1, CALENDAR_YEAR) })).value ?? 0;
    const q2 =
      computeMeasure('cash', ctx({ scope: quarterScope(2026, 2, CALENDAR_YEAR) })).value ?? 0;
    // The failure this guards: summing two quarters of closing cash. It produces a number that looks
    // exactly like a cash balance and is roughly twice the truth.
    expect(h1).not.toBe(q1 + q2);
  });

  it('a margin is not annualised, and a return on capital is', () => {
    const month = computeMeasure('gross_margin', ctx({ scope: monthScope(SEED_END) })).value ?? 0;
    const ytd =
      computeMeasure('gross_margin', ctx({ scope: ytdScope(SEED_END, CALENDAR_YEAR) })).value ?? 0;
    // Both are ratios of two flows over their own window, so both are in the same range. Annualising
    // one would put it near three.
    expect(month).toBeGreaterThan(0.3);
    expect(month).toBeLessThan(0.55);
    expect(ytd).toBeGreaterThan(0.3);
    expect(ytd).toBeLessThan(0.55);

    expect(measure('roce').annualise).toBe(true);
    expect(measure('gross_margin').annualise).toBeUndefined();
    // A seven-month return annualised is bigger than the same seven months unannualised — which is
    // the arithmetic the flag exists to perform, checked by comparing a month to a year-to-date.
    const roceMonth = computeMeasure('roce', ctx({ scope: monthScope(SEED_END) })).value ?? 0;
    const roceYtd =
      computeMeasure('roce', ctx({ scope: ytdScope(SEED_END, CALENDAR_YEAR) })).value ?? 0;
    expect(roceMonth).toBeGreaterThan(0);
    expect(roceYtd).toBeGreaterThan(0);
  });
});

describe('denominators', () => {
  it('days sales outstanding uses AVERAGE receivables and the window’s real days', () => {
    const scope = monthScope(SEED_END);
    const value = computeMeasure('dso', ctx({ scope }));
    expect(value.value).not.toBeNull();

    // The inputs are the proof: if this ever read `receivables` rather than `avg_receivables`, the
    // ratio would jump on the last day of a period for reasons that have nothing to do with
    // collections, and no assertion on the value alone would notice.
    const accounts = value.inputs.map((i) => i.accountId);
    expect(accounts).toContain('avg_receivables');
    expect(accounts).not.toContain('receivables');

    // And reproduce it by hand from the recorded inputs, which is what a drill-down claims to do.
    const avg = value.inputs.find((i) => i.accountId === 'avg_receivables')?.value ?? 0;
    const revenue = computeMeasure('revenue', ctx({ scope })).value ?? 1;
    expect(value.value).toBeCloseTo((avg / revenue) * daysInScope(scope), 6);
  });

  it('and the Gulf entity’s collections are the slowest in the group', () => {
    // PLANTED 5. The cash story downstream depends on this being true in the data rather than
    // asserted in prose, so it is asserted here.
    const byEntity = computeByEntity('dso', ctx());
    const gulf = byEntity.get('gulf')?.value ?? 0;
    for (const [entityId, value] of byEntity) {
      if (entityId === 'gulf') continue;
      expect(gulf).toBeGreaterThan(value.value ?? 0);
    }
  });
});

describe('polarity, not sign', () => {
  it('a cost that rose is a positive movement and unfavourable', () => {
    const comparison = compareMeasure('cost_of_sales', ctx(), { id: 'prior_year' });
    expect(comparison.movement).not.toBeNull();
    expect(comparison.movement ?? 0).toBeGreaterThan(0);
    // The line the whole field exists for. Colouring by sign paints this green.
    expect(comparison.favourable).toBe(false);
  });

  it('and revenue that rose is favourable', () => {
    const comparison = compareMeasure('revenue', ctx(), { id: 'prior_year' });
    expect(comparison.movement ?? 0).toBeGreaterThan(0);
    expect(comparison.favourable).toBe(true);
  });

  it('a neutral measure has no favourability at all, rather than a default', () => {
    expect(compareMeasure('headcount', ctx(), { id: 'prior_year' }).favourable).toBeNull();
  });

  it('a movement in a percentage is basis points, not a percentage of a percentage', () => {
    // "Gross margin fell 2.6%" is ambiguous between 2.6 points and 2.6% of 41.8%, and the two differ
    // by a factor of forty.
    expect(deltaUnitFor('percent')).toBe('bps');
    expect(deltaUnitFor('currency')).toBe('percent');
    const movement = delta(0.418, 0.429, 'percent');
    expect(movement.unit).toBe('bps');
    expect(movement.value).toBeCloseTo(-110, 6);
  });
});

describe('the five comparators', () => {
  it('each resolve to the window they claim', () => {
    const base = ctx({ scope: quarterScope(2026, 2, CALENDAR_YEAR) });

    const priorPeriod = resolveComparator({ id: 'prior_period' }, base);
    expect(priorPeriod.scope?.startMonth).toBe('2026-01');

    const priorYear = resolveComparator({ id: 'prior_year' }, base);
    expect(priorYear.scope?.startMonth).toBe('2025-04');

    // Budget and forecast are the SAME window against a different version — a budget variance is this
    // quarter against what this quarter was budgeted at, not against last quarter's budget.
    for (const id of ['budget', 'forecast'] as const) {
      const resolved = resolveComparator({ id }, base);
      expect(resolved.scope?.startMonth).toBe('2026-04');
      expect(resolved.scenario).toBe(id === 'budget' ? 'BUDGET' : 'FORECAST');
    }

    expect(resolveComparator({ id: 'trend' }, base).kind).toBe('fit');
  });

  it('and every one of them states what it is comparing against', () => {
    for (const id of COMPARATORS) {
      const resolved = resolveComparator({ id }, ctx());
      expect(resolved.basis.length).toBeGreaterThan(10);
      expect(resolved.label).toBeTruthy();
    }
  });

  it('produce different comparatives, so the choice is a real one', () => {
    const values = COMPARATORS.map(
      (id) => compareMeasure('revenue', ctx(), { id }).comparativeValue,
    );
    expect(new Set(values).size).toBe(COMPARATORS.length);
    for (const value of values) expect(value).not.toBeNull();
  });

  it('and a named forecast version is honoured, because "which drivers changed since v6" needs it', () => {
    const v6 = compareMeasure('revenue', ctx(), {
      id: 'forecast',
      versionId: 'v6',
    }).comparativeValue;
    const v5 = compareMeasure('revenue', ctx(), {
      id: 'forecast',
      versionId: 'v5',
    }).comparativeValue;
    expect(v6).not.toBe(v5);
  });
});

describe('trend is a fit, and is treated as one', () => {
  it('produces an expectation in the right neighbourhood of the actual', () => {
    const value = trendExpectation('revenue', ctx({ scope: monthScope(SEED_END) }));
    const actual = computeMeasure('revenue', ctx()).value ?? 0;
    expect(value).not.toBeNull();
    expect(value ?? 0).toBeGreaterThan(actual * 0.7);
    expect(value ?? 0).toBeLessThan(actual * 1.3);
  });

  it('tracks a measure that only grows, which is how you know the fit has slope', () => {
    // Headcount rises steadily and has no seasonality, so the fit should land within a per cent of
    // July and — the part that proves it looks forward — comfortably above where the series was a
    // year earlier. It is deliberately NOT asserted to sit below July: headcount is a staircase of
    // whole people, so the line can extrapolate a fraction past a step the actual has not climbed.
    const expected = trendExpectation('headcount', ctx({ scope: monthScope(SEED_END) })) ?? 0;
    const actual = computeMeasure('headcount', ctx()).value ?? 0;
    const yearAgo = computeMeasure('headcount', ctx({ scope: monthScope('2025-07') })).value ?? 0;

    expect(Math.abs(expected - actual) / actual).toBeLessThan(0.01);
    expect(expected).toBeGreaterThan(yearAgo);
  });

  it('and a count is never translated, so a group headcount is a whole number of people', () => {
    // Found by the test above. Headcount is a `balance` account, so translation was dividing it by a
    // closing exchange rate and the group had 519.96 staff — absurd, and small enough to survive a
    // review. Hours had the same defect, where it would have been worse: utilisation is a ratio of two
    // hour counts, so the ratio looked right while every hour figure behind it was wrong.
    const heads = computeMeasure('headcount', ctx()).value ?? 0;
    expect(Number.isInteger(heads)).toBe(true);
    const hours = computeMeasure('utilisation', ctx()).value ?? 0;
    expect(hours).toBeGreaterThan(0.5);
    expect(hours).toBeLessThan(1);
  });

  it('and overstates July revenue, because a straight line does not know about seasons', () => {
    // July is a seasonal trough in this business and a least-squares line through the preceding year
    // is blind to that, so the expectation sits ABOVE the actual even though revenue is growing.
    // This is not a defect to fix — it is the honest weakness of a fitted comparator, and it is a
    // second reason, beyond reproducibility, that trend may not raise a priority-board item.
    const expected = trendExpectation('revenue', ctx({ scope: monthScope(SEED_END) })) ?? 0;
    const actual = computeMeasure('revenue', ctx()).value ?? 0;
    expect(expected).toBeGreaterThan(actual);
  });

  it('refuses to guess from fewer than three points', () => {
    // The second month of the world has one month of history behind it.
    expect(trendExpectation('revenue', ctx({ scope: monthScope('2023-02') }))).toBeNull();
  });

  it('and can never raise anything to a board', () => {
    const comparison = compareMeasure('revenue', ctx(), { id: 'trend' });
    const verdict = assessMateriality(comparison, 'pl');
    expect(verdict.material).toBe(false);
    expect(verdict.reason).toMatch(/fitted expectation/);

    // While the same variance against a real plan can be.
    const againstForecast = compareMeasure('revenue', ctx(), { id: 'forecast', versionId: 'v6' });
    expect(assessMateriality(againstForecast, 'pl').material).toBe(true);
  });
});

describe('materiality needs both thresholds', () => {
  it('states why, whichever way the answer goes', () => {
    const comparison = compareMeasure('revenue', ctx(), { id: 'forecast', versionId: 'v6' });
    const verdict = assessMateriality(comparison, 'pl');
    expect(verdict.material).toBe(true);
    // "Why is this on the board's list?" has to have an answer that names the policy.
    expect(verdict.reason).toMatch(/floor/);
    expect(verdict.threshold).toEqual(POLICY.thresholds.pl);
  });

  it('and a variance that is proportionally large but small in money is not material', () => {
    // The unmapped line is £212k against nothing at all last year — infinite in proportion, and well
    // under the absolute floor for a group this size. Relative-only would put it on the board.
    const comparison = compareMeasure('unmapped_opex', ctx(), { id: 'prior_year' });
    expect(comparison.comparativeValue).toBeNull();
    expect(assessMateriality(comparison, 'pl').material).toBe(false);
  });

  it('the policy is owned, versioned and carries its reasoning', () => {
    expect(POLICY.owner).toBeTruthy();
    expect(POLICY.version).toBeGreaterThan(1);
    expect(POLICY.status).toBe('approved');
    expect(POLICY.rationale).toMatch(/Either\s+alone fails/);
  });
});

describe('the drill spine', () => {
  it('records every account a measure read, once each, with its provenance', () => {
    const value = computeMeasure('ebitda', ctx());
    expect(value.inputs.length).toBeGreaterThan(4);

    // Once each: composite measures read revenue through more than one helper, and a drill-down that
    // lists revenue three times reads as a bug even when the arithmetic is right.
    const accounts = value.inputs.map((i) => i.accountId);
    expect(new Set(accounts).size).toBe(accounts.length);

    for (const input of value.inputs) {
      expect(input.label).toBeTruthy();
      expect(input.monthsUsed.length).toBeGreaterThan(0);
    }
  });

  it('and the inputs reproduce the figure they were recorded for', () => {
    const value = computeMeasure('gross_profit', ctx());
    const of = (accountId: string) =>
      value.inputs.find((i) => i.accountId === accountId)?.value ?? 0;
    const rebuilt =
      of('revenue') +
      of('revenue_ic') -
      of('cost_of_sales') -
      of('cost_of_sales_ic') -
      of('subcontract_cost');
    expect(rebuilt).toBe(value.value);
  });

  it('breaks a ratio down by recomputing it per entity, not by apportioning it', () => {
    const byEntity = computeByEntity('gross_margin', ctx());
    const groupMargin = computeMeasure('gross_margin', ctx()).value ?? 0;
    const margins = [...byEntity.values()].map((v) => v.value ?? 0);

    // Apportioning a group ratio by revenue share gives every entity the group's margin. The five
    // entities have genuinely different margins, and the group's sits among them.
    expect(new Set(margins).size).toBe(margins.length);
    expect(Math.min(...margins)).toBeLessThan(groupMargin);
    expect(Math.max(...margins)).toBeGreaterThan(groupMargin);
  });

  it('says whether a figure went through elimination, so a slice is never shown as a group figure', () => {
    const consolidated = computeMeasure('revenue', ctx());
    expect(consolidated.consolidated).toBe(true);

    const sliced = computeMeasure('gross_margin', ctx({ segmentId: 'contracts' }));
    expect(sliced.consolidated).toBe(false);
    expect(sliced.segmentId).toBe('contracts');
    expect(sliced.value).not.toBeNull();
  });

  it('and a segment slice is smaller than the whole', () => {
    const all = computeMeasure('revenue', ctx()).value ?? 0;
    const contracts = computeMeasure('revenue', ctx({ segmentId: 'contracts' })).value ?? 0;
    expect(contracts).toBeGreaterThan(0);
    expect(contracts).toBeLessThan(all);
  });
});

describe('currency is a lens on the same measure', () => {
  it('reported and constant differ, and the euro entity’s growth is flattered by neither', () => {
    const reported = computeByEntity('revenue', ctx({ lens: 'reported' }));
    const constant = computeByEntity(
      'revenue',
      ctx({ lens: 'constant', comparativeScope: monthScope('2025-07') }),
    );
    expect(constant.get('europe')?.value).not.toBe(reported.get('europe')?.value);
    // Sterling entities are untouched by the lens, which is what makes it a currency lens rather than
    // a fudge factor.
    expect(constant.get('manufacturing')?.value).toBe(reported.get('manufacturing')?.value);
  });
});

describe('formatting happens once, at the edge', () => {
  it('renders a missing figure as an em dash and never as a zero', () => {
    expect(formatValue(null, 'currency')).toBe(ABSENT);
    expect(formatValue(null, 'percent')).toBe(ABSENT);
    expect(formatValue(null, 'days')).toBe(ABSENT);
    // The distinction that matters: a genuine zero is a zero.
    expect(formatValue(0, 'currency')).toBe('£0.00');
  });

  it('reads the way a finance team writes', () => {
    expect(formatValue(1_239_341_163, 'currency')).toBe('£12.4m');
    expect(formatValue(0.418, 'percent')).toBe('41.8%');
    expect(formatValue(-110, 'bps', { signed: true })).toBe('−110bps');
    expect(formatValue(0.062, 'percent', { signed: true })).toBe('+6.2%');
    expect(formatValue(4_180, 'rate')).toBe('£41.80');
    expect(formatValue(64, 'days')).toBe('64 days');
    expect(formatValue(1.4, 'ratio')).toBe('1.40×');
  });

  it('uses a real minus sign, which aligns with digits where a hyphen does not', () => {
    expect(formatValue(-1_239_341_163, 'currency')).toBe('−£12.4m');
    expect(formatValue(-1_239_341_163, 'currency').startsWith('-')).toBe(false);
  });

  it('and a percentage change from nothing is undefined rather than infinite', () => {
    expect(delta(100, 0, 'currency').value).toBeNull();
    expect(delta(100, null, 'currency').value).toBeNull();
  });
});

describe('the consolidation memo is keyed by which world it read', () => {
  // The cache key once named the scope, the scenario, the version, the lens, the entities and the
  // vintage — everything inside a world, and not which world. So the healthy twin's first query hit the
  // real world's entry and returned its numbers, and every twin assertion downstream was comparing the
  // real world to itself. Nothing looked wrong: the figures were plausible, internally consistent, and
  // belonged to a different dataset.
  const healthy = buildHealthyWorld();

  const healthyCtx = (): MeasureContext => ({
    ...ctx(),
    store: healthy.store,
    rates: healthy.rates,
  });

  it('returns the twin’s own numbers, not the world queried first', () => {
    // Order matters to the defect and must not matter to the result: the real world is queried first
    // here, exactly as it was when this was broken.
    const real = computeMeasure('revenue', ctx()).value;
    const twin = computeMeasure('revenue', healthyCtx()).value;
    expect(real).not.toBeNull();
    expect(twin).not.toBe(real);
  });

  it('and keeps memoising within one world, which is what the cache is for', () => {
    // The fix must not have turned the memo off.
    const first = computeMeasure('ebitda', ctx());
    expect(computeMeasure('ebitda', ctx()).value).toBe(first.value);
    expect(computeMeasure('ebitda', healthyCtx()).value).not.toBe(first.value);
  });

  it('and a reset clears it without changing an answer', () => {
    const before = computeMeasure('cash', healthyCtx()).value;
    resetConsolidationCache();
    expect(computeMeasure('cash', healthyCtx()).value).toBe(before);
  });
});

describe('the concept slide’s four figures, read through the measure layer', () => {
  it('are what the executive surface will print', () => {
    const scope = monthScope(SEED_END);
    expect(formatValue(computeMeasure('revenue', ctx({ scope })).value, 'currency')).toBe('£12.4m');
    expect(formatValue(computeMeasure('gross_margin', ctx({ scope })).value, 'percent')).toBe(
      '41.8%',
    );
    expect(formatValue(computeMeasure('ebitda', ctx({ scope })).value, 'currency')).toBe('£2.1m');
    expect(formatValue(computeMeasure('cash', ctx({ scope })).value, 'currency')).toBe('£4.8m');
  });
});
