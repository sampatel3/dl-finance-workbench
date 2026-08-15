import { describe, expect, it } from 'vitest';

import {
  ACTUAL_VERSION,
  CALENDAR_YEAR,
  PLANNING_END,
  SEED_END,
  buildWorld,
  fiscalYearScope,
  monthScope,
} from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { allEntityIds, compareMeasure, computeMeasure, contextAtScope } from '@kestrel/measures';

import { buildYearToGo } from './year-to-go.ts';

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

describe('the Year-to-Go projection', () => {
  const projection = buildYearToGo({ ctx: ctx() });
  const line = (id: (typeof projection.lines)[number]['measureId']) =>
    projection.lines.find((candidate) => candidate.measureId === id)!;

  it('uses the approved forecast after the selected close and names its cut-off', () => {
    expect(projection).toMatchObject({
      through: '2026-07',
      fiscalYear: 2026,
      actualsCutoff: '2026-06',
      projectionStarts: '2026-07',
      remainingStarts: '2026-08',
      approvedForecast: { id: 'v6', status: 'approved' },
      budget: { id: 'budget-fy26', status: 'approved' },
    });
    expect(projection.remainingScope).toMatchObject({
      startMonth: '2026-08',
      endMonth: PLANNING_END,
    });
    expect(projection.basis.expected).toMatch(/actuals through July 2026 plus Forecast v6/i);
  });

  it('lands additive flows as actual YTD plus the remaining approved forecast', () => {
    for (const id of ['revenue', 'gross_profit', 'ebitda'] as const) {
      const value = line(id);
      expect(value.remainingKind).toBe('flow');
      expect(value.actualYtd).not.toBeNull();
      expect(value.remainingForecast).not.toBeNull();
      expect(value.expectedFullYear).toBe(
        (value.actualYtd ?? 0) + (value.remainingForecast ?? 0),
      );
    }
  });

  it('recomputes gross margin from the landed gross profit and revenue', () => {
    const revenue = line('revenue').expectedFullYear;
    const grossProfit = line('gross_profit').expectedFullYear;
    const margin = line('gross_margin');

    expect(margin.remainingKind).toBe('rate');
    expect(margin.expectedFullYear).toBe((grossProfit ?? 0) / (revenue ?? 1));
    expect(margin.expectedFullYear).not.toBe(
      (margin.actualYtd ?? 0) + (margin.remainingForecast ?? 0),
    );
    expect(margin.varianceUnit).toBe('bps');
    expect(margin.varianceToBudget).toBeCloseTo(
      ((margin.expectedFullYear ?? 0) - (margin.fullYearBudget ?? 0)) * 10_000,
      8,
    );
  });

  it('rebases cash from the latest actual by the approved forecast movement to year end', () => {
    const cash = line('cash');
    const forecastAtClose = computeMeasure('cash', {
      ...ctx(),
      scenario: 'FORECAST',
      versionId: 'v6',
    }).value;
    const forecastAtYearEnd = computeMeasure('cash', {
      ...contextAtScope(ctx(), monthScope(PLANNING_END)),
      scenario: 'FORECAST',
      versionId: 'v6',
    }).value;

    expect(cash.remainingKind).toBe('balance_movement');
    expect(cash.remainingForecast).toBe(
      (forecastAtYearEnd ?? 0) - (forecastAtClose ?? 0),
    );
    expect(cash.expectedFullYear).toBe(
      (cash.actualYtd ?? 0) + (cash.remainingForecast ?? 0),
    );
    expect(cash.expectedFullYear).not.toBe(cash.approvedForecastFullYear);
  });

  it('reads every full-year budget from the governed measure layer', () => {
    const scope = fiscalYearScope(2026, CALENDAR_YEAR);
    for (const value of projection.lines) {
      const governed = computeMeasure(value.measureId, {
        ...contextAtScope(ctx(), scope),
        scenario: 'BUDGET',
        versionId: 'budget-fy26',
      });
      expect(value.fullYearBudget).toBe(governed.value);
      expect(value.owner).toBe(governed.owner);
      expect(value.status).toBe(governed.status);
    }
  });

  it('carries the governed prior-year full year as a primary landing comparison', () => {
    const scope = fiscalYearScope(2026, CALENDAR_YEAR);
    for (const value of projection.lines) {
      const governed = compareMeasure(value.measureId, contextAtScope(ctx(), scope), {
        id: 'prior_year',
      });
      expect(value.priorYearFullYear).toBe(governed.comparativeValue);
    }
  });

  it('uses governed materiality for the trajectory rather than colouring every movement', () => {
    expect(line('revenue').trajectory).toBe('ahead');
    expect(line('gross_profit').trajectory).toBe('on_track');
    expect(line('gross_margin').trajectory).toBe('behind');
    expect(line('ebitda').trajectory).toBe('behind');
    expect(line('cash').trajectory).toBe('behind');
    expect(line('gross_profit').materiality).toMatch(/below/i);
  });

  it('is deterministic and carries exactly the supported landing measures', () => {
    /* Profit after tax joined the list when the review asked for it by name. The assertion stays exact
       rather than becoming a `toContain`: the point of pinning the set is that a measure cannot appear
       on a board's landing page without somebody deciding it should. */
    expect(buildYearToGo({ ctx: ctx() })).toEqual(projection);
    expect(projection.lines.map((value) => value.measureId)).toEqual([
      'revenue',
      'gross_profit',
      'gross_margin',
      'ebitda',
      'net_income',
      'cash',
    ]);
  });

  it('refuses to omit months when the selected boundary predates the forecast cut-off', () => {
    const may = buildYearToGo({ ctx: ctx({ scope: monthScope('2026-05') }) });

    expect(may.available).toBe(false);
    expect(may.unavailableReason).toMatch(/Forecast v6.*actuals run through June 2026/i);
    expect(may.remainingScope).toBeNull();
    expect(may.lines.every((value) => value.remainingForecast === null)).toBe(true);
    expect(may.lines.every((value) => value.expectedFullYear === null)).toBe(true);
  });
});
