/**
 * The fact store, and the five rules it exists to enforce.
 *
 * These are written against a hand-built store rather than the seeded world, deliberately: each
 * test states one rule in three or four facts, so a failure names the rule rather than sending
 * somebody into a 43-month dataset to work out which of them broke.
 */

import { describe, expect, it } from 'vitest';

import { FactStore } from './facts.ts';
import type { Fact } from './facts.ts';
import { monthScope, quarterScope, CALENDAR_YEAR } from './period.ts';

/** Load order for a fixture: later ids rank later, which is what the seeded world's register does. */
const order = { rank: (id: string) => Number(id.replace(/\D/g, '')) || 0 };

function fact(partial: Partial<Fact> & Pick<Fact, 'accountId' | 'month' | 'amountMinor'>): Fact {
  return {
    entityId: 'e1',
    scenario: 'ACTUAL',
    versionId: 'actual',
    costCentreId: null,
    segmentId: null,
    vintageId: 'v1',
    quantity: null,
    ...partial,
  };
}

function storeWith(...facts: Fact[]): FactStore {
  const store = new FactStore(order);
  store.addAll(facts);
  return store;
}

const q1 = quarterScope(2026, 1, CALENDAR_YEAR);

describe('basis decides how a window is evaluated', () => {
  it('sums a flow across the months', () => {
    const store = storeWith(
      fact({ accountId: 'revenue', month: '2026-01', amountMinor: 100 }),
      fact({ accountId: 'revenue', month: '2026-02', amountMinor: 200 }),
      fact({ accountId: 'revenue', month: '2026-03', amountMinor: 300 }),
    );
    const r = store.query({ entityId: 'e1', accountId: 'revenue', scope: q1, scenario: 'ACTUAL', versionId: 'actual' });
    expect(r.value).toBe(600);
    expect(r.monthsUsed).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('reads a balance at the last month present, and never sums three closing balances', () => {
    const store = storeWith(
      fact({ accountId: 'cash', month: '2026-01', amountMinor: 100 }),
      fact({ accountId: 'cash', month: '2026-02', amountMinor: 200 }),
      fact({ accountId: 'cash', month: '2026-03', amountMinor: 300 }),
    );
    const r = store.query({ entityId: 'e1', accountId: 'cash', scope: q1, scenario: 'ACTUAL', versionId: 'actual' });
    // 600 would be the answer if basis were ignored, and 600 looks exactly like a cash balance.
    expect(r.value).toBe(300);
    expect(r.monthsUsed).toEqual(['2026-03']);
  });

  it('averages an average-balance account across the months that have facts, not across the window', () => {
    const store = storeWith(
      fact({ accountId: 'avg_receivables', month: '2026-01', amountMinor: 100 }),
      // February is missing. The mean is of what exists — diluting by the gap would report a
      // receivables balance a third lower than any month actually held.
      fact({ accountId: 'avg_receivables', month: '2026-03', amountMinor: 300 }),
    );
    const r = store.query({ entityId: 'e1', accountId: 'avg_receivables', scope: q1, scenario: 'ACTUAL', versionId: 'actual' });
    expect(r.value).toBe(200);
    expect(r.monthsUsed).toEqual(['2026-01', '2026-03']);
  });
});

describe('a missing month is not a zero', () => {
  it('returns null, and null is what renders as an em dash', () => {
    const store = storeWith(fact({ accountId: 'revenue', month: '2026-01', amountMinor: 100 }));
    const absent = store.query({
      entityId: 'e1',
      accountId: 'cash',
      scope: q1,
      scenario: 'ACTUAL',
      versionId: 'actual',
    });
    expect(absent.value).toBeNull();
    expect(absent.rows).toEqual([]);

    const genuineZero = storeWith(fact({ accountId: 'cash', month: '2026-01', amountMinor: 0 }));
    expect(genuineZero.query({ entityId: 'e1', accountId: 'cash', scope: q1, scenario: 'ACTUAL', versionId: 'actual' }).value).toBe(0);
  });
});

describe('a null dimension is the aggregate, and a different row from its children', () => {
  it('so the two levels can never be summed together by accident', () => {
    const store = storeWith(
      fact({ accountId: 'staff_cost', month: '2026-01', amountMinor: 1000, costCentreId: null }),
      fact({ accountId: 'staff_cost', month: '2026-01', amountMinor: 600, costCentreId: 'operations' }),
      fact({ accountId: 'staff_cost', month: '2026-01', amountMinor: 400, costCentreId: 'it' }),
    );
    const base = { entityId: 'e1', accountId: 'staff_cost', scope: monthScope('2026-01'), scenario: 'ACTUAL', versionId: 'actual' } as const;

    // The aggregate.
    expect(store.query({ ...base, costCentreId: null }).value).toBe(1000);
    // One child.
    expect(store.query({ ...base, costCentreId: 'operations' }).value).toBe(600);
    // Omitting the dimension means "any", which is both levels — loudly wrong at 2000 rather than
    // quietly wrong at 1000, which is the point of the convention.
    expect(store.query({ ...base }).value).toBe(2000);
  });
});

describe('a restatement replaces rather than adds', () => {
  const restated = storeWith(
    fact({ accountId: 'cost_of_sales', month: '2026-01', amountMinor: 1000, vintageId: 'v1', segmentId: 'equipment' }),
    fact({ accountId: 'cost_of_sales', month: '2026-01', amountMinor: 690, vintageId: 'v2', segmentId: 'equipment' }),
  );
  const base = { entityId: 'e1', accountId: 'cost_of_sales', scope: monthScope('2026-01'), scenario: 'ACTUAL', versionId: 'actual', segmentId: 'equipment' } as const;

  it('reads the later load, and does not sum the two', () => {
    const r = restated.query(base);
    // 1690 is the defect this rule exists to prevent, and it doubles a restated period.
    expect(r.value).toBe(690);
    expect(r.vintageIds).toEqual(['v2']);
  });

  it('and can still read the figure as it stood when somebody approved it', () => {
    // This is what a published board pack pins. Without it, "the number I signed" is unrecoverable.
    expect(restated.query({ ...base, asOfVintage: 'v1' }).value).toBe(1000);
  });
});

describe('quantity', () => {
  it('sums where every row has one', () => {
    const store = storeWith(
      fact({ accountId: 'revenue', month: '2026-01', amountMinor: 1000, segmentId: 'equipment', quantity: 4 }),
      fact({ accountId: 'revenue', month: '2026-02', amountMinor: 1500, segmentId: 'equipment', quantity: 6 }),
    );
    const r = store.query({ entityId: 'e1', accountId: 'revenue', scope: q1, scenario: 'ACTUAL', versionId: 'actual', segmentId: 'equipment' });
    expect(r.quantity).toBe(10);
  });

  it('is null where any row lacks one, because a partial volume yields a wrong price', () => {
    const store = storeWith(
      fact({ accountId: 'revenue', month: '2026-01', amountMinor: 1000, segmentId: 'equipment', quantity: 4 }),
      // Project revenue has no natural unit.
      fact({ accountId: 'revenue', month: '2026-02', amountMinor: 1500, segmentId: 'projects', quantity: null }),
    );
    const r = store.query({ entityId: 'e1', accountId: 'revenue', scope: q1, scenario: 'ACTUAL', versionId: 'actual' });
    expect(r.value).toBe(2500);
    // 4 units for £2,500 would imply a price of £625 for something that is mostly not units at all.
    expect(r.quantity).toBeNull();
  });
});

describe('the store refuses a figure it cannot reconcile', () => {
  it('rejects a fractional amount, naming the account and the month', () => {
    const store = new FactStore(order);
    expect(() => store.add(fact({ accountId: 'cash', month: '2026-01', amountMinor: 100.5 }))).toThrow(
      /integers in minor units/,
    );
  });
});

describe('scenarios and versions are separate keys', () => {
  it('so a budget figure can never be read as an actual', () => {
    const store = storeWith(
      fact({ accountId: 'revenue', month: '2026-01', amountMinor: 100, scenario: 'ACTUAL', versionId: 'actual' }),
      fact({ accountId: 'revenue', month: '2026-01', amountMinor: 90, scenario: 'BUDGET', versionId: 'budget-fy26' }),
      fact({ accountId: 'revenue', month: '2026-01', amountMinor: 95, scenario: 'FORECAST', versionId: 'v6' }),
    );
    const at = (scenario: 'ACTUAL' | 'BUDGET' | 'FORECAST', versionId: string): number | null =>
      store.query({ entityId: 'e1', accountId: 'revenue', scope: monthScope('2026-01'), scenario, versionId }).value;

    expect(at('ACTUAL', 'actual')).toBe(100);
    expect(at('BUDGET', 'budget-fy26')).toBe(90);
    expect(at('FORECAST', 'v6')).toBe(95);
    // A version that does not exist is absent, not empty-and-therefore-zero.
    expect(at('FORECAST', 'v9')).toBeNull();
    expect(store.versionsOf('FORECAST')).toEqual(['v6']);
  });
});
