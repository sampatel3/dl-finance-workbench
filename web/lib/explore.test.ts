import { describe, expect, it } from 'vitest';

import { MONTHS } from '@kestrel/model';

import { GET as exportExplore } from '../app/api/v1/explore/route';

import {
  cellProvenance,
  exploreCsv,
  exploreHref,
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
