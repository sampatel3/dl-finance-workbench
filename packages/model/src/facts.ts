/**
 * The fact store.
 *
 * One numeric table. Every figure the product shows — every board item, every bridge bar, every
 * cell of the analyst grid, every citation under an answer — resolves to a query over it. Ratios
 * never live here; they are computed from facts, every time.
 *
 * Five rules do most of the work, and each of them is a defect this file exists to make impossible.
 *
 *   1. **Amounts are signed integers in minor units.** Never floats. A balance sheet that has to
 *      reconcile to the penny across five entities and four currencies cannot be built on binary
 *      fractions, and the moment one figure is off by 0.01 nobody trusts any of them.
 *
 *   2. **A null dimension means the aggregate, and it is a different row from its children.** A
 *      cost-centre row and its entity total are separate facts, so a query for the entity total
 *      filters on `costCentreId === null` and no caller can accidentally sum both levels. This is
 *      the double-count the product cannot afford, and it is prevented by construction rather than
 *      by remembering.
 *
 *   3. **`quantity` sits beside `amountMinor`.** Without a volume on the same row, a variance can
 *      only ever be a delta — price, volume and mix are not derivable from money alone. It is the
 *      one field the client's data model was missing that most changes what the product can do.
 *
 *   4. **Nothing is updated in place.** A correction arrives as a new `vintageId`; the old rows
 *      stay. Which means a query has to decide which vintage it is reading, and by default it reads
 *      the latest — with `asOfVintage` to wind back to what a figure was when somebody approved it.
 *
 *   5. **A missing month returns `null`, never `0`.** A missing month and a genuine zero are
 *      different facts about the world, and a product that renders them identically will eventually
 *      tell a chief financial officer their cash is zero.
 *
 * The in-memory implementation is the demo's storage. The shape is the production schema: swapping
 * it for Postgres changes this file and nothing above it.
 */

import type { AccountCode, CostCentreCode, SegmentCode } from './taxonomy.ts';
import { basisOf } from './taxonomy.ts';
import type { FiscalMonth, PeriodScope } from './period.ts';
import { compareMonths, monthsBetween } from './period.ts';

/** What the number is: an actual, a budget, or a forecast. */
export type Scenario = 'ACTUAL' | 'BUDGET' | 'FORECAST';

export interface Fact {
  readonly entityId: string;
  readonly accountId: AccountCode;
  readonly month: FiscalMonth;
  readonly scenario: Scenario;
  /** The version within that scenario. `ACTUAL` uses `'actual'`. */
  readonly versionId: string;
  /** Null for the entity total; set for one cost centre. */
  readonly costCentreId: CostCentreCode | null;
  /** Null for unsegmented; set for one revenue segment. */
  readonly segmentId: SegmentCode | null;
  /** The immutable load this row arrived in. */
  readonly vintageId: string;
  /** Signed, in minor units of the entity's functional currency. */
  readonly amountMinor: number;
  /**
   * The volume behind the amount, in whole units, or null where the account has no natural
   * quantity. Null is a real answer: an overhead recharge has no units, and a bridge that invents
   * a price for one is worse than a bridge that reports a rate effect.
   */
  readonly quantity: number | null;
}

/**
 * A query.
 *
 * `undefined` on a dimension means "any" — it does not filter. `null` means the aggregate row.
 * The distinction is the whole of rule 2, and it is why these fields are optional rather than
 * nullable-with-a-default: a caller who forgets `costCentreId` gets every level summed together,
 * loudly wrong, rather than quietly wrong.
 */
export interface FactQuery {
  readonly entityId: string;
  readonly accountId: AccountCode;
  readonly scope: PeriodScope;
  readonly scenario: Scenario;
  readonly versionId: string;
  readonly costCentreId?: CostCentreCode | null;
  readonly segmentId?: SegmentCode | null;
  /**
   * Read the world as it stood in a given vintage, ignoring anything loaded later. This is what a
   * published board pack pins, and what makes "the figure I approved" reproducible.
   */
  readonly asOfVintage?: string;
}

/** What a query returns: the value, and enough to show where it came from. */
export interface FactResult {
  readonly value: number | null;
  readonly quantity: number | null;
  readonly basis: 'flow' | 'balance' | 'avg_balance';
  readonly monthsUsed: FiscalMonth[];
  /** The rows behind the value. This is where the drill spine terminates. */
  readonly rows: readonly Fact[];
  /** Every vintage that contributed, so a figure can name its own provenance. */
  readonly vintageIds: string[];
}

/** Vintage ordering, so "the latest load wins" is a decision this store can make. */
export interface VintageOrder {
  /** Lower sorts earlier. */
  rank(vintageId: string): number;
}

const EMPTY: FactResult = {
  value: null,
  quantity: null,
  basis: 'flow',
  monthsUsed: [],
  rows: [],
  vintageIds: [],
};

export class FactStore {
  /** Keyed by `entity|account|scenario|version` so the common query touches a small array. */
  readonly #byKey = new Map<string, Fact[]>();
  readonly #order: VintageOrder;

  /**
   * The store needs to know which of two loads is later, and it deliberately does not work it out
   * from the id. Ids sort lexically; a restatement loaded in July but named for the month it
   * corrects would lose to the load it replaces. The register that knows load times supplies the
   * order.
   */
  constructor(order: VintageOrder) {
    this.#order = order;
  }

  static keyOf(fact: Pick<Fact, 'entityId' | 'accountId' | 'scenario' | 'versionId'>): string {
    return `${fact.entityId}|${fact.accountId}|${fact.scenario}|${fact.versionId}`;
  }

  add(fact: Fact): void {
    if (!Number.isInteger(fact.amountMinor)) {
      throw new Error(
        `${fact.accountId} in ${fact.month} for ${fact.entityId} is ${fact.amountMinor}: amounts are ` +
          'integers in minor units, and a fraction here is a rounding decision somebody took ' +
          'upstream without recording it',
      );
    }
    const key = FactStore.keyOf(fact);
    const bucket = this.#byKey.get(key);
    if (bucket) bucket.push(fact);
    else this.#byKey.set(key, [fact]);
  }

  addAll(facts: readonly Fact[]): void {
    for (const fact of facts) this.add(fact);
  }

  get size(): number {
    let n = 0;
    for (const bucket of this.#byKey.values()) n += bucket.length;
    return n;
  }

  /**
   * Evaluate an account over a window, according to its basis.
   *
   *   flow        → summed across the months
   *   balance     → read at the last month that has a fact
   *   avg_balance → the mean across the months that have facts
   *
   * Where two vintages both cover a month, the later one wins and the earlier is not summed with
   * it — which is the single most important line in this method, because summing them silently
   * doubles a restated period.
   */
  query(q: FactQuery): FactResult {
    const basis = basisOf(q.accountId);
    const bucket = this.#byKey.get(FactStore.keyOf(q));
    if (bucket === undefined || bucket.length === 0) return { ...EMPTY, basis };

    const window = new Set(monthsBetween(q.scope.startMonth, q.scope.endMonth));
    const candidates = bucket.filter((f) => {
      if (!window.has(f.month)) return false;
      if (q.costCentreId !== undefined && f.costCentreId !== q.costCentreId) return false;
      if (q.segmentId !== undefined && f.segmentId !== q.segmentId) return false;
      if (
        q.asOfVintage !== undefined &&
        this.#order.rank(f.vintageId) > this.#order.rank(q.asOfVintage)
      ) {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) return { ...EMPTY, basis };

    const rows = this.#latestVintagePerCell(candidates);
    const monthsUsed = [...new Set(rows.map((r) => r.month))].sort(compareMonths);
    const vintageIds = [...new Set(rows.map((r) => r.vintageId))].sort();

    if (basis === 'balance') {
      // Point in time: the latest month present, summed across whatever dimensions matched.
      const latest = monthsUsed[monthsUsed.length - 1];
      if (latest === undefined) return { ...EMPTY, basis };
      const atLatest = rows.filter((r) => r.month === latest);
      return {
        value: sumAmounts(atLatest),
        quantity: sumQuantities(atLatest),
        basis,
        monthsUsed: [latest],
        rows: atLatest,
        vintageIds: [...new Set(atLatest.map((r) => r.vintageId))].sort(),
      };
    }

    const total = sumAmounts(rows);

    if (basis === 'avg_balance') {
      // The mean across months that HAVE a fact, not across the window. A window with a gap in it
      // must not be diluted by the gap — the figure is an average of what exists.
      return {
        value: Math.round(total / monthsUsed.length),
        quantity: sumQuantities(rows),
        basis,
        monthsUsed,
        rows,
        vintageIds,
      };
    }

    return { value: total, quantity: sumQuantities(rows), basis, monthsUsed, rows, vintageIds };
  }

  /**
   * Keep only the highest-ranked vintage for each distinct cell.
   *
   * A cell is one month at one set of dimensions. Two loads covering the same cell are a
   * restatement, and a restatement replaces rather than adds.
   */
  #latestVintagePerCell(rows: readonly Fact[]): Fact[] {
    const best = new Map<string, Fact>();
    for (const row of rows) {
      const cell = `${row.month}|${row.costCentreId ?? ''}|${row.segmentId ?? ''}`;
      const held = best.get(cell);
      if (
        held === undefined ||
        this.#order.rank(row.vintageId) > this.#order.rank(held.vintageId)
      ) {
        best.set(cell, row);
      }
    }
    return [...best.values()].sort(
      (a, b) =>
        compareMonths(a.month, b.month) || (a.segmentId ?? '').localeCompare(b.segmentId ?? ''),
    );
  }

  /** The value in each month of a window — what every trend line is drawn from. */
  series(q: FactQuery): { month: FiscalMonth; value: number | null }[] {
    return monthsBetween(q.scope.startMonth, q.scope.endMonth).map((month) => {
      const r = this.query({
        ...q,
        scope: { type: 'MONTH', startMonth: month, endMonth: month, label: month },
      });
      return { month, value: r.value };
    });
  }

  /** Every month with at least one fact for an entity, ascending. */
  monthsWithData(entityId: string): FiscalMonth[] {
    const months = new Set<FiscalMonth>();
    for (const [key, bucket] of this.#byKey) {
      if (!key.startsWith(`${entityId}|`)) continue;
      for (const fact of bucket) months.add(fact.month);
    }
    return [...months].sort(compareMonths);
  }

  /** Every version present for a scenario — what the version selector is built from. */
  versionsOf(scenario: Scenario): string[] {
    const versions = new Set<string>();
    for (const key of this.#byKey.keys()) {
      const parts = key.split('|');
      if (parts[2] === scenario && parts[3] !== undefined) versions.add(parts[3]);
    }
    return [...versions].sort();
  }

  /** Segments carrying facts for an account — the mix denominator. */
  segmentsWithData(entityId: string, accountId: AccountCode): SegmentCode[] {
    const out = new Set<SegmentCode>();
    for (const [key, bucket] of this.#byKey) {
      if (!key.startsWith(`${entityId}|${accountId}|`)) continue;
      for (const fact of bucket) if (fact.segmentId !== null) out.add(fact.segmentId);
    }
    return [...out].sort();
  }
}

function sumAmounts(rows: readonly Fact[]): number {
  return rows.reduce((sum, r) => sum + r.amountMinor, 0);
}

/**
 * Quantities sum only where every contributing row has one.
 *
 * A partial sum is the dangerous answer: it looks like a volume and is a volume for some of the
 * rows, so a price derived from it is wrong in a way no test would catch. One missing quantity
 * makes the whole quantity unknown, which is what null is for.
 */
function sumQuantities(rows: readonly Fact[]): number | null {
  let total = 0;
  for (const row of rows) {
    if (row.quantity === null) return null;
    total += row.quantity;
  }
  return rows.length === 0 ? null : total;
}
