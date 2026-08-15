/**
 * Where the approved forecast lands.
 *
 * Three things this has to get right, and each of them is a way the panel could look correct and be
 * wrong:
 *
 *   **The window is the fiscal year.** Read at the selected month it would answer a different question,
 *   in the same layout, with the same labels. Asserted against the full-year scope rather than trusted.
 *
 *   **The landing is computed under the version's own assumptions.** A version here is the world
 *   believed differently, so reading it means changing the version on the context — not reading actuals
 *   and calling them a forecast. Asserted against `computeMeasure` under the version directly.
 *
 *   **The two comparators are different.** Budget and prior version answer accountability and process
 *   respectively; a build that pointed both at the same object would render two identical columns and
 *   read as a formatting quirk rather than a bug.
 */

import { describe, expect, it } from 'vitest';
import { ACTUAL_VERSION, SEED_END, buildWorld, monthScope, subtree } from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { computeMeasure } from '@kestrel/measures';

import { LANDING_MEASURES, buildLanding, priorForecast } from './landing.ts';
import { activeApprovedForecast, version } from './forecast.ts';

const world = buildWorld({ seed: 'kestrel-industrial-group' });

const ctx = (): MeasureContext => ({
  store: world.store,
  rates: world.rates,
  scope: monthScope(SEED_END),
  scenario: 'ACTUAL',
  versionId: ACTUAL_VERSION,
  lens: 'reported',
  entityIds: subtree('group'),
});

describe('the landing', () => {
  it('is read at the fiscal year, not the selected month', () => {
    const landing = buildLanding({ ctx: ctx() });
    expect(landing.scope.type).toBe('FISCAL_YEAR');
    expect(landing.fiscalYear).toBe(2026);
    // The window covers the whole year, so it ends after the month that was selected.
    expect(landing.scope.endMonth > SEED_END).toBe(true);
    expect(landing.scope.startMonth).toBe('2026-01');
  });

  it('and each line is the measure under that version, not actuals wearing its label', () => {
    const landing = buildLanding({ ctx: ctx() });
    const spec = version(landing.versionId);
    for (const line of landing.lines) {
      const direct = computeMeasure(line.measureId, {
        ...ctx(),
        scope: landing.scope,
        scenario: spec.scenario,
        versionId: landing.versionId,
      }).value;
      expect(line.landing, `${line.label} is not the measure under ${landing.versionId}`).toBe(
        direct,
      );
    }
  });

  it('and it lands on the approved version by default, which is what the panel claims', () => {
    const landing = buildLanding({ ctx: ctx() });
    expect(landing.versionId).toBe(activeApprovedForecast().id);
    expect(landing.status).toBe('approved');
  });

  it('and carries all six lines the review names', () => {
    const landing = buildLanding({ ctx: ctx() });
    expect(landing.lines.map((line) => line.label)).toEqual([
      'Revenue',
      'Cost of sales',
      'Gross margin',
      'Overheads',
      'EBITDA',
      'PAT',
    ]);
    expect(LANDING_MEASURES).toHaveLength(6);
  });
});

describe('the two comparators', () => {
  it('are different objects, so the columns cannot be one figure printed twice', () => {
    const landing = buildLanding({ ctx: ctx() });
    expect(landing.priorVersionId).toBeDefined();
    expect(landing.priorVersionId).not.toBe(landing.versionId);
    expect(landing.priorVersionId).not.toBe(landing.budgetId);

    const revenue = landing.lines.find((line) => line.measureId === 'revenue');
    expect(revenue?.budget).not.toBeNull();
    expect(revenue?.priorVersion).not.toBeNull();
    // Two different comparatives produce two different variances, or the panel says nothing new.
    expect(revenue?.budget).not.toBe(revenue?.priorVersion);
  });

  it('and the prior version is a forecast, never the budget', () => {
    /* "Prior version" meaning the budget would silently collapse the two comparators into one, and the
       panel would show the same variance twice under different headings. */
    const prior = priorForecast(activeApprovedForecast().id);
    expect(prior).toBeDefined();
    expect(version(prior as string).scenario).toBe('FORECAST');
  });

  it('and a ratio reports its variance in basis points, like every other ratio in the product', () => {
    const landing = buildLanding({ ctx: ctx() });
    const margin = landing.lines.find((line) => line.measureId === 'gross_margin');
    expect(margin?.varianceUnit).toBe('bps');
    expect(margin?.unit).toBe('percent');
    if (margin?.vsBudget !== null && margin?.vsBudget !== undefined) {
      // Basis points: a fraction of a point would mean the scaling never happened.
      expect(Math.abs(margin.vsBudget)).toBeGreaterThan(1);
    }
  });

  it('and direction comes from polarity, so overheads landing higher is not good news', () => {
    const landing = buildLanding({ ctx: ctx() });
    const overheads = landing.lines.find((line) => line.measureId === 'opex');
    expect(overheads).toBeDefined();
    if ((overheads?.vsBudget ?? 0) > 0) expect(overheads?.budgetFavourable).toBe(false);
    if ((overheads?.vsBudget ?? 0) < 0) expect(overheads?.budgetFavourable).toBe(true);
  });
});
