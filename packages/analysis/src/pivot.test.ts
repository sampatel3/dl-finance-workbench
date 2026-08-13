/**
 * The pivot, and the one property that makes it worth having.
 *
 * **A cell agrees with the same measure computed directly, and a total is recomputed rather than
 * summed.** A grid that disagrees with the front page is worse than no grid: a reader distrusts both
 * and cannot tell which is wrong.
 *
 * Two of the assertions here would fail on the obvious implementation — the one that sums its cells —
 * and they fail for different reasons, which is why both are here. A ratio is not the sum of ratios.
 * A balance is its closing month, not three months added together.
 */

import { describe, expect, it } from 'vitest';

import {
  ACTUAL_VERSION,
  CALENDAR_YEAR,
  MONTHS,
  SEED_END,
  buildWorld,
  monthScope,
  quarterScope,
  subtree,
} from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { allEntityIds, computeMeasure } from '@kestrel/measures';

import { buildPivot, drillCell } from './pivot.ts';

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

const QUARTER = ['2026-05', '2026-06', '2026-07'] as const;

describe('a cell is the measure, computed', () => {
  const pivot = buildPivot({
    ctx: ctx(),
    rows: ['measure'],
    columns: ['period'],
    measureIds: ['revenue', 'gross_margin', 'cash'],
    months: QUARTER,
  });

  it('so every cell equals `computeMeasure` at that cell’s scope', () => {
    // Not "is close to". A grid that arrives at a figure a different way from the page is a second
    // implementation of the measure layer, and the two will diverge on the first edit.
    for (const row of pivot.rows) {
      row.cells.forEach((cell, i) => {
        const month = QUARTER[i];
        const direct = computeMeasure(cell.measureId, ctx({ scope: monthScope(month as string) }));
        expect(cell.value).toBe(direct.value);
      });
    }
  });

  it('and carries its own unit rather than the row’s', () => {
    const margin = pivot.rows.find((r) => r.path[0]?.key === 'gross_margin');
    expect(margin?.cells.every((c) => c.unit === 'percent')).toBe(true);
  });
});

describe('a total is recomputed, never summed', () => {
  const pivot = buildPivot({
    ctx: ctx(),
    rows: ['measure'],
    columns: ['period'],
    measureIds: ['revenue', 'cash', 'gross_margin'],
    months: QUARTER,
  });

  /* The union of May, June and July is a three-month window and NOT a fiscal quarter — Q3 2026 is
     July to September, two months of which have not happened. Comparing against `quarterScope` here
     asked the rate table for August and threw, which is the right failure: a partial quarter reported
     as a quarter is exactly the figure that ends up in a board pack. */
  const window = {
    type: 'YTD' as const,
    startMonth: '2026-05',
    endMonth: '2026-07',
    label: 'May–Jul',
  };

  it('for a flow, which happens to equal the sum — so this alone proves nothing', () => {
    const revenue = pivot.rows.find((r) => r.path[0]?.key === 'revenue');
    const summed = revenue?.cells.reduce((t, c) => t + (c.value ?? 0), 0) ?? 0;
    const direct = computeMeasure('revenue', ctx({ scope: window }));
    expect(revenue?.total?.value).toBe(direct.value);
    // Close to the sum, because a flow is additive — the gap is the translation difference between
    // three monthly rates and the window's mean. The next two tests are the ones with teeth.
    expect(Math.abs((revenue?.total?.value ?? 0) - summed) / summed).toBeLessThan(0.001);
  });

  it('for a **balance**, where the total is the closing month and the sum is nonsense', () => {
    const cash = pivot.rows.find((r) => r.path[0]?.key === 'cash');
    const summed = cash?.cells.reduce((t, c) => t + (c.value ?? 0), 0) ?? 0;
    const direct = computeMeasure('cash', ctx({ scope: window }));
    const closing = computeMeasure('cash', ctx({ scope: monthScope('2026-07') }));

    /* The claim, stated as identity rather than as a ratio: the total for a window IS the closing
       month. An earlier version of this asserted the sum was at least 2.5× the total, which was a
       guess about the data and wrong — June is the dividend-and-tax month and closes at £1.4m, so
       three closing balances add to 2.1× rather than 3×. A test that pins a magic multiple is a test
       that fails when the seed changes for a reason that has nothing to do with what it checks. */
    expect(cash?.total?.value).toBe(direct.value);
    expect(cash?.total?.value).toBe(closing.value);

    // And the sum is materially wrong — a figure that looks exactly like a cash balance and is double
    // one. This is the number a summing implementation produces by default.
    expect(summed).toBeGreaterThan((cash?.total?.value ?? 0) * 1.8);
  });

  it('and for a **ratio** there is no total at all, with the reason said out loud', () => {
    // The mean of three margins is not the margin, and neither is their sum. A blank cell here is a
    // refusal, so the note has to explain it or a reader reads it as missing data.
    const margin = pivot.rows.find((r) => r.path[0]?.key === 'gross_margin');
    expect(margin?.total).toBeNull();
    expect(pivot.totalNote).toMatch(/not the sum of ratios/);
  });
});

describe('three dimensions on an axis', () => {
  const pivot = buildPivot({
    ctx: ctx(),
    rows: ['entity', 'segment'],
    columns: ['measure', 'period'],
    measureIds: ['revenue', 'cost_of_sales'],
    months: ['2026-06', '2026-07'],
  });

  it('renders the cartesian product, outermost dimension first', () => {
    // Five entities × four segments down, two measures × two months across.
    expect(pivot.rowPaths).toHaveLength(20);
    expect(pivot.columnPaths).toHaveLength(4);
    expect(pivot.rows[0]?.cells).toHaveLength(4);
    expect(pivot.rowPaths[0]?.map((m) => m.dimension)).toEqual(['entity', 'segment']);
  });

  it('and each cell still equals the measure computed at its own slice', () => {
    const row = pivot.rows[3];
    const cell = row?.cells[0];
    expect(cell).toBeDefined();
    if (cell === undefined) return;
    expect(cell.value).toBe(computeMeasure(cell.measureId, cell.ctx).value);
  });

  it('and a sliced cell says it is combined rather than consolidated', () => {
    // Intercompany trade has no segment, so a segment slice cannot have been eliminated. A grid that
    // claimed otherwise would be overstating a group figure by the internal trade inside it.
    expect(pivot.rows.every((r) => r.cells.every((c) => c.consolidated === false))).toBe(true);
  });
});

describe('the entity axis shows only what the context can see', () => {
  it('so a single-entity view lists one entity, not five', () => {
    // The leak this prevents: a controller scoped to one entity being shown the group by being shown
    // its parts. Row-level access has to reach the axis, not just the figures.
    const pivot = buildPivot({
      ctx: ctx({ entityIds: subtree('gulf') }),
      rows: ['entity'],
      columns: ['period'],
      measureIds: ['revenue'],
      months: ['2026-07'],
    });
    expect(pivot.rowPaths.map((p) => p[0]?.key)).toEqual(['gulf']);
  });
});

describe('the quarter grain', () => {
  it('reports whole quarters rather than the months present in them', () => {
    // A partial quarter reported as a quarter is the kind of figure that ends up in a board pack. The
    // member's scope is the quarter; only the columns offered are derived from the months given.
    const pivot = buildPivot({
      ctx: ctx(),
      rows: ['measure'],
      columns: ['period'],
      measureIds: ['revenue'],
      months: ['2026-05', '2026-06'],
      periodGrain: 'quarter',
    });
    expect(pivot.columnPaths).toHaveLength(1);
    const cell = pivot.rows[0]?.cells[0];
    expect(cell?.value).toBe(
      computeMeasure('revenue', ctx({ scope: quarterScope(2026, 2, CALENDAR_YEAR) })).value,
    );
  });
});

describe('the drill terminates in rows', () => {
  const pivot = buildPivot({
    ctx: ctx(),
    rows: ['measure'],
    columns: ['period'],
    measureIds: ['revenue'],
    months: [SEED_END],
  });
  const cell = pivot.rows[0]?.cells[0];

  it('and a group cell breaks into entities that sum to it', () => {
    expect(cell).toBeDefined();
    if (cell === undefined) return;
    const drill = drillCell(cell);
    /* Five entities and the elimination. A group figure is not the sum of its entities — consolidation
       removes intercompany trade — and the first version of this drill showed the five and left a
       reader to notice they overstated the group by £855k. That is a broken reconciliation presented
       as a breakdown, so the elimination is a named line. */
    expect(drill.steps).toHaveLength(6);
    expect(drill.steps.filter((s) => s.dimension === 'entity')).toHaveLength(5);
    const elimination = drill.steps.find((s) => s.key === 'eliminations');
    expect(elimination?.label).toBe('Intercompany eliminated');
    expect(elimination?.value ?? 0).toBeLessThan(0);

    // Not a tolerance: the parts are recomputed at their own level and the elimination is the residual,
    // so they tie exactly.
    const summed = drill.steps.reduce((t, s) => t + (s.value ?? 0), 0);
    expect(summed).toBe(cell.value);
    expect(drill.sums).toBe(true);
    expect(drill.note).toMatch(/intercompany elimination is named/);
  });

  it('and reaches the store’s own rows, each naming its vintage', () => {
    if (cell === undefined) return;
    const drill = drillCell(cell);
    expect(drill.rows.length).toBeGreaterThan(0);
    expect(drill.vintageIds.length).toBeGreaterThan(0);
    for (const row of drill.rows) {
      expect(row.vintageId).toBeTruthy();
      expect(row.month).toBeTruthy();
    }
  });

  it('and the rows are the cell rather than a second reading of it', () => {
    // They come from the same query that produced the value, so their sum is the value — via the same
    // basis rule. A drill that re-queried differently could sum to something else and look right.
    if (cell === undefined) return;
    const drill = drillCell(cell);
    /* Revenue is emitted per segment with no aggregate row of its own, so the query has to *omit* the
       segment key rather than pass null — an omitted dimension sums across values, and null matches
       only the aggregate row. The first version passed `?? null`, asked for a row that does not exist,
       and drilled to nothing. */
    const revenueRows = drill.rows.filter((r) => r.accountId === 'revenue');
    expect(revenueRows.length).toBeGreaterThan(0);
    expect(revenueRows.every((r) => r.segmentId !== null)).toBe(true);
    expect(revenueRows.reduce((t, r) => t + r.amountMinor, 0)).toBeGreaterThan(0);
  });

  it('and an entity cell breaks into segments, saying they may not reach the total', () => {
    if (cell === undefined) return;
    const entityCell = { ...cell, ctx: { ...cell.ctx, entityIds: subtree('services') } };
    const drill = drillCell(entityCell);
    expect(drill.steps.every((s) => s.dimension === 'segment')).toBe(true);
    expect(drill.note).toMatch(/combined rather than consolidated/);
  });

  it('and says when it has reached the finest level the grain holds', () => {
    if (cell === undefined) return;
    const finest = {
      ...cell,
      ctx: {
        ...cell.ctx,
        entityIds: subtree('services'),
        segmentId: 'contracts' as const,
        costCentreId: 'operations' as const,
      },
    };
    const drill = drillCell(finest);
    expect(drill.steps).toEqual([]);
    expect(drill.note).toMatch(/finest level/);
  });
});

describe('the months a pivot offers', () => {
  it('are the world’s own, so a column can never be a period with no data', () => {
    const pivot = buildPivot({
      ctx: ctx(),
      rows: ['measure'],
      columns: ['period'],
      measureIds: ['revenue'],
      months: MONTHS.slice(-3),
    });
    expect(pivot.rows[0]?.cells.every((c) => c.value !== null)).toBe(true);
  });
});
