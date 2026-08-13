import { describe, expect, it } from 'vitest';

import {
  ACTUAL_VERSION,
  CALENDAR_YEAR,
  PLANNING_END,
  SEED_END,
  addMonths,
  buildWorld,
  compareMonths,
  fiscalYearScope,
  monthScope,
  monthsBetween,
  quarterScope,
  ytdScope,
} from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { allEntityIds, compareMeasure, computeMeasure, contextAtScope } from '@kestrel/measures';

import { buildThreeWaySplit } from './three-way.ts';

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

describe('the Performance three-way split', () => {
  it('is one deterministic object with the three horizons in their finance reading order', () => {
    const request = { measureId: 'revenue', ctx: ctx() } as const;
    const first = buildThreeWaySplit(request);
    const second = buildThreeWaySplit(request);

    expect(second).toEqual(first);
    expect(first.slices.map((slice) => slice.kind)).toEqual([
      'in_month',
      'year_to_date',
      'remaining_forecast',
    ]);
    expect(first).toMatchObject({
      measureId: 'revenue',
      measureLabel: 'Revenue',
      through: '2026-07',
      fiscalYear: 2026,
      actualsCutoff: '2026-06',
      projectionStarts: '2026-07',
      approvedForecast: { id: 'v6', status: 'approved' },
      budget: { id: 'budget-fy26', status: 'approved' },
    });
    expect(first.bases.approvedForecast).toContain('Forecast v6, v6, approved');
    expect(first.bases.approvedForecast).toContain('projected from July 2026');
  });

  it('reconciles every displayed revenue total and variance to the measure layer', () => {
    const base = ctx();
    const split = buildThreeWaySplit({ measureId: 'revenue', ctx: base });
    const [month, ytd, remaining] = split.slices;

    expect(month.scope).toEqual(monthScope('2026-07'));
    expect(ytd.scope).toEqual(ytdScope('2026-07', CALENDAR_YEAR));
    expect(remaining.scope).toMatchObject({
      startMonth: '2026-08',
      endMonth: PLANNING_END,
    });

    for (const slice of [month, ytd]) {
      const actualCtx = {
        ...contextAtScope(base, slice.scope),
        scenario: 'ACTUAL' as const,
        versionId: ACTUAL_VERSION,
      };
      const budget = compareMeasure('revenue', actualCtx, {
        id: 'budget',
        versionId: split.budget.id,
      });
      const forecast = compareMeasure('revenue', actualCtx, {
        id: 'forecast',
        versionId: split.approvedForecast.id,
      });

      expect(slice.value.value).toBe(budget.current.value);
      expect(slice.vsBudget).toMatchObject({
        comparativeValue: budget.comparativeValue,
        variance:
          budget.current.value === null || budget.comparativeValue === null
            ? null
            : budget.current.value - budget.comparativeValue,
        movement: budget.movement,
        movementUnit: budget.movementUnit,
        favourable: budget.favourable,
      });
      expect(slice.vsApprovedForecast).toMatchObject({
        comparativeValue: forecast.comparativeValue,
        variance:
          forecast.current.value === null || forecast.comparativeValue === null
            ? null
            : forecast.current.value - forecast.comparativeValue,
        movement: forecast.movement,
        movementUnit: forecast.movementUnit,
        favourable: forecast.favourable,
      });
    }

    expect(remaining.scope).not.toBeNull();
    const remainingScope = remaining.scope!;
    const forecastCtx = {
      ...contextAtScope(base, remainingScope),
      scenario: 'FORECAST' as const,
      versionId: split.approvedForecast.id,
    };
    const forecastVsBudget = compareMeasure('revenue', forecastCtx, {
      id: 'budget',
      versionId: split.budget.id,
    });
    const governedForecast = computeMeasure('revenue', forecastCtx);
    const governedBudget = computeMeasure('revenue', {
      ...forecastCtx,
      scenario: 'BUDGET',
      versionId: split.budget.id,
    });
    expect(remaining.value?.value).toBe(governedForecast.value);
    expect(remaining.vsBudget).toMatchObject({
      comparativeValue: governedBudget.value,
      variance:
        forecastVsBudget.current.value === null || forecastVsBudget.comparativeValue === null
          ? null
          : forecastVsBudget.current.value - forecastVsBudget.comparativeValue,
      movement: forecastVsBudget.movement,
      favourable: forecastVsBudget.favourable,
    });
    expect(forecastVsBudget.comparativeValue).toBe(governedBudget.value);
    expect(
      [...new Set(remaining.value?.inputs.flatMap((input) => input.monthsUsed))].sort(),
    ).toEqual(monthsBetween('2026-08', PLANNING_END));
    expect(remaining.vsApprovedForecast).toBeNull();
  });

  it('keeps ACTUAL reads at the selected close while the remaining slice uses governed plan months', () => {
    const split = buildThreeWaySplit({ measureId: 'revenue', ctx: ctx() });
    const [month, ytd, remaining] = split.slices;
    const inputTotal = ytd.value.inputs.reduce((total, input) => total + (input.value ?? 0), 0);

    expect(ytd.value.formula).toContain('external revenue');
    expect(ytd.value.value).toBe(inputTotal);
    for (const slice of [month, ytd]) {
      const monthsUsed = slice.value.inputs.flatMap((input) => input.monthsUsed);
      expect(monthsUsed.every((month) => compareMonths(month, split.through) <= 0)).toBe(true);
      expect(slice.value.scenario).toBe('ACTUAL');
    }

    expect(remaining.value).toMatchObject({ scenario: 'FORECAST', versionId: 'v6' });
    expect(remaining.value?.inputs.flatMap((input) => input.monthsUsed)).toContain(PLANNING_END);
  });

  it('starts remaining forecast strictly after both the selected close and approved cut-off', () => {
    const split = buildThreeWaySplit({ measureId: 'revenue', ctx: ctx() });
    const remaining = split.slices[2];

    expect(remaining.scope?.startMonth).toBe(addMonths(split.through, 1));
    expect(remaining.scope?.endMonth).toBe(PLANNING_END);
    expect(compareMonths(remaining.scope!.startMonth, split.actualsCutoff)).toBeGreaterThan(0);
    expect(compareMonths(remaining.scope!.startMonth, split.through)).toBeGreaterThan(0);
    expect(remaining.value).toMatchObject({ scenario: 'FORECAST', versionId: 'v6' });
    expect(remaining.subjectLabel).toContain('Forecast v6');
  });

  it('uses the selected through-month for a partial period rather than its unclosed calendar end', () => {
    const q2ThroughMay = {
      ...quarterScope(2026, 2, CALENDAR_YEAR),
      endMonth: '2026-05',
      label: 'Q2 FY26 through May 2026',
    };
    // A selected draft/data scenario cannot replace the fixed actual and approved bases of this view.
    const split = buildThreeWaySplit({
      measureId: 'revenue',
      ctx: ctx({ scope: q2ThroughMay, scenario: 'FORECAST', versionId: 'v7' }),
    });
    const [month, ytd, remaining] = split.slices;

    expect(split.through).toBe('2026-05');
    expect(month.scope).toEqual(monthScope('2026-05'));
    expect(month.value).toMatchObject({ scenario: 'ACTUAL', versionId: ACTUAL_VERSION });
    expect(ytd.scope).toEqual(ytdScope('2026-05', CALENDAR_YEAR));
    expect(remaining.scope).toMatchObject({ startMonth: '2026-07', endMonth: PLANNING_END });
    expect(remaining.value).toMatchObject({ scenario: 'FORECAST', versionId: 'v6' });
    expect(remaining.emptyReason).toBeUndefined();
    expect(split.approvedForecast.id).toBe('v6');
  });

  it('keeps a historical fiscal-year view historical when the approved cut-off is later', () => {
    const historical = {
      ...fiscalYearScope(2025, CALENDAR_YEAR),
      endMonth: '2025-11',
      label: 'FY25 through November 2025',
    };
    const split = buildThreeWaySplit({
      measureId: 'revenue',
      ctx: ctx({ scope: historical }),
    });

    expect(split.slices[0].scope).toEqual(monthScope('2025-11'));
    expect(split.slices[1].scope).toEqual(ytdScope('2025-11', CALENDAR_YEAR));
    expect(split.slices[2]).toMatchObject({ scope: null, value: null, vsBudget: null });
    expect(split.slices[0].value.inputs.flatMap((input) => input.monthsUsed)).not.toContain(
      '2025-12',
    );
  });

  it('states percentage variances in basis points without losing the measure polarity', () => {
    const split = buildThreeWaySplit({ measureId: 'gross_margin', ctx: ctx() });
    const inMonth = split.slices[0];
    const expected =
      inMonth.value.value === null || inMonth.vsBudget.comparativeValue === null
        ? null
        : (inMonth.value.value - inMonth.vsBudget.comparativeValue) * 10_000;

    expect(inMonth.value.unit).toBe('percent');
    expect(inMonth.vsBudget.varianceUnit).toBe('bps');
    expect(inMonth.vsBudget.variance).toBeCloseTo(expected ?? 0, 8);
    expect(inMonth.vsBudget.favourable).not.toBeNull();
  });
});
