/**
 * The arithmetic a controller checks first.
 *
 * These are the tests that decide whether anything else in the product is worth reading. If assets
 * do not equal liabilities plus equity, or a segment table does not roll up to the statement above
 * it, then every figure on every screen is suspect and no amount of design fixes it.
 *
 * They are asserted **to the penny**, not to a tolerance. A tolerance here would be a place for a
 * real defect to hide: the identity either holds by construction or it is being plugged somewhere,
 * and a test that accepts "close enough" cannot tell those apart.
 */

import { describe, expect, it } from 'vitest';

import { ACCOUNTS, accountsOnSide } from './taxonomy.ts';
import { PRESENTATION, tradingEntities } from './entities.ts';
import { ACTUAL_VERSION, IC_MATERIALITY_MINOR, IC_MISMATCH_MONTH, MONTHS, SEED_END, buildWorld } from './seed.ts';
import { monthScope } from './period.ts';
import { balanceSheetTotals, consolidate } from './consolidate.ts';
import type { AccountCode } from './taxonomy.ts';
import type { FiscalMonth } from './period.ts';
import type { World } from './seed.ts';

const world = buildWorld({ seed: 'kestrel-industrial-group' });

/** One account for one entity in one month, in the entity's own currency. Absent reads as zero. */
function value(w: World, entityId: string, accountId: AccountCode, month: FiscalMonth): number {
  return (
    w.store.query({
      entityId,
      accountId,
      scope: monthScope(month),
      scenario: 'ACTUAL',
      versionId: ACTUAL_VERSION,
      costCentreId: null,
      segmentId: null,
    }).value ?? 0
  );
}

function sideTotal(w: World, entityId: string, side: 'asset' | 'liability' | 'equity', month: FiscalMonth): number {
  return accountsOnSide(side).reduce((sum, code) => sum + value(w, entityId, code, month), 0);
}

describe('the balance sheet identity', () => {
  it('holds to the penny for every entity in every month', () => {
    const failures: string[] = [];
    for (const e of tradingEntities()) {
      for (const month of MONTHS) {
        const assets = sideTotal(world, e.id, 'asset', month);
        const liabilities = sideTotal(world, e.id, 'liability', month);
        const equity = sideTotal(world, e.id, 'equity', month);
        const difference = assets - liabilities - equity;
        if (difference !== 0) failures.push(`${e.id} ${month}: ${difference}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('holds for the consolidated group, after translation and elimination', () => {
    // Every month, not only the reporting one: a translation that balances in July and not in
    // February is a translation that happens to be right once.
    const failures: string[] = [];
    for (const month of MONTHS) {
      const c = consolidate({
        store: world.store,
        rates: world.rates,
        scope: monthScope(month),
        scenario: 'ACTUAL',
        versionId: ACTUAL_VERSION,
        lens: 'reported',
      });
      const { difference } = balanceSheetTotals(c);
      if (difference !== 0) failures.push(`${month}: ${difference}`);
    }
    expect(failures).toEqual([]);
  });

  it('carries a non-zero translation reserve, and only for entities that do not report in sterling', () => {
    const c = consolidate({
      store: world.store,
      rates: world.rates,
      scope: monthScope(SEED_END),
      scenario: 'ACTUAL',
      versionId: ACTUAL_VERSION,
      lens: 'reported',
    });

    // A reserve that is always zero is the signature of a currency model that has stopped
    // translating — it is what a single-rate translation produces, and it balances perfectly.
    expect(c.translationReserve).not.toBe(0);

    for (const e of tradingEntities()) {
      const reserve = c.reserveByEntity.get(e.id) ?? 0;
      if (e.functional === PRESENTATION) expect(reserve).toBe(0);
      else expect(reserve).not.toBe(0);
    }
  });
});

describe('children sum to their parents', () => {
  it('revenue segments sum exactly to entity revenue', () => {
    const failures: string[] = [];
    for (const e of tradingEntities()) {
      for (const month of [MONTHS[0], MONTHS[20], SEED_END]) {
        if (month === undefined) continue;
        const scope = monthScope(month);
        const total = world.store.query({
          entityId: e.id,
          accountId: 'revenue',
          scope,
          scenario: 'ACTUAL',
          versionId: ACTUAL_VERSION,
          costCentreId: null,
        }).value;
        const segments = world.store.segmentsWithData(e.id, 'revenue');
        const summed = segments.reduce(
          (sum, segmentId) =>
            sum +
            (world.store.query({
              entityId: e.id,
              accountId: 'revenue',
              scope,
              scenario: 'ACTUAL',
              versionId: ACTUAL_VERSION,
              costCentreId: null,
              segmentId,
            }).value ?? 0),
          0,
        );
        if (total !== summed) failures.push(`${e.id} ${month}: ${total} vs ${summed}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('cost centres sum exactly to the entity total, and the two are different rows', () => {
    const month = SEED_END;
    const scope = monthScope(month);
    for (const e of tradingEntities()) {
      for (const accountId of ['staff_cost', 'other_opex'] as const) {
        // `costCentreId: null` is the aggregate row.
        const aggregate = world.store.query({
          entityId: e.id,
          accountId,
          scope,
          scenario: 'ACTUAL',
          versionId: ACTUAL_VERSION,
          costCentreId: null,
          segmentId: null,
        }).value;

        // `costCentreId: undefined` is every row at any level — the aggregate AND its children,
        // which is exactly the double-count the grain exists to prevent. So it must be twice the
        // aggregate, and if it is ever equal to it the two levels have collapsed into one.
        const everything = world.store.query({
          entityId: e.id,
          accountId,
          scope,
          scenario: 'ACTUAL',
          versionId: ACTUAL_VERSION,
          segmentId: null,
        }).value;

        expect(aggregate).not.toBeNull();
        expect(everything).toBe((aggregate ?? 0) * 2);
      }
    }
  });
});

describe('intercompany', () => {
  it('matches in every month except the one where a mismatch is planted', () => {
    const unmatched: { month: FiscalMonth; difference: number }[] = [];
    for (const month of MONTHS) {
      const c = consolidate({
        store: world.store,
        rates: world.rates,
        scope: monthScope(month),
        scenario: 'ACTUAL',
        versionId: ACTUAL_VERSION,
        lens: 'reported',
      });
      // Above the reconciliation's own threshold, not merely non-zero: translating two sides of
      // one transaction into two minor units rounds each of them, and reporting those pennies would
      // bury the break that is real.
      if (Math.abs(c.unreconciled.trading) > IC_MATERIALITY_MINOR) {
        unmatched.push({ month, difference: c.unreconciled.trading });
      }
    }

    expect(unmatched.map((u) => u.month)).toEqual([IC_MISMATCH_MONTH]);
    // Around the planted £48,000: the mismatch is defined as a sterling amount converted at the
    // transfer-pricing rate and read back at July's actual rate, so it is not identical to it —
    // which is honest, and is why the check on screen reports the figure it computes rather than
    // the figure it was told to expect.
    const difference = (unmatched[0]?.difference ?? 0) / 100;
    expect(difference).toBeGreaterThan(47_000);
    expect(difference).toBeLessThan(49_000);
  });

  it('leaves the group balanced despite the mismatch, because both sides of it are missing', () => {
    // The Gulf entity did not record the invoice at all: its cost and its payable are both short by
    // the same amount, so its own books balance, and the group carries the difference as an
    // unreconciled receivable matched by the profit that was never charged to it. A demo that
    // planted only the balance-sheet half would show a broken group and call it a feature.
    const c = consolidate({
      store: world.store,
      rates: world.rates,
      scope: monthScope(IC_MISMATCH_MONTH),
      scenario: 'ACTUAL',
      versionId: ACTUAL_VERSION,
      lens: 'reported',
    });
    expect(balanceSheetTotals(c).difference).toBe(0);
    expect(Math.abs(c.unreconciled.balance)).toBeGreaterThan(IC_MATERIALITY_MINOR);
  });

  it('eliminates something, and eliminates it from both sides equally', () => {
    const c = consolidate({
      store: world.store,
      rates: world.rates,
      scope: monthScope(SEED_END),
      scenario: 'ACTUAL',
      versionId: ACTUAL_VERSION,
      lens: 'reported',
    });
    const revenueIc = c.lines.get('revenue_ic');
    const costIc = c.lines.get('cost_of_sales_ic');
    expect(revenueIc?.eliminated).toBeGreaterThan(0);
    expect(revenueIc?.eliminated).toBe(costIc?.eliminated);
    // And group revenue is genuinely smaller than the sum of its entities', which is the first
    // thing a reader notices about a consolidation and the first thing they ask about.
    expect(revenueIc?.group).toBeLessThan(revenueIc?.combined ?? 0);
  });
});

describe('every amount is an integer number of minor units', () => {
  it('holds for every fact in the world', () => {
    // The store rejects a fractional amount on `add`, so this passing means the seed never tried.
    // It is asserted anyway because the guard is the kind of thing somebody removes to make a test
    // pass, and then the balance sheet is out by a penny somewhere nobody looks.
    const offenders: string[] = [];
    for (const a of ACCOUNTS) {
      for (const e of tradingEntities()) {
        const result = world.store.query({
          entityId: e.id,
          accountId: a.code,
          scope: monthScope(SEED_END),
          scenario: 'ACTUAL',
          versionId: ACTUAL_VERSION,
        });
        for (const row of result.rows) {
          if (!Number.isInteger(row.amountMinor)) offenders.push(`${e.id} ${a.code}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
