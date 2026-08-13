import { describe, expect, it } from 'vitest';

import { compareMeasure, computeMeasure } from '@kestrel/measures';

import { KPI_GROUPS, kpisFor } from './kpis';
import { contextOf, viewOf } from './world';

describe('the governed KPI projection', () => {
  const view = viewOf();
  const ctx = contextOf(view);
  const dashboard = kpisFor(ctx);
  const rows = dashboard.groups.flatMap((group) => group.rows);
  const row = (id: string) => rows.find((candidate) => candidate.measureId === id)!;

  it('has the three finance-native groups and only their declared measures', () => {
    expect(dashboard.groups.map((group) => group.id)).toEqual([
      'financial',
      'working_capital',
      'operational',
    ]);
    for (const group of dashboard.groups) {
      expect(group.rows.map((candidate) => candidate.measureId)).toEqual(
        KPI_GROUPS.find((spec) => spec.id === group.id)?.measureIds,
      );
    }
  });

  it('uses the approved budget as target and the approved forecast in force', () => {
    expect(dashboard.budget).toMatchObject({ id: 'budget-fy26', status: 'approved' });
    expect(dashboard.forecast).toMatchObject({ id: 'v6', status: 'approved' });

    for (const value of rows) {
      expect(value.budgetTarget).toBe(
        compareMeasure(value.measureId, ctx, {
          id: 'budget',
          versionId: dashboard.budget.id,
        }).comparativeValue,
      );
      expect(value.approvedForecast).toBe(
        compareMeasure(value.measureId, ctx, {
          id: 'forecast',
          versionId: dashboard.forecast.id,
        }).comparativeValue,
      );
    }
  });

  it('reads actual, prior-year and prior-period movement through the same measure layer', () => {
    for (const value of rows) {
      const actual = computeMeasure(value.measureId, ctx);
      const priorYear = compareMeasure(value.measureId, ctx, { id: 'prior_year' });
      const trend = compareMeasure(value.measureId, ctx, { id: 'prior_period' });

      expect(value.actual).toBe(actual.value);
      expect(value.priorYear).toBe(priorYear.comparativeValue);
      expect(value.priorPeriodMovement).toBe(trend.movement);
      expect(value.priorPeriodUnit).toBe(trend.movementUnit);
      expect(value.priorPeriodFavourable).toBe(trend.favourable);
    }
  });

  it('keeps draft CRM measures visibly draft and invents no replacement owner', () => {
    expect(row('pipeline_coverage')).toMatchObject({
      status: 'draft',
      definitionOwner: 'Sales Director',
    });
    expect(row('pipeline_conversion')).toMatchObject({
      status: 'draft',
      definitionOwner: 'Sales Director',
    });
    expect(row('revenue')).toMatchObject({
      status: 'approved',
      definitionOwner: 'Group FP&A',
    });
  });

  it('respects a narrowed entity context rather than repeating group KPI values', () => {
    const gulfCtx = contextOf(viewOf({ as: 'gulf-controller' }));
    const gulf = kpisFor(gulfCtx).groups.flatMap((group) => group.rows);
    const gulfRevenue = gulf.find((candidate) => candidate.measureId === 'revenue');

    expect(gulfRevenue?.actual).toBe(computeMeasure('revenue', gulfCtx).value);
    expect(gulfRevenue?.actual).not.toBe(row('revenue').actual);
  });

  it('is deterministic', () => {
    expect(kpisFor(ctx)).toEqual(dashboard);
  });
});
