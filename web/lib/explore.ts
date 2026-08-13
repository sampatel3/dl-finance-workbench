/**
 * The Explore surface's URL contract and its export.
 *
 * Kept out of the page so the browser view and the CSV endpoint cannot resolve the same address in two
 * different ways. The pivot engine still owns the arithmetic; this file only turns URL state into a
 * valid request, computes the selected comparator beside each cell, and serialises those same cells.
 */

import type { Dimension, Pivot } from '@kestrel/analysis';
import { DIMENSIONS, buildPivot } from '@kestrel/analysis';
import type { AccountCode, FiscalMonth } from '@kestrel/model';
import { entity } from '@kestrel/model';
import type { MeasureValue, MeasureWithComparison } from '@kestrel/measures';
import { compareMeasure, computeMeasure, formatValue } from '@kestrel/measures';

import type { Params, View } from './world';
import { ALL_MONTHS, contextOf, viewOf } from './world';

export const EXPLORE_MEASURES = [
  'revenue',
  'gross_profit',
  'gross_margin',
  'ebitda',
  'cash',
  'dso',
] as const;

export interface ExploreAxes {
  readonly rows: readonly Dimension[];
  readonly columns: readonly Dimension[];
  /** True when a hand-edited URL repeated a dimension and was made unambiguous. */
  readonly normalised: boolean;
}

export interface ExploreState extends ExploreAxes {
  readonly view: View;
  readonly grain: 'month' | 'quarter';
  readonly months: readonly FiscalMonth[];
  readonly pivot: Pivot;
  readonly comparisons: readonly (readonly MeasureWithComparison[])[];
}

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

function distinct(dimensions: readonly Dimension[]): Dimension[] {
  return dimensions.filter((dimension, index) => dimensions.indexOf(dimension) === index);
}

/** Parse one axis, dropping unknown and repeated dimensions before applying its default. */
export function parseExploreAxis(
  raw: string | string[] | undefined,
  fallback: readonly Dimension[],
): Dimension[] {
  const value = first(raw);
  if (value === undefined) return [...fallback];
  const parsed = distinct(
    value
      .split(',')
      .map((part) => part.trim())
      .filter((part): part is Dimension => DIMENSIONS.includes(part as Dimension)),
  );
  return parsed.length === 0 ? [...fallback] : parsed;
}

/**
 * A dimension belongs to one axis once.
 *
 * Rows win when a hand-edited URL puts the same dimension on both axes. The column then falls back to
 * the first dimension not already used, which keeps the page useful and lets the engine retain its
 * stricter invariant: ambiguous programmatic requests throw.
 */
export function normaliseExploreAxes(params: Params): ExploreAxes {
  const writtenRows = first(params.rows)
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(',');
  const writtenColumns = first(params.cols)
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(',');
  const requestedRows = parseExploreAxis(params.rows, ['measure']);
  const requestedColumns = parseExploreAxis(params.cols, ['period']);
  const rows = distinct(requestedRows);
  let columns = distinct(requestedColumns).filter((dimension) => !rows.includes(dimension));

  if (columns.length === 0) {
    const replacement = (['period', 'measure', 'entity', 'segment', 'cost_centre'] as const).find(
      (dimension) => !rows.includes(dimension),
    );
    columns = replacement === undefined ? [] : [replacement];
  }

  return {
    rows,
    columns,
    normalised:
      (writtenRows !== undefined && writtenRows !== requestedRows.join(',')) ||
      (writtenColumns !== undefined && writtenColumns !== requestedColumns.join(',')) ||
      rows.join(',') !== requestedRows.join(',') ||
      columns.join(',') !== requestedColumns.join(','),
  };
}

/** The latest `count` model months ending at the selected through-month, never after it. */
export function exploreMonthsThrough(
  months: readonly FiscalMonth[],
  through: FiscalMonth,
  count = 6,
): FiscalMonth[] {
  const end = months.indexOf(through);
  if (end === -1) return [...months].slice(-count);
  return [...months].slice(Math.max(0, end - count + 1), end + 1);
}

/** Resolve one URL into the exact grid shared by the page and the export route. */
export function exploreState(params: Params): ExploreState {
  const view = viewOf(params);
  const axes = normaliseExploreAxes(params);
  const grain = first(params.grain) === 'quarter' ? 'quarter' : 'month';
  const months = exploreMonthsThrough(ALL_MONTHS, view.through);
  const pivot = buildPivot({
    ctx: contextOf(view),
    rows: axes.rows,
    columns: axes.columns,
    measureIds: [...EXPLORE_MEASURES],
    months,
    periodGrain: grain,
  });
  const comparisons = pivot.rows.map((row) =>
    row.cells.map((cell) => compareMeasure(cell.measureId, cell.ctx, view.comparator)),
  );
  return { ...axes, view, grain, months, pivot, comparisons };
}

function paramsIntoSearch(params: Params): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'drill') continue;
    const single = first(value);
    if (single !== undefined) next.set(key, single);
  }
  return next;
}

function fillAxis(
  axis: readonly Dimension[],
  occupied: readonly Dimension[],
  preferred: readonly Dimension[],
): Dimension[] {
  if (axis.length > 0) return [...axis];
  const replacement = preferred.find((dimension) => !occupied.includes(dimension));
  return replacement === undefined ? [] : [replacement];
}

/**
 * Build an Explore link, moving a repeated dimension to the axis the reader just chose.
 *
 * This makes generated links canonical even though a hand-edited duplicate is merely normalised on
 * read. It also drops an open drill whenever the axes or grain move, because the old cell coordinates no
 * longer identify the same figure.
 */
export function exploreHref(params: Params, key: 'rows' | 'cols' | 'grain', value: string): string {
  const next = paramsIntoSearch(params);
  next.delete('drill');

  if (key === 'grain') {
    const axes = normaliseExploreAxes(params);
    next.set('rows', axes.rows.join(','));
    next.set('cols', axes.columns.join(','));
    next.set('grain', value);
    const query = next.toString();
    return query === '' ? '/app/explore' : `/app/explore?${query}`;
  }

  const current = normaliseExploreAxes(params);
  const selected = parseExploreAxis(value, []);
  let rows = key === 'rows' ? selected : current.rows.filter((d) => !selected.includes(d));
  let columns =
    key === 'cols' ? selected : current.columns.filter((d) => !selected.includes(d));
  rows = fillAxis(rows, columns, ['measure', 'entity', 'segment', 'cost_centre', 'period']);
  columns = fillAxis(columns, rows, ['period', 'measure', 'entity', 'segment', 'cost_centre']);

  next.set('rows', rows.join(','));
  next.set('cols', columns.join(','));
  const query = next.toString();
  return `/app/explore?${query}`;
}

/** Link to a CSV computed from the same address, without an open-cell coordinate. */
export function exploreExportHref(params: Params): string {
  const next = paramsIntoSearch(params);
  const axes = normaliseExploreAxes(params);
  next.set('rows', axes.rows.join(','));
  next.set('cols', axes.columns.join(','));
  return `/api/v1/explore?${next.toString()}`;
}

/** Open one cell without changing any other part of the view. */
export function exploreDrillHref(params: Params, row: number, column: number): string {
  const next = paramsIntoSearch(params);
  next.set('drill', `${row}:${column}`);
  return `/app/explore?${next.toString()}`;
}

export interface CellProvenance {
  readonly computed: MeasureValue;
  readonly vintageIds: readonly string[];
  readonly inputs: ReadonlyMap<
    string,
    {
      readonly monthsUsed: readonly FiscalMonth[];
      readonly rowCount: number;
      readonly vintageIds: readonly string[];
    }
  >;
}

const SEGMENTED_ACCOUNTS: ReadonlySet<AccountCode> = new Set(['revenue', 'cost_of_sales']);

/** The definition and immutable load ids behind one cell. */
export function cellProvenance(measureId: string, ctx: Parameters<typeof computeMeasure>[1]): CellProvenance {
  const computed = computeMeasure(measureId, ctx);
  const allVintages = new Set<string>();
  const inputs = new Map<
    string,
    { monthsUsed: readonly FiscalMonth[]; rowCount: number; vintageIds: readonly string[] }
  >();

  /* Consolidation records the account values but deliberately does not retain source rows. Re-query the
     same immutable store keys solely for provenance; no value is recomputed from these rows. This is the
     same distinction as the drill: the measure remains the authority for the figure, the rows answer
     where it came from. */
  for (const input of computed.inputs) {
    const months = new Set<FiscalMonth>();
    const vintages = new Set<string>();
    let rowCount = 0;
    for (const entityId of ctx.entityIds) {
      const result = ctx.store.query({
        entityId,
        accountId: input.accountId,
        scope: ctx.scope,
        scenario: ctx.scenario,
        versionId: ctx.versionId,
        ...(ctx.segmentId === undefined && ctx.costCentreId === undefined
          ? {
              costCentreId: null,
              ...(SEGMENTED_ACCOUNTS.has(input.accountId) ? {} : { segmentId: null }),
            }
          : {
              ...(ctx.segmentId === undefined ? {} : { segmentId: ctx.segmentId }),
              costCentreId: ctx.costCentreId ?? null,
            }),
        ...(ctx.asOfVintage === undefined ? {} : { asOfVintage: ctx.asOfVintage }),
      });
      for (const month of result.monthsUsed) months.add(month);
      for (const vintage of result.vintageIds) {
        vintages.add(vintage);
        allVintages.add(vintage);
      }
      rowCount += result.rows.length;
    }
    inputs.set(input.accountId, {
      monthsUsed: [...months].sort(),
      rowCount,
      vintageIds: [...vintages].sort(),
    });
  }

  return { computed, vintageIds: [...allVintages].sort(), inputs };
}

function csv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(values: readonly (string | number | null | undefined)[]): string {
  return values.map(csv).join(',');
}

/**
 * A long-form spreadsheet export: one row per measured cell, with its comparison and vintages.
 *
 * Currency stays in minor units so the numeric column is lossless; the adjacent formatted column is
 * exactly what the product showed. The scale is stated in the header rather than left for a spreadsheet
 * reader to infer.
 */
export function exploreCsv(state: ExploreState): string {
  const details = state.pivot.rows.map((row, rowIndex) =>
    row.cells.map((cell, columnIndex) => {
      const provenance = cellProvenance(cell.measureId, cell.ctx);
      return {
        row: row.path.map((member) => member.label).join(' / '),
        column: state.pivot.columnPaths[columnIndex]?.map((member) => member.label).join(' / ') || 'Value',
        cell,
        comparison: state.comparisons[rowIndex]?.[columnIndex],
        provenance,
      };
    }),
  );
  const allVintages = [
    ...new Set(details.flat(2).flatMap((detail) => detail.provenance.vintageIds)),
  ].sort();
  const firstComparison = state.comparisons[0]?.[0];

  const lines = [
    csvRow(['Deeplight Finance Workbench', 'Explore export']),
    csvRow(['Grid window', `${state.months[0] ?? state.view.through} to ${state.months.at(-1) ?? state.view.through}`]),
    csvRow(['Entity', entity(state.view.entityId).name]),
    csvRow(['Actual version', 'actual']),
    csvRow(['Selected forecast version', state.view.version.id]),
    csvRow(['Comparator', firstComparison?.comparator.basis ?? state.view.comparator.id]),
    csvRow(['Currency lens', state.view.lens]),
    csvRow(['Rows', state.rows.join(' / ')]),
    csvRow(['Columns', state.columns.join(' / ')]),
    csvRow(['Vintages', allVintages.join(' | ')]),
    csvRow(['Monetary scale', 'minor units; formatted values are shown beside raw values']),
    '',
    csvRow([
      'Row',
      'Column',
      'Measure',
      'Actual raw',
      'Actual shown',
      'Comparative raw',
      'Comparative shown',
      'Movement raw',
      'Movement shown',
      'Value unit',
      'Movement unit',
      'Formula',
      'Owner',
      'Definition state',
      'Vintages',
    ]),
  ];

  for (const row of details) {
    for (const detail of row) {
      const comparison = detail.comparison;
      lines.push(
        csvRow([
          detail.row,
          detail.column,
          detail.cell.measureId,
          detail.cell.value,
          formatValue(detail.cell.value, detail.cell.unit),
          comparison?.comparativeValue,
          formatValue(comparison?.comparativeValue ?? null, detail.cell.unit),
          comparison?.movement,
          formatValue(comparison?.movement ?? null, comparison?.movementUnit ?? detail.cell.unit),
          detail.cell.unit,
          comparison?.movementUnit,
          detail.provenance.computed.formula,
          detail.provenance.computed.owner,
          detail.provenance.computed.status,
          detail.provenance.vintageIds.join(' | '),
        ]),
      );
    }
  }

  return `${lines.join('\r\n')}\r\n`;
}
