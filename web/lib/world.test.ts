import { describe, expect, it } from 'vitest';

import { computeMeasure } from '@kestrel/measures';

import {
  PERIOD_KINDS,
  contextOf,
  forecastVersionIdOr,
  hrefFor,
  scopeLabel,
  viewOf,
} from './world';

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

  it('offers the four commentary periods in the shared selector', () => {
    expect(PERIOD_KINDS).toEqual(['month', 'quarter', 'half_year', 'year', 'ytd']);
  });

  it('stops an in-progress half-year at the selected through-month', () => {
    const view = viewOf({ period: 'half_year', month: '2026-07' });

    expect(view.scope).toMatchObject({
      type: 'HALF_YEAR',
      startMonth: '2026-07',
      endMonth: '2026-07',
    });
    expect(scopeLabel(view.periodKind, view.scope)).toBe('H2 2026 through Jul 2026');
  });

  it('keeps a completed half-year as its full six-month window', () => {
    const view = viewOf({ period: 'half_year', month: '2026-06' });

    expect(view.scope).toMatchObject({
      type: 'HALF_YEAR',
      startMonth: '2026-01',
      endMonth: '2026-06',
    });
    expect(scopeLabel(view.periodKind, view.scope)).toBe('H1 2026');
  });

  it('stops an in-progress fiscal year at the selected through-month', () => {
    const view = viewOf({ period: 'year', month: '2026-07' });

    expect(view.scope).toMatchObject({
      type: 'FISCAL_YEAR',
      startMonth: '2026-01',
      endMonth: '2026-07',
    });
    expect(scopeLabel(view.periodKind, view.scope)).toBe('FY2026 through Jul 2026');
  });

  it('keeps a completed fiscal year as its full twelve-month window', () => {
    const view = viewOf({ period: 'year', month: '2025-12' });

    expect(view.scope).toMatchObject({
      type: 'FISCAL_YEAR',
      startMonth: '2025-01',
      endMonth: '2025-12',
    });
    expect(scopeLabel(view.periodKind, view.scope)).toBe('FY2025');
  });
});

describe('reporting currency lenses', () => {
  it('does not expose the model-only functional lens as a group reporting view', () => {
    const view = viewOf({ lens: 'functional' });

    expect(view.lens).toBe('reported');
    expect(view.fellBack).toBe(true);
  });
});

describe('Explore dataset state', () => {
  it('resolves and carries a selected forecast version in the URL context', () => {
    const view = viewOf(
      { scenario: 'forecast', version: 'v5' },
      { allowDataScenario: true },
    );

    expect(view.dataScenario).toBe('FORECAST');
    expect(view.version.id).toBe('v5');
    expect(contextOf(view)).toMatchObject({ scenario: 'FORECAST', versionId: 'v5' });
  });

  it('uses the approved budget version for a budget dataset', () => {
    expect(contextOf(viewOf({ scenario: 'budget' }, { allowDataScenario: true }))).toMatchObject({
      scenario: 'BUDGET',
      versionId: 'budget-fy26',
    });
  });

  it('refuses to treat the budget version as a forecast selection', () => {
    const view = viewOf(
      { scenario: 'forecast', version: 'budget-fy26' },
      { allowDataScenario: true },
    );

    expect(view.dataScenario).toBe('FORECAST');
    expect(view.version.scenario).toBe('FORECAST');
    expect(view.version.id).not.toBe('budget-fy26');
    expect(view.fellBack).toBe(true);
  });

  it('falls a budget diff source back to a forecast version', () => {
    expect(forecastVersionIdOr('budget-fy26', 'v5')).toBe('v5');
    expect(forecastVersionIdOr('v4', 'v5')).toBe('v4');
  });

  it('does not let a dataset query silently switch non-Explore reporting surfaces', () => {
    expect(contextOf(viewOf({ scenario: 'forecast', version: 'v5' }))).toMatchObject({
      scenario: 'ACTUAL',
      versionId: 'actual',
    });
  });

  it('preserves Explore dataset state through shared selector links and drops it elsewhere', () => {
    const view = viewOf(
      { scenario: 'forecast', version: 'v5' },
      { allowDataScenario: true },
    );
    const explore = new URL(hrefFor('/app/explore', view, { period: 'quarter' }), 'https://demo.invalid');
    const performance = new URL(hrefFor('/app/performance', view), 'https://demo.invalid');

    expect(explore.searchParams.get('scenario')).toBe('forecast');
    expect(explore.searchParams.get('version')).toBe('v5');
    expect(performance.searchParams.has('scenario')).toBe(false);
  });
});
