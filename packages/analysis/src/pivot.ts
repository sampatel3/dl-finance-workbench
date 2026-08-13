/**
 * The pivot, and the drill that terminates in rows.
 *
 * `FW-EXPLORE-001` asks for measures down and periods across with any dimension on either axis. The
 * interesting part is not the grid — it is the promise that **a cell agrees with the same measure
 * computed directly.** A pivot that disagrees with the front page is worse than no pivot: it makes a
 * reader distrust both, and they cannot tell which one is wrong.
 *
 * So every cell here is a `computeMeasure` call with a context, and nothing in this file adds, divides
 * or apportions. That sounds wasteful and is the whole design:
 *
 *   **A ratio cannot be summed.** Gross margin for three entities is not the sum of three margins, and
 *   it is not their mean either — it is the group's gross profit over the group's revenue. A grid that
 *   totals a column of percentages produces a number with no meaning, and it looks exactly like a
 *   number with one.
 *
 *   **A balance cannot be summed across periods.** Cash for a quarter is the closing month, not three
 *   months added up. The measure layer knows this from the account's basis; a grid that adds its own
 *   cells does not.
 *
 * So a total is *recomputed at the total's own scope*, never rolled up from the cells above it. The
 * test that matters asserts a row total equals `computeMeasure` over the union scope — and it would
 * fail on any implementation that summed, for both of the reasons above.
 *
 * ## The drill
 *
 * A cell knows the context that produced it, so drilling is re-running the same query one level finer
 * rather than filtering a result set. `drillCell` walks the aggregation path — group to entity, entity
 * to segment, segment to cost centre — and terminates in the store's own rows, each with the vintage it
 * arrived in. The rows sum to the cell because they *are* the cell: the store returns them from the
 * same query that produced the value.
 */

import type {
  AccountCode,
  CostCentreCode,
  Fact,
  FiscalMonth,
  PeriodScope,
  SegmentCode,
} from '@kestrel/model';
import {
  CALENDAR_YEAR,
  COST_CENTRES,
  SEGMENTS,
  entity,
  fiscalQuarterOf,
  fiscalYearOf,
  monthScope,
  monthsBetween,
  quarterScope,
  segment as segmentSpec,
  subtree,
  tradingEntities,
} from '@kestrel/model';
import type { MeasureContext, Unit } from '@kestrel/measures';
import { computeMeasure, contextAtScope, measure } from '@kestrel/measures';

// ---------------------------------------------------------------------------
// The dimensions a pivot can hold
// ---------------------------------------------------------------------------

/**
 * What can go on an axis.
 *
 * A closed set, and short. Every one of these is a dimension the fact grain actually holds, so a
 * pivot cannot be built over something the store cannot answer — the alternative is a grid that
 * offers a dimension and returns dashes for it, which reads as broken data rather than as an
 * unsupported combination.
 */
export const DIMENSIONS = ['measure', 'period', 'entity', 'segment', 'cost_centre'] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Readonly<Record<Dimension, string>> = {
  measure: 'Measure',
  period: 'Period',
  entity: 'Entity',
  segment: 'Segment',
  cost_centre: 'Cost centre',
};

/** One position on an axis: what it is called, and how it narrows a context. */
export interface Member {
  readonly dimension: Dimension;
  readonly key: string;
  readonly label: string;
  /** Applied to the base context to produce this member's slice. */
  readonly narrow: (ctx: MeasureContext) => MeasureContext;
  /** For the measure dimension only: which measure this member selects. */
  readonly measureId?: string;
}

export interface PivotRequest {
  readonly ctx: MeasureContext;
  /** Dimensions stacked down the side, outermost first. */
  readonly rows: readonly Dimension[];
  /** Dimensions stacked across the top, outermost first. */
  readonly columns: readonly Dimension[];
  /** Which measures the `measure` dimension offers. */
  readonly measureIds: readonly string[];
  /** Which months the `period` dimension offers, newest last. */
  readonly months: readonly FiscalMonth[];
  /** Group months into quarters rather than listing them. */
  readonly periodGrain?: 'month' | 'quarter';
}

function measureMembers(ids: readonly string[]): Member[] {
  return ids.map((id) => ({
    dimension: 'measure' as const,
    key: id,
    label: measure(id).label,
    measureId: id,
    narrow: (ctx) => ctx,
  }));
}

function periodMembers(months: readonly FiscalMonth[], grain: 'month' | 'quarter'): Member[] {
  if (grain === 'month') {
    return months.map((month) => ({
      dimension: 'period' as const,
      key: month,
      label: month,
      narrow: (ctx) => contextAtScope(ctx, monthScope(month)),
    }));
  }
  /* Distinct quarters covered by the months given, in order. The supplied month window is an upper
     bound: a through-May view must never reach into June simply because May belongs to Q2. Incomplete
     quarters are labelled with their exact covered range so a partial period cannot masquerade as a
     completed quarter. */
  const seen = new Map<string, { readonly full: PeriodScope; readonly months: FiscalMonth[] }>();
  for (const month of months) {
    const fy = fiscalYearOf(month, CALENDAR_YEAR);
    const q = fiscalQuarterOf(month, CALENDAR_YEAR);
    const key = `${fy}-Q${q}`;
    const existing = seen.get(key);
    if (existing === undefined) {
      seen.set(key, { full: quarterScope(fy, q, CALENDAR_YEAR), months: [month] });
    } else {
      existing.months.push(month);
    }
  }
  return [...seen.entries()].map(([key, covered]) => {
    const startMonth = covered.months[0] as FiscalMonth;
    const endMonth = covered.months[covered.months.length - 1] as FiscalMonth;
    const complete =
      startMonth === covered.full.startMonth && endMonth === covered.full.endMonth;
    const scope: PeriodScope = complete
      ? covered.full
      : {
          type: covered.months.length === 1 ? 'MONTH' : 'YTD',
          startMonth,
          endMonth,
          label: `${key} · ${startMonth}–${endMonth}`,
        };
    return {
      dimension: 'period' as const,
      key,
      label: complete ? key : scope.label,
      narrow: (ctx: MeasureContext) => contextAtScope(ctx, scope),
    };
  });
}

function entityMembers(ctx: MeasureContext): Member[] {
  /* Only the entities the context can already see. A pivot that offers every entity to a controller
     scoped to one of them is a pivot that leaks the group by listing its parts. */
  const visible = new Set(ctx.entityIds);
  return tradingEntities()
    .filter((e) => visible.has(e.id))
    .map((e) => ({
      dimension: 'entity' as const,
      key: e.id,
      label: e.name,
      narrow: (inner) => ({ ...inner, entityIds: subtree(e.id) }),
    }));
}

function segmentMembers(ctx: MeasureContext): Member[] {
  return SEGMENTS.filter((spec) => ctx.segmentId === undefined || spec.code === ctx.segmentId).map((spec) => ({
    dimension: 'segment' as const,
    key: spec.code,
    label: spec.label,
    narrow: (ctx) => ({ ...ctx, segmentId: spec.code }),
  }));
}

function costCentreMembers(ctx: MeasureContext): Member[] {
  return COST_CENTRES.filter(
    (spec) => ctx.costCentreId === undefined || spec.code === ctx.costCentreId,
  ).map((spec) => ({
    dimension: 'cost_centre' as const,
    key: spec.code,
    label: spec.label,
    narrow: (ctx) => ({ ...ctx, costCentreId: spec.code }),
  }));
}

function membersFor(dimension: Dimension, request: PivotRequest): Member[] {
  switch (dimension) {
    case 'measure':
      return measureMembers(request.measureIds);
    case 'period':
      return periodMembers(request.months, request.periodGrain ?? 'month');
    case 'entity':
      return entityMembers(request.ctx);
    case 'segment':
      return segmentMembers(request.ctx);
    case 'cost_centre':
      return costCentreMembers(request.ctx);
  }
}

/** The cartesian product of several dimensions' members, outermost first. */
function cross(dimensions: readonly Dimension[], request: PivotRequest): Member[][] {
  return dimensions.reduce<Member[][]>(
    (paths, dimension) =>
      paths.flatMap((path) => membersFor(dimension, request).map((member) => [...path, member])),
    [[]],
  );
}

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

export interface Cell {
  readonly value: number | null;
  readonly unit: Unit;
  readonly measureId: string;
  /** The context that produced it, so a drill re-runs rather than filters. */
  readonly ctx: MeasureContext;
  /** True where the figure went through elimination. A sliced figure is combined, not consolidated. */
  readonly consolidated: boolean;
}

export interface PivotRow {
  readonly path: readonly Member[];
  readonly cells: readonly Cell[];
  /**
   * The row's own total, recomputed at the union of the column scopes — never the sum of the cells.
   * Absent where the row's measure is a ratio or a balance and a total would be a category error.
   */
  readonly total: Cell | null;
}

export interface Pivot {
  readonly rowPaths: readonly (readonly Member[])[];
  readonly columnPaths: readonly (readonly Member[])[];
  readonly rows: readonly PivotRow[];
  /** Why a total is absent, where it is. Shown, so a blank cell is never a mystery. */
  readonly totalNote: string;
}

/**
 * Refuse an ambiguous axis before a cell is computed.
 *
 * Narrowing a context is not commutative for every dimension: an entity member replaces the entity
 * slice, for example. Letting `entity` appear on both axes would therefore render several labelled rows
 * whose cells were all overwritten by the column member. The figures would be valid measurements and
 * attached to the wrong labels — a more dangerous failure than throwing. The web surface normalises a
 * hand-edited URL; this guard protects every other caller of the engine.
 */
function assertDistinctAxes(rows: readonly Dimension[], columns: readonly Dimension[]): void {
  const seen = new Set<Dimension>();
  const repeated = [...rows, ...columns].filter((dimension) => {
    if (seen.has(dimension)) return true;
    seen.add(dimension);
    return false;
  });
  if (repeated.length > 0) {
    throw new Error(
      `A pivot dimension may appear once, on one axis: ${[...new Set(repeated)].join(', ')}`,
    );
  }
}

/** Which measure a path selects, or the request's first, when `measure` is not on an axis. */
function measureFor(
  paths: readonly Member[][],
  fallback: string,
): (path: readonly Member[]) => string {
  void paths;
  return (path) => path.find((m) => m.measureId !== undefined)?.measureId ?? fallback;
}

/**
 * Is a row total meaningful?
 *
 * A flow can be totalled across periods; a balance and a ratio cannot. Rather than inspect the
 * account basis here — which would put the model's rule in two places — the question is asked of the
 * catalogue: a measure whose unit is a percentage or a ratio is never additive, and one composed of
 * balances is recomputed at the wider scope rather than added. So the total is always *recomputed*,
 * and this only decides whether to show it at all.
 */
function totalIsMeaningful(measureId: string): boolean {
  const unit = measure(measureId).unit;
  return unit !== 'percent' && unit !== 'ratio' && unit !== 'bps';
}

export function buildPivot(request: PivotRequest): Pivot {
  assertDistinctAxes(request.rows, request.columns);
  const rowPaths = cross(request.rows, request);
  const columnPaths = cross(request.columns, request);
  const fallbackMeasure = request.measureIds[0] ?? 'revenue';
  const pick = measureFor(rowPaths, fallbackMeasure);

  /* The union of every column scope, for the row total. Built from the months each column covers so a
     quarter grain and a month grain produce the same union. */
  const columnMonths = new Set<FiscalMonth>();
  for (const path of columnPaths) {
    const scope = path.reduce<MeasureContext>((c, m) => m.narrow(c), request.ctx).scope;
    for (const month of monthsBetween(scope.startMonth, scope.endMonth)) columnMonths.add(month);
  }
  const ordered = [...columnMonths].sort();
  const unionScope: PeriodScope =
    ordered.length === 0
      ? request.ctx.scope
      : {
          type: ordered.length === 1 ? 'MONTH' : 'YTD',
          startMonth: ordered[0] as FiscalMonth,
          endMonth: ordered[ordered.length - 1] as FiscalMonth,
          label: `${ordered[0]} – ${ordered[ordered.length - 1]}`,
        };

  const rows = rowPaths.map((rowPath): PivotRow => {
    const measureId = pick(rowPath);
    const rowCtx = rowPath.reduce<MeasureContext>((c, m) => m.narrow(c), request.ctx);

    const cells = columnPaths.map((columnPath): Cell => {
      const ctx = columnPath.reduce<MeasureContext>((c, m) => m.narrow(c), rowCtx);
      const id = columnPath.find((m) => m.measureId !== undefined)?.measureId ?? measureId;
      const value = computeMeasure(id, ctx);
      return {
        value: value.value,
        unit: value.unit,
        measureId: id,
        ctx,
        consolidated: value.consolidated,
      };
    });

    /* Recomputed, never summed. See the header. When period is down the rows, `rowCtx` already owns
       the reporting window. Replacing it with the column union would make every row total repeat the
       page's base period even though the cells on that row correctly use the row period. */
    const total = !request.columns.includes('measure') && totalIsMeaningful(measureId)
      ? (() => {
          const totalScope = request.columns.includes('period') ? unionScope : rowCtx.scope;
          const ctx = contextAtScope(rowCtx, totalScope);
          const value = computeMeasure(measureId, ctx);
          return {
            value: value.value,
            unit: value.unit,
            measureId,
            ctx,
            consolidated: value.consolidated,
          };
        })()
      : null;

    return { path: rowPath, cells, total };
  });

  return {
    rowPaths,
    columnPaths,
    rows,
    totalNote:
      'Totals are recomputed over the whole window, never added across the cells — a balance is its ' +
      'closing month and a ratio is not the sum of ratios. A row whose measure is a percentage, or ' +
      'whose columns contain different measures, has no total for that reason.',
  };
}

// ---------------------------------------------------------------------------
// The drill
// ---------------------------------------------------------------------------

/** One step down the aggregation path. */
export interface DrillStep {
  readonly dimension: Dimension | 'account';
  readonly key: string;
  readonly label: string;
  readonly value: number | null;
  readonly unit: Unit;
  /** Where this step leads, if it is not the last. */
  readonly ctx?: MeasureContext;
}

export interface Drill {
  readonly cell: Cell;
  /** The path from the cell down to whatever level it can reach. */
  readonly steps: readonly DrillStep[];
  /** The store's own rows, where the path terminates. */
  readonly rows: readonly Fact[];
  /** Every vintage that contributed. A figure that cannot name its provenance is not auditable. */
  readonly vintageIds: readonly string[];
  /** True where the steps sum to the cell. Asserted, and shown. */
  readonly sums: boolean;
  /** What the next level would be, or why there is not one. */
  readonly note: string;
}

/**
 * Drill one cell.
 *
 * The order is the aggregation path: a group figure breaks into entities, an entity into segments, a
 * segment into cost centres, and a cost centre into rows. Each level is *recomputed* at that level
 * rather than divided out of the level above, so the steps summing to the cell is a property of the
 * data and not of this function — and where they do not sum, `sums` says so rather than the surface
 * quietly showing a set of parts that is not the whole.
 */
export function drillCell(cell: Cell): Drill {
  const ctx = cell.ctx;
  const visible = ctx.entityIds;

  /* Which level this cell is already at decides which level is next. */
  const atGroup = visible.length > 1;
  const atSegment = ctx.segmentId !== undefined;
  const atCostCentre = ctx.costCentreId !== undefined;

  let steps: DrillStep[] = [];
  let note = '';

  if (atGroup) {
    steps = visible.map((entityId) => {
      const inner = { ...ctx, entityIds: subtree(entityId) };
      const value = computeMeasure(cell.measureId, inner);
      return {
        dimension: 'entity' as const,
        key: entityId,
        label: entity(entityId).name,
        value: value.value,
        unit: value.unit,
        ctx: inner,
      };
    });
    /* A group figure is NOT the sum of its entities, and pretending otherwise is the defect this step
       exists to prevent. Consolidation eliminates intercompany trade, so the parts are the *combined*
       figure and the cell is the *consolidated* one — on this data they differ by £855k of internal
       sales. A drill that showed five entities under a group total and left the reader to notice they
       do not add up has shown them a broken reconciliation and called it a breakdown.

       So the difference is named as a step, exactly as a consolidation schedule names it, and the parts
       then tie to the cell. Computed as the residual rather than re-derived, because the residual is
       what has to be explained: any other elimination the consolidation performs lands here too and is
       visible rather than absorbed. */
    const combined = steps.reduce((total, step) => total + (step.value ?? 0), 0);
    const eliminated = cell.value === null ? 0 : cell.value - combined;
    if (eliminated !== 0) {
      steps.push({
        dimension: 'account',
        key: 'eliminations',
        label: 'Intercompany eliminated',
        value: eliminated,
        unit: cell.unit,
      });
    }
    note =
      'A group figure breaks into its entities, each computed at its own level — so these are ' +
      'measurements rather than a share of the figure above. They are the *combined* total, so the ' +
      'intercompany elimination is named as its own line and the parts tie to the consolidated cell.';
  } else if (!atSegment) {
    steps = SEGMENTS.map((spec) => {
      const inner = { ...ctx, segmentId: spec.code };
      const value = computeMeasure(cell.measureId, inner);
      return {
        dimension: 'segment' as const,
        key: spec.code,
        label: spec.label,
        value: value.value,
        unit: value.unit,
        ctx: inner,
      };
    }).filter((step) => step.value !== null);
    note =
      'An entity figure breaks into its segments. Intercompany trade has no segment, so these are ' +
      'combined rather than consolidated and may not reach the entity total.';
  } else if (!atCostCentre) {
    steps = COST_CENTRES.map((spec) => {
      const inner = { ...ctx, costCentreId: spec.code };
      const value = computeMeasure(cell.measureId, inner);
      return {
        dimension: 'cost_centre' as const,
        key: spec.code,
        label: spec.label,
        value: value.value,
        unit: value.unit,
        ctx: inner,
      };
    }).filter((step) => step.value !== null);
    note = 'A segment figure breaks into cost centres where the account carries one.';
  } else {
    note = 'This is the finest level the grain holds. Below it are the rows themselves.';
  }

  /* The rows behind the figure, from the same grain selection that produced it. At the aggregate
     level most accounts live on a null/null row, while revenue and cost of sales deliberately live
     only on segment rows. Omitting both keys for every account would select aggregate *and* child rows
     and silently double-count the evidence. A sliced measure follows readAccount's rule: constrain
     the requested segment, and use the aggregate cost-centre row until a cost centre is selected. */
  const computed = computeMeasure(cell.measureId, ctx);
  const segmentedAccounts: ReadonlySet<AccountCode> = new Set(['revenue', 'cost_of_sales']);
  const rows: Fact[] = [];
  const vintages = new Set<string>();
  for (const input of computed.inputs) {
    for (const entityId of ctx.entityIds) {
      const result = ctx.store.query({
        entityId,
        accountId: input.accountId as AccountCode,
        scope: ctx.scope,
        scenario: ctx.scenario,
        versionId: ctx.versionId,
        ...(ctx.segmentId === undefined && ctx.costCentreId === undefined
          ? {
              costCentreId: null,
              ...(segmentedAccounts.has(input.accountId as AccountCode)
                ? {}
                : { segmentId: null }),
            }
          : {
              ...(ctx.segmentId === undefined
                ? {}
                : { segmentId: ctx.segmentId as SegmentCode }),
              costCentreId: (ctx.costCentreId ?? null) as CostCentreCode | null,
            }),
        ...(ctx.asOfVintage === undefined ? {} : { asOfVintage: ctx.asOfVintage }),
      });
      rows.push(...result.rows);
      for (const id of result.vintageIds) vintages.add(id);
    }
  }

  /* Whether the parts add up. A percentage never does — the parts are ratios — so it is only asserted
     where the unit is additive, and reported either way. */
  const additive = cell.unit === 'currency' || cell.unit === 'count' || cell.unit === 'hours';
  const summed = steps.reduce((total, step) => total + (step.value ?? 0), 0);
  const sums =
    !additive || steps.length === 0
      ? true
      : cell.value === null
        ? false
        : Math.abs(summed - cell.value) <= Math.max(1, Math.abs(cell.value) * 1e-9);

  return { cell, steps, rows, vintageIds: [...vintages], sums, note };
}

/** A segment's label, for a surface rendering a drill step. */
export function memberLabel(step: DrillStep): string {
  if (step.dimension === 'segment') return segmentSpec(step.key as SegmentCode).label;
  return step.label;
}
