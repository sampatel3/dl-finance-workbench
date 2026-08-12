/**
 * Computing a measure, and recording what it was computed from.
 *
 * This file is the bottom of the drill spine, and the spine is the product's central claim: the
 * figure on the executive surface, the cell in the analyst grid, the citation under an answer and the
 * number in a board pack are **one computation**, and any of them can be opened to the rows beneath.
 *
 * The mechanism is small and it is structural rather than disciplinary. A measure definition cannot
 * reach the store — it is handed a `get` and nothing else — so every account it touches is recorded
 * on the way past, with its value, the months it used, how many rows it summed and which loads they
 * came from. Lineage, the formula popover, the analyst drill and AI traceability are then the same
 * object seen from four places, rather than four features that will eventually disagree.
 *
 * Two paths into the data, and the difference matters:
 *
 *   **Consolidated** — no segment or cost-centre filter. Goes through `consolidate`, which
 *   translates, eliminates matched intercompany trade and carries the translation reserve. This is
 *   the only path that may be called a group figure.
 *
 *   **Sliced** — a segment or a cost centre is named. Queries each entity directly and translates,
 *   with no elimination, because intercompany accounts carry no segment and a segment-level
 *   elimination would be arithmetic without a meaning. A sliced total is therefore *combined* rather
 *   than consolidated, and `MeasureValue.consolidated` says which it is so nothing downstream can
 *   quietly present one as the other.
 */

import type {
  AccountCode,
  Consolidation,
  CostCentreCode,
  CurrencyLens,
  FactStore,
  FiscalMonth,
  PeriodScope,
  Polarity,
  Rates,
  Scenario,
  SegmentCode,
} from '@kestrel/model';
import {
  consolidate,
  entity,
  isNonMonetary,
  monthScope,
  monthsBetween,
  tradingEntities,
  translate,
  translateAtOf,
  rateFor,
} from '@kestrel/model';

import type { MeasureDefinition, Resolver } from './catalogue.ts';
import { annualisationFor, measure } from './catalogue.ts';
import type { Unit } from './units.ts';

export interface MeasureContext {
  readonly store: FactStore;
  readonly rates: Rates;
  readonly scope: PeriodScope;
  readonly scenario: Scenario;
  readonly versionId: string;
  readonly lens: CurrencyLens;
  /** The entities in view — a principal's subtree, never a free choice. */
  readonly entityIds: readonly string[];
  /** The window a constant-currency lens borrows its rates from. */
  readonly comparativeScope?: PeriodScope;
  readonly asOfVintage?: string;
  readonly segmentId?: SegmentCode;
  readonly costCentreId?: CostCentreCode;
}

/** One account a measure read, and enough to open it. */
export interface MeasureInput {
  readonly accountId: AccountCode;
  readonly label: string;
  readonly value: number | null;
  readonly monthsUsed: readonly FiscalMonth[];
  readonly rowCount: number;
  readonly vintageIds: readonly string[];
  /** The same figure per entity, which is the first level of the drill. */
  readonly byEntity: ReadonlyMap<string, number>;
}

export interface MeasureValue {
  readonly measure: string;
  readonly label: string;
  readonly unit: Unit;
  readonly polarity: Polarity;
  readonly formula: string;
  readonly owner: string;
  readonly status: 'approved' | 'draft';
  readonly note?: string;
  /** Currency in minor units; percent and ratio as rates. */
  readonly value: number | null;
  readonly scope: PeriodScope;
  readonly lens: CurrencyLens;
  readonly scenario: Scenario;
  readonly versionId: string;
  readonly entityIds: readonly string[];
  /** True where the figure went through elimination. A sliced figure is combined, not consolidated. */
  readonly consolidated: boolean;
  readonly segmentId?: SegmentCode;
  readonly costCentreId?: CostCentreCode;
  /** Every account the definition read, in the order it read them. */
  readonly inputs: readonly MeasureInput[];
}

// ---------------------------------------------------------------------------
// Reading accounts
// ---------------------------------------------------------------------------

/**
 * Consolidations are memoised.
 *
 * A screen asks for thirty measures over one window, and each of them reads five or six accounts; a
 * consolidation computes every account for every entity in one pass. Without the cache that is
 * thirty passes over the same data for one page. The world is immutable, so nothing is ever
 * invalidated — the cache is a memo, not state.
 *
 * ## The world has to be part of the key
 *
 * It was not, and the omission was expensive. The key named the scope, the scenario, the version, the
 * lens, the entities and the vintage — everything *inside* a world — and left out **which world**.
 * Two worlds exist in this product: the demo's own and the healthy twin whose job is to prove the
 * detectors stay quiet. Querying the same window on the twin returned the real world's cached numbers,
 * so every healthy-twin assertion was reading the real world twice and passing by comparing a thing to
 * itself. The detectors were not proven quiet; they were never asked.
 *
 * It surfaced because the twin reported a planted bias it could not have had. Nothing about it was
 * visible in a figure — the numbers were plausible, self-consistent and wrong about their own
 * provenance, which is the failure mode a cache key produces and the reason identity belongs in the
 * key rather than in a convention about who calls what.
 */
const consolidationCache = new Map<string, Consolidation>();

/**
 * A stable identity per world, assigned on first sight.
 *
 * A WeakMap rather than a field on the store, so no caller can construct a context that forgets to
 * identify itself — the thing that went wrong once already. Both the store and the rate table are
 * identified: they normally travel together out of `buildWorld`, but a test that pairs one world's
 * facts with another's rates is a legitimate thing to do and must not collide.
 */
const worldIds = new WeakMap<object, string>();
let nextWorldId = 0;

function worldId(o: object): string {
  const existing = worldIds.get(o);
  if (existing !== undefined) return existing;
  const assigned = `w${(nextWorldId += 1)}`;
  worldIds.set(o, assigned);
  return assigned;
}

function cacheKey(ctx: MeasureContext): string {
  return [
    worldId(ctx.store),
    worldId(ctx.rates),
    ctx.scope.type,
    ctx.scope.startMonth,
    ctx.scope.endMonth,
    ctx.scenario,
    ctx.versionId,
    ctx.lens,
    ctx.comparativeScope?.startMonth ?? '',
    ctx.comparativeScope?.endMonth ?? '',
    ctx.asOfVintage ?? '',
    [...ctx.entityIds].sort().join(','),
  ].join('|');
}

function consolidationFor(ctx: MeasureContext): Consolidation {
  const key = cacheKey(ctx);
  const hit = consolidationCache.get(key);
  if (hit !== undefined) return hit;
  const built = consolidate({
    store: ctx.store,
    rates: ctx.rates,
    scope: ctx.scope,
    scenario: ctx.scenario,
    versionId: ctx.versionId,
    lens: ctx.lens,
    entityIds: ctx.entityIds,
    ...(ctx.comparativeScope === undefined ? {} : { comparativeScope: ctx.comparativeScope }),
    ...(ctx.asOfVintage === undefined ? {} : { asOfVintage: ctx.asOfVintage }),
  });
  consolidationCache.set(key, built);
  return built;
}

/** Only for tests that need to prove the cache is not the thing making them pass. */
export function resetConsolidationCache(): void {
  consolidationCache.clear();
}

export function isSliced(ctx: MeasureContext): boolean {
  return ctx.segmentId !== undefined || ctx.costCentreId !== undefined;
}

/** The reading of one account, whichever path the context calls for. */
function readAccount(ctx: MeasureContext, accountId: AccountCode): Omit<MeasureInput, 'label'> {
  if (!isSliced(ctx)) {
    const c = consolidationFor(ctx);
    const line = c.lines.get(accountId);
    // A consolidation computes every account, so an absent line means the account produced nothing
    // anywhere — which is a genuine null rather than a missing lookup.
    const value = line === undefined || line.byEntity.size === 0 ? null : line.group;
    return {
      accountId,
      value,
      monthsUsed: monthsBetween(ctx.scope.startMonth, ctx.scope.endMonth),
      rowCount: line?.byEntity.size ?? 0,
      vintageIds: [],
      byEntity: line?.byEntity ?? new Map(),
    };
  }

  // Sliced: query each entity and translate. No elimination — see the file header.
  const byEntity = new Map<string, number>();
  const months = new Set<FiscalMonth>();
  const vintages = new Set<string>();
  let rowCount = 0;
  let any = false;

  for (const entityId of ctx.entityIds) {
    const e = entity(entityId);
    const result = ctx.store.query({
      entityId,
      accountId,
      scope: ctx.scope,
      scenario: ctx.scenario,
      versionId: ctx.versionId,
      ...(ctx.segmentId === undefined ? {} : { segmentId: ctx.segmentId }),
      ...(ctx.costCentreId === undefined
        ? { costCentreId: null }
        : { costCentreId: ctx.costCentreId }),
      ...(ctx.asOfVintage === undefined ? {} : { asOfVintage: ctx.asOfVintage }),
    });
    if (result.value === null) continue;
    any = true;
    const rate = isNonMonetary(accountId)
      ? null
      : rateFor(
          {
            lens: ctx.lens,
            rates: ctx.rates,
            scope: ctx.scope,
            ...(ctx.comparativeScope === undefined
              ? {}
              : { comparativeScope: ctx.comparativeScope }),
          },
          e.functional,
          translateAtOf(accountId),
        );
    byEntity.set(
      entityId,
      rate === null ? result.value : translate(result.value, e.functional, rate),
    );
    for (const month of result.monthsUsed) months.add(month);
    for (const vintage of result.vintageIds) vintages.add(vintage);
    rowCount += result.rows.length;
  }

  return {
    accountId,
    value: any ? [...byEntity.values()].reduce((sum, v) => sum + v, 0) : null,
    monthsUsed: [...months].sort(),
    rowCount,
    vintageIds: [...vintages].sort(),
    byEntity,
  };
}

// ---------------------------------------------------------------------------
// Computing a measure
// ---------------------------------------------------------------------------

/**
 * Compute one measure, recording every account it read.
 *
 * The definition receives `get` and cannot reach anything else, which is what makes the recorded
 * inputs complete by construction rather than by the author of a definition remembering to declare
 * them.
 */
export function computeMeasure(id: string, ctx: MeasureContext): MeasureValue {
  const definition: MeasureDefinition = measure(id);
  const inputs: MeasureInput[] = [];
  const seen = new Map<AccountCode, Omit<MeasureInput, 'label'>>();

  const get: Resolver = (accountId, label) => {
    // An account read twice by one definition is one input, not two. Composite measures read the
    // same account through more than one helper, and a drill-down listing revenue three times reads
    // as a bug even when the arithmetic is right.
    let read = seen.get(accountId);
    if (read === undefined) {
      read = readAccount(ctx, accountId);
      seen.set(accountId, read);
      inputs.push({ ...read, label: label ?? accountLabel(accountId) });
    }
    return read.value;
  };

  const raw = definition.compute(get, { scope: ctx.scope });
  const value = raw === null ? null : raw * annualisationFor(definition, ctx.scope);

  return {
    measure: definition.id,
    label: definition.label,
    unit: definition.unit,
    polarity: definition.polarity,
    formula: definition.formula,
    owner: definition.owner,
    status: definition.status,
    ...(definition.note === undefined ? {} : { note: definition.note }),
    value,
    scope: ctx.scope,
    lens: ctx.lens,
    scenario: ctx.scenario,
    versionId: ctx.versionId,
    entityIds: ctx.entityIds,
    consolidated: !isSliced(ctx),
    ...(ctx.segmentId === undefined ? {} : { segmentId: ctx.segmentId }),
    ...(ctx.costCentreId === undefined ? {} : { costCentreId: ctx.costCentreId }),
    inputs,
  };
}

/**
 * The same measure per entity — the first level of the drill, and the entity column of the grid.
 *
 * Computed by recomputing per entity rather than by reading `MeasureInput.byEntity`, and the
 * difference is not pedantry: a ratio's entity breakdown is the ratio computed for that entity, not
 * its numerator's share. Splitting a group gross margin by its revenue contribution gives every
 * entity the group's margin, which is confidently wrong.
 */
export function computeByEntity(id: string, ctx: MeasureContext): Map<string, MeasureValue> {
  const out = new Map<string, MeasureValue>();
  for (const entityId of ctx.entityIds) {
    out.set(entityId, computeMeasure(id, { ...ctx, entityIds: [entityId] }));
  }
  return out;
}

/** The measure in each month of a window — every trend line, and the trend comparator's input. */
export function measureSeries(
  id: string,
  ctx: MeasureContext,
  from: FiscalMonth,
  to: FiscalMonth,
): { month: FiscalMonth; value: number | null }[] {
  return monthsBetween(from, to).map((month) => ({
    month,
    value: computeMeasure(id, { ...ctx, scope: monthScope(month) }).value,
  }));
}

/**
 * Every entity a context could contain, for the default view.
 *
 * Exported so a caller does not have to import the model to build a context, and so there is one
 * place to change if the group grows an entity.
 */
export function allEntityIds(): string[] {
  return tradingEntities().map((e) => e.id);
}

/** The account's own label, for an input the definition did not name. */
function accountLabel(accountId: AccountCode): string {
  return ACCOUNT_LABELS[accountId] ?? accountId;
}

/**
 * Labels for the accounts measures read.
 *
 * A local map rather than a call into the model's taxonomy: the label a drill-down shows is a
 * presentation decision, and a few of them differ from the ledger's own wording — "Revenue" on a
 * statement is `revenue` plus whatever intercompany did not eliminate, and calling that row
 * "Revenue" in a drill-down would be the one place the distinction disappears.
 */
const ACCOUNT_LABELS: Partial<Record<AccountCode, string>> = {
  revenue: 'External revenue',
  revenue_ic: 'Intercompany revenue (unmatched)',
  cost_of_sales: 'Direct cost of sales',
  cost_of_sales_ic: 'Intercompany purchases (unmatched)',
  subcontract_cost: 'Subcontract labour',
  subcontract_hours: 'Subcontract hours',
  staff_cost: 'Staff cost',
  other_opex: 'Other operating expense',
  unmapped_opex: 'Unmapped operating expense',
  depreciation: 'Depreciation & amortisation',
  interest_expense: 'Interest expense',
  tax_expense: 'Tax expense',
  cash: 'Cash & equivalents',
  receivables: 'Trade receivables',
  payables: 'Trade payables',
  inventory: 'Inventory',
  borrowings: 'Borrowings',
  avg_receivables: 'Average receivables',
  avg_payables: 'Average payables',
  avg_inventory: 'Average inventory',
  avg_capital_employed: 'Average capital employed',
  headcount: 'Headcount (FTE)',
  chargeable_hours: 'Chargeable hours',
  available_hours: 'Available hours',
  pipeline_weighted: 'Weighted pipeline',
};
