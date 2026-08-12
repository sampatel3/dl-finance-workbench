/**
 * Consolidation.
 *
 * Five entities in four currencies become one group, and three things have to happen in the right
 * order or the result balances and lies:
 *
 *   1. **Translate.** Each entity's figures move from its functional currency into the group's
 *      presentation currency — balance sheet at the closing rate, profit and loss at the average
 *      rate. Because those differ, a translated balance sheet does not balance on its own, and the
 *      difference is the **cumulative translation reserve** inside equity. It is not a profit and
 *      not an error.
 *
 *   2. **Eliminate.** Sales inside the group are not group revenue, and a receivable from a sister
 *      company is not a group asset. What is eliminated is the **matched** amount; anything left
 *      over is an unreconciled intercompany difference, which is reported rather than absorbed. A
 *      consolidation that forces the two sides to agree destroys the only evidence that they do
 *      not.
 *
 *   3. **Attribute.** Where the group does not own an entity outright, the share it does not own is
 *      a non-controlling interest — a component of group equity, not a deduction from it, because
 *      full consolidation brings in 100% of the assets and liabilities.
 *
 * Doing these in any other order produces figures that are individually explicable and collectively
 * wrong. Eliminating before translating, in particular, eliminates at the wrong rate.
 */

import type { AccountCode } from './taxonomy.ts';
import { ACCOUNTS, account, accountsOnSide, translateAtOf } from './taxonomy.ts';
import type { Currency, Entity } from './entities.ts';
import { PRESENTATION, entity, tradingEntities } from './entities.ts';
import type { Scenario } from './facts.ts';
import type { FactStore } from './facts.ts';
import type { CurrencyLens, Rates } from './currency.ts';
import { rateFor, translate } from './currency.ts';
import type { PeriodScope } from './period.ts';

export interface ConsolidationRequest {
  readonly store: FactStore;
  readonly rates: Rates;
  readonly scope: PeriodScope;
  readonly scenario: Scenario;
  readonly versionId: string;
  readonly lens: CurrencyLens;
  /** A constant-currency lens borrows this window's rates. */
  readonly comparativeScope?: PeriodScope;
  /**
   * The entities to include. Defaults to every trading entity; a business-unit controller's grant
   * narrows it, and the consolidation is then honestly a sub-consolidation rather than the group.
   */
  readonly entityIds?: readonly string[];
  /** Read the world as it stood in a given load. */
  readonly asOfVintage?: string;
}

/** One account, per entity and in total, all in presentation currency. */
export interface ConsolidatedLine {
  readonly accountId: AccountCode;
  readonly byEntity: ReadonlyMap<string, number>;
  /** Sum across entities, before elimination. */
  readonly combined: number;
  /** The matched intercompany amount removed. Zero for every non-intercompany account. */
  readonly eliminated: number;
  /** What the group reports: combined less eliminated. */
  readonly group: number;
}

export interface Consolidation {
  readonly scope: PeriodScope;
  readonly lens: CurrencyLens;
  readonly versionId: string;
  readonly lines: ReadonlyMap<AccountCode, ConsolidatedLine>;
  /** The translation reserve, by entity and in total. Zero for entities that report in sterling. */
  readonly translationReserve: number;
  readonly reserveByEntity: ReadonlyMap<string, number>;
  /** The share of net assets the group does not own. A component of equity. */
  readonly nonControllingInterest: number;
  /**
   * What did not match. Both are reported, in presentation currency, and both being non-zero is a
   * failed intercompany reconciliation rather than a rounding artefact.
   */
  readonly unreconciled: {
    /** Group revenue less group intercompany cost — a cut-off difference in the profit and loss. */
    readonly trading: number;
    /** Group intercompany receivables less payables — the same difference on the balance sheet. */
    readonly balance: number;
  };
  readonly entityIds: readonly string[];
}

/** Read one account for one entity, translated into presentation currency. */
function translatedAmount(
  request: ConsolidationRequest,
  e: Entity,
  accountId: AccountCode,
): number | null {
  const result = request.store.query({
    entityId: e.id,
    accountId,
    scope: request.scope,
    scenario: request.scenario,
    versionId: request.versionId,
    // Aggregate rows only. Cost-centre and segment rows are children of these, and summing both
    // levels is the double-count the grain exists to prevent.
    costCentreId: null,
    segmentId: null,
    ...(request.asOfVintage === undefined ? {} : { asOfVintage: request.asOfVintage }),
  });
  if (result.value === null) return null;

  const rate = rateFor(
    {
      lens: request.lens,
      rates: request.rates,
      scope: request.scope,
      ...(request.comparativeScope === undefined ? {} : { comparativeScope: request.comparativeScope }),
    },
    e.functional,
    translateAtOf(accountId),
  );
  return rate === null ? result.value : translate(result.value, e.functional, rate);
}

/**
 * Revenue is held by segment, so its aggregate row does not exist — a segmented account's total is
 * the sum of its segments, and asking for `segmentId: null` correctly finds nothing.
 */
const SEGMENTED: ReadonlySet<AccountCode> = new Set<AccountCode>(['revenue', 'cost_of_sales']);

function translatedSegmentedTotal(
  request: ConsolidationRequest,
  e: Entity,
  accountId: AccountCode,
): number | null {
  const result = request.store.query({
    entityId: e.id,
    accountId,
    scope: request.scope,
    scenario: request.scenario,
    versionId: request.versionId,
    costCentreId: null,
    // `undefined` rather than `null`: every segment, summed.
    ...(request.asOfVintage === undefined ? {} : { asOfVintage: request.asOfVintage }),
  });
  if (result.value === null) return null;
  const rate = rateFor(
    {
      lens: request.lens,
      rates: request.rates,
      scope: request.scope,
      ...(request.comparativeScope === undefined ? {} : { comparativeScope: request.comparativeScope }),
    },
    e.functional,
    translateAtOf(accountId),
  );
  return rate === null ? result.value : translate(result.value, e.functional, rate);
}

export function consolidate(request: ConsolidationRequest): Consolidation {
  const entities = (request.entityIds ?? tradingEntities().map((e) => e.id)).map(entity);
  const lines = new Map<AccountCode, ConsolidatedLine>();

  for (const a of ACCOUNTS) {
    const byEntity = new Map<string, number>();
    for (const e of entities) {
      const amount = SEGMENTED.has(a.code)
        ? translatedSegmentedTotal(request, e, a.code)
        : translatedAmount(request, e, a.code);
      if (amount !== null) byEntity.set(e.id, amount);
    }
    const combined = [...byEntity.values()].reduce((sum, v) => sum + v, 0);
    lines.set(a.code, { accountId: a.code, byEntity, combined, eliminated: 0, group: combined });
  }

  // ---- eliminate the matched intercompany amounts
  const eliminateAgainst = (a: AccountCode, b: AccountCode): number => {
    const left = lines.get(a);
    const right = lines.get(b);
    if (left === undefined || right === undefined) return 0;
    // The matched amount is the lesser of the two sides. Removing the larger from both would
    // manufacture a negative balance out of a reconciliation difference.
    const matched = Math.min(left.combined, right.combined);
    lines.set(a, { ...left, eliminated: matched, group: left.combined - matched });
    lines.set(b, { ...right, eliminated: matched, group: right.combined - matched });
    return matched;
  };

  eliminateAgainst('revenue_ic', 'cost_of_sales_ic');
  eliminateAgainst('receivables_ic', 'payables_ic');

  const unreconciled = {
    trading: (lines.get('revenue_ic')?.group ?? 0) - (lines.get('cost_of_sales_ic')?.group ?? 0),
    balance: (lines.get('receivables_ic')?.group ?? 0) - (lines.get('payables_ic')?.group ?? 0),
  };

  // ---- the translation reserve
  //
  // Per entity: the residual that makes its TRANSLATED balance sheet balance. Assets and
  // liabilities have moved at the closing rate and equity at the average rate, so the residual is
  // real, and it is the reserve.
  //
  // Simplification, stated because it matters to anyone checking: proper practice translates each
  // historical equity movement at the rate ruling when it happened. Here share capital and retained
  // earnings move at the window's average rate, which produces a reserve of the right sign and
  // order of magnitude from one rate lookup rather than from a full equity history. A pilot with
  // real books needs the history; a demo showing that the reserve exists and where it sits does
  // not.
  const reserveByEntity = new Map<string, number>();
  for (const e of entities) {
    if (e.functional === PRESENTATION) {
      reserveByEntity.set(e.id, 0);
      continue;
    }
    const assets = sideTotal(lines, 'asset', e.id);
    const liabilities = sideTotal(lines, 'liability', e.id);
    const capital = (lines.get('share_capital')?.byEntity.get(e.id) ?? 0)
      + (lines.get('retained_earnings')?.byEntity.get(e.id) ?? 0);
    reserveByEntity.set(e.id, assets - liabilities - capital);
  }
  const translationReserve = [...reserveByEntity.values()].reduce((sum, v) => sum + v, 0);

  // The reserve is an equity account, so the group's line for it is the sum of the residuals rather
  // than the zeroes each entity emits against its own books.
  const reserveLine = lines.get('translation_reserve');
  if (reserveLine !== undefined) {
    lines.set('translation_reserve', {
      ...reserveLine,
      byEntity: reserveByEntity,
      combined: translationReserve,
      group: translationReserve,
    });
  }

  // ---- non-controlling interests
  const nonControllingInterest = entities.reduce((sum, e) => {
    if (e.ownership >= 1) return sum;
    const netAssets = sideTotal(lines, 'asset', e.id) - sideTotal(lines, 'liability', e.id);
    return sum + Math.round(netAssets * (1 - e.ownership));
  }, 0);

  return {
    scope: request.scope,
    lens: request.lens,
    versionId: request.versionId,
    lines,
    translationReserve,
    reserveByEntity,
    nonControllingInterest,
    unreconciled,
    entityIds: entities.map((e) => e.id),
  };
}

function sideTotal(
  lines: ReadonlyMap<AccountCode, ConsolidatedLine>,
  side: 'asset' | 'liability' | 'equity',
  entityId?: string,
): number {
  return accountsOnSide(side).reduce((sum, code) => {
    const line = lines.get(code);
    if (line === undefined) return sum;
    return sum + (entityId === undefined ? line.group : (line.byEntity.get(entityId) ?? 0));
  }, 0);
}

/** The three totals the identity check compares, at group level. */
export function balanceSheetTotals(c: Consolidation): {
  assets: number;
  liabilities: number;
  equity: number;
  difference: number;
} {
  const assets = sideTotal(c.lines, 'asset');
  const liabilities = sideTotal(c.lines, 'liability');
  const equity = sideTotal(c.lines, 'equity');
  return { assets, liabilities, equity, difference: assets - liabilities - equity };
}

/**
 * Group revenue, gross profit and EBITDA — the three the executive surface leads with.
 *
 * Defined here rather than in the measure catalogue because the consolidation is what knows which
 * intercompany amounts survived elimination, and a gross margin computed from pre-elimination
 * revenue is wrong by the size of the internal trade.
 */
export function groupPl(c: Consolidation): {
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  ebitda: number;
  depreciation: number;
  interest: number;
  tax: number;
  netIncome: number;
} {
  const g = (code: AccountCode): number => c.lines.get(code)?.group ?? 0;

  const revenue = g('revenue') + g('revenue_ic');
  const costOfSales = g('cost_of_sales') + g('cost_of_sales_ic') + g('subcontract_cost');
  const grossProfit = revenue - costOfSales;
  const opex = g('staff_cost') + g('other_opex') + g('unmapped_opex');
  const ebitda = grossProfit - opex;
  const depreciation = g('depreciation');
  const interest = g('interest_expense');
  const tax = g('tax_expense');

  return {
    revenue,
    costOfSales,
    grossProfit,
    ebitda,
    depreciation,
    interest,
    tax,
    netIncome: ebitda - depreciation - interest - tax,
  };
}

/** Every account with a non-zero elimination — the Controls surface's elimination list. */
export function eliminations(c: Consolidation): { accountId: AccountCode; label: string; amount: number }[] {
  return [...c.lines.values()]
    .filter((line) => line.eliminated !== 0)
    .map((line) => ({ accountId: line.accountId, label: account(line.accountId).label, amount: line.eliminated }));
}

/** The presentation currency, restated here so callers need not import two modules to format. */
export const PRESENTATION_CURRENCY: Currency = PRESENTATION;
