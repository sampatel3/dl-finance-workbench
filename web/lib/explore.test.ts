import { describe, expect, it } from 'vitest';

import { MONTHS } from '@kestrel/model';
import { computeMeasure } from '@kestrel/measures';

import { GET as exportExplore } from '../app/api/v1/explore/route';

import {
  ALL_EXPLORE_MEASURES,
  cellProvenance,
  exploreCsv,
  exploreCloseDrillHref,
  exploreDrillHref,
  exploreHref,
  exploreMeasures,
  exploreMonthsThrough,
  exploreState,
  normaliseExploreAxes,
  parseExploreAxis,
} from './explore';
import { contextOf, viewOf } from './world';

describe('Explore axes are an unambiguous URL', () => {
  it('deduplicates one axis and records that a hand-edited address was normalised', () => {
    expect(parseExploreAxis('entity,entity,segment', ['measure'])).toEqual(['entity', 'segment']);
    const axes = normaliseExploreAxes({ rows: 'entity,entity,segment', cols: 'period' });
    expect(axes.rows).toEqual(['entity', 'segment']);
    expect(axes.columns).toEqual(['period']);
    expect(axes.normalised).toBe(true);
  });

  it('keeps a dimension on one axis when it was written on both', () => {
    const axes = normaliseExploreAxes({ rows: 'entity,segment', cols: 'entity,period' });
    expect(axes.rows).toEqual(['entity', 'segment']);
    expect(axes.columns).toEqual(['period']);
    expect(axes.normalised).toBe(true);
  });

  it('moves a dimension to the axis the reader just chose in generated links', () => {
    const href = exploreHref({ rows: 'entity', cols: 'period', drill: '2:1' }, 'cols', 'entity');
    const url = new URL(href, 'https://demo.invalid');
    expect(url.pathname).toBe('/app/explore');
    expect(url.searchParams.get('rows')).toBe('measure');
    expect(url.searchParams.get('cols')).toBe('entity');
    expect(url.searchParams.has('drill')).toBe(false);
  });

  it('canonicalises hand-edited axes when changing the grain', () => {
    const href = exploreHref(
      { rows: 'entity,entity', cols: 'entity,period', drill: '0:0' },
      'grain',
      'quarter',
    );
    const url = new URL(href, 'https://demo.invalid');
    expect(url.searchParams.get('rows')).toBe('entity');
    expect(url.searchParams.get('cols')).toBe('period');
    expect(url.searchParams.get('grain')).toBe('quarter');
    expect(url.searchParams.has('drill')).toBe(false);
  });
});

describe('Explore drill navigation preserves context without leaving stale focus state', () => {
  it('opens the selected cell at the visible drill section', () => {
    const url = new URL(
      exploreDrillHref({ period: 'quarter', view: 'inner', focus: 'section-axes' }, 2, 1),
      'https://demo.invalid',
    );
    expect(url.searchParams.get('period')).toBe('quarter');
    expect(url.searchParams.get('view')).toBe('inner');
    expect(url.searchParams.get('drill')).toBe('2:1');
    expect(url.searchParams.get('focus')).toBe('section-drill');
  });

  it('closes the selected cell and returns focus to the pivot', () => {
    const url = new URL(
      exploreCloseDrillHref({ period: 'quarter', drill: '2:1', focus: 'section-drill' }),
      'https://demo.invalid',
    );
    expect(url.searchParams.get('period')).toBe('quarter');
    expect(url.searchParams.has('drill')).toBe(false);
    expect(url.searchParams.get('focus')).toBe('explore-cell-2-1');
  });
});

describe('Explore follows the selected through-month', () => {
  it('offers the six model months ending there and none after it', () => {
    const months = exploreMonthsThrough(MONTHS, '2026-06');
    expect(months).toHaveLength(6);
    expect(months.at(-1)).toBe('2026-06');
    expect(months).not.toContain('2026-07');
  });

  it('uses that same window in the computed grid', () => {
    const state = exploreState({ month: '2026-06' });
    expect(state.months.at(-1)).toBe('2026-06');
    expect(state.pivot.columnPaths.map((path) => path[0]?.key)).not.toContain('2026-07');
    expect(state.comparisons).toHaveLength(state.pivot.rows.length);
    expect(state.comparisons[0]).toHaveLength(state.pivot.columnPaths.length);
  });

  it('does not let quarter grain read a month after the selected through-month', () => {
    const state = exploreState({ month: '2026-05', grain: 'quarter' });
    expect(state.pivot.rows.flatMap((row) => row.cells).every((cell) => cell.ctx.scope.endMonth <= '2026-05')).toBe(true);
  });
});

describe('Explore datasets', () => {
  it('makes scenario and version real URL state rather than ignored controls', () => {
    const actual = exploreState({ rows: 'measure', cols: 'period', scenario: 'actual' });
    const forecast = exploreState({
      rows: 'measure',
      cols: 'period',
      scenario: 'forecast',
      version: 'v5',
    });

    expect(forecast.view).toMatchObject({ dataScenario: 'FORECAST', version: { id: 'v5' } });
    expect(forecast.pivot.rows[0]?.cells[0]?.ctx).toMatchObject({
      scenario: 'FORECAST',
      versionId: 'v5',
    });
    const actualValues = actual.pivot.rows.flatMap((row) => row.cells.map((cell) => cell.value));
    const forecastValues = forecast.pivot.rows.flatMap((row) => row.cells.map((cell) => cell.value));
    expect(forecastValues.some((value, index) => value !== actualValues[index])).toBe(true);
  });

  it('can narrow the grid to the exact governed measure cited by Ask', () => {
    expect(exploreMeasures(undefined)).toEqual([
      'revenue',
      'gross_profit',
      'gross_margin',
      'ebitda',
      'cash',
      'dso',
    ]);
    expect(exploreMeasures('dso,dso,not-a-measure')).toEqual(['dso']);

    const cited = exploreState({ rows: 'measure', cols: 'period', measure: 'dso' });
    expect(cited.measures).toEqual(['dso']);
    expect(cited.pivot.rows).toHaveLength(1);
    expect(cited.pivot.rows[0]?.cells.every((cell) => cell.measureId === 'dso')).toBe(true);
  });

  it('resolves an Ask segment citation to that exact governed slice', () => {
    const cited = exploreState({
      rows: 'measure',
      cols: 'period',
      measure: 'revenue',
      segment: 'contracts',
    });

    expect(cited.segmentId).toBe('contracts');
    expect(cited.ctx.segmentId).toBe('contracts');
    const exact = computeMeasure('revenue', cited.ctx);
    const group = computeMeasure('revenue', contextOf(cited.view));
    expect(exact.value).not.toBe(group.value);
  });

  it('makes every catalogue definition available to the formula inspector', () => {
    expect(ALL_EXPLORE_MEASURES).toContain('pipeline_conversion');
    expect(ALL_EXPLORE_MEASURES.length).toBeGreaterThan(25);
  });
});

describe('Explore provenance uses the computed cell grain', () => {
  it('does not double-count aggregate and cost-centre rows', () => {
    const provenance = cellProvenance(
      'staff_cost',
      contextOf(viewOf({ entity: 'manufacturing' })),
    );
    const computedInput = provenance.computed.inputs.find(
      (input) => input.accountId === 'staff_cost',
    );
    expect(computedInput?.rowCount).toBe(1);
    expect(provenance.inputs.get('staff_cost')?.rowCount).toBe(computedInput?.rowCount);
  });
});

describe('Explore CSV is the grid with its evidence attached', () => {
  it('carries the comparator, formula and immutable vintage ids in a spreadsheet-safe body', () => {
    const body = exploreCsv(exploreState({ month: '2026-06' }));
    expect(body).toContain('Deeplight Finance Workbench,Explore export');
    expect(body).toContain('Dataset,Actual');
    expect(body).toContain('Grid window,2026-01 to 2026-06');
    expect(body).toContain('Comparator,"forecast v6, over the same window"');
    expect(body).toMatch(/Vintages,v-2026/);
    expect(body).toContain('Formula,Owner,Definition state,Vintages');
    expect(body).toContain('external revenue + any intercompany revenue that did not eliminate');
    expect(body).toContain('Actual raw,Actual shown,Comparative raw,Comparative shown,Movement raw');
  });

  it('returns 403 instead of silently exporting another entity for a forbidden scope', async () => {
    const response = await exportExplore(
      new Request('https://demo.invalid/api/v1/explore?as=gulf-controller&entity=group'),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = await response.json();
    expect(body).toMatchObject({ principal: 'gulf-controller', requestedEntity: 'group' });
    expect(JSON.stringify(body)).not.toContain('Explore export');
  });
});
