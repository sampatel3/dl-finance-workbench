/**
 * Revenue, margin, EBITDA and PAT on one chart — and the question that chart exists to answer.
 *
 * The review put it precisely: *"if Revenue increases but EBITDA or PAT falls, the workbench should
 * expose why and when the dip occurred… CFO question to answer: is growth converting into profit?"*
 *
 * ## Why the lines are indexed
 *
 * Revenue is £12.4m, gross margin is 41.8%. They cannot share an axis, and the usual answer — a second
 * axis on the right — is the single most misleading chart in finance: the two scales are chosen
 * independently, so any two series can be made to look correlated or divergent by moving one of them.
 *
 * So every series is rebased to 100 at the start of the window. The axis then means one thing —
 * *growth since the opening month* — and divergence between the lines is real rather than an artefact of
 * scaling. It is the standard analyst answer to this exact question, and it is the only one that lets
 * "revenue up, PAT down" be read off the shape.
 *
 * The cost is that the chart no longer shows what anything *is*. That is why `TrendSeries` carries the
 * actual values too, and the surface prints them in a table underneath: the chart answers "did they move
 * together", the table answers "to what".
 *
 * ## Why divergence is computed rather than left to the eye
 *
 * A reader scanning four lines will see divergence where the gap is widest, which is not the same as
 * where it opened. `divergenceOf` finds the month the top and bottom lines began to separate and states
 * it, so the answer to "when did the dip occur" is a month rather than a squint.
 */

import type { FiscalMonth } from '@kestrel/model';
import { monthScope } from '@kestrel/model';
import type { MeasureContext, Unit } from '@kestrel/measures';
import { computeMeasure, measure } from '@kestrel/measures';

import { monthLabel } from './world';

/** The measures the trend offers, in the order the review lists them. */
export const TREND_MEASURES = [
  { id: 'revenue', short: 'Revenue' },
  { id: 'gross_margin', short: 'Gross margin' },
  { id: 'ebitda', short: 'EBITDA' },
  { id: 'net_income', short: 'PAT' },
] as const;

export type TrendMeasureId = (typeof TREND_MEASURES)[number]['id'];

/** Which are drawn by default: the two that answer the conversion question on their own. */
export const DEFAULT_TREND: readonly TrendMeasureId[] = ['revenue', 'ebitda'];

export interface TrendPoint {
  readonly month: FiscalMonth;
  /** The measure itself, in its own unit. */
  readonly value: number | null;
  /** Rebased to 100 at the first month with a value. Null where the value is. */
  readonly indexed: number | null;
}

export interface TrendSeries {
  readonly measureId: string;
  readonly label: string;
  readonly short: string;
  readonly unit: Unit;
  readonly points: readonly TrendPoint[];
  /** Growth over the whole window, as a rate. Null where either end is missing. */
  readonly growth: number | null;
}

/**
 * Read one measure across the window.
 *
 * Through the measure layer once per month rather than out of the store, so a point on this chart and
 * the headline above it are the same computation — two paths to one figure is two figures.
 */
function seriesFor(
  measureId: string,
  short: string,
  ctx: MeasureContext,
  months: readonly FiscalMonth[],
): TrendSeries {
  const definition = measure(measureId);
  const raw = months.map((month) => ({
    month,
    value: computeMeasure(measureId, { ...ctx, scope: monthScope(month) }).value,
  }));

  /* The base is the first month that has a value, not the first month of the window. A series starting
     with a gap would otherwise index against null and vanish — and a series indexed against a near-zero
     base produces a line that leaves the chart, which is why a zero base yields no index at all rather
     than an infinity. */
  const base = raw.find((point) => point.value !== null && point.value !== 0)?.value ?? null;

  const points = raw.map((point) => ({
    month: point.month,
    value: point.value,
    indexed: point.value === null || base === null ? null : (point.value / base) * 100,
  }));

  const first = points.find((point) => point.value !== null)?.value ?? null;
  const last = [...points].reverse().find((point) => point.value !== null)?.value ?? null;

  return {
    measureId,
    label: definition.label,
    short,
    unit: definition.unit,
    points,
    growth: first === null || last === null || first === 0 ? null : last / first - 1,
  };
}

export interface Divergence {
  /** The series that grew most and least over the window. */
  readonly leader: TrendSeries;
  readonly laggard: TrendSeries;
  /** The month their indexed paths first separated by more than the threshold. */
  readonly from?: FiscalMonth;
  /** The gap at the end of the window, in index points. */
  readonly gap: number;
  /** The sentence a surface prints. Code writes it; the causal step is left to the reader. */
  readonly statement: string;
}

/**
 * How far apart the fastest and slowest series ended, and when they started to part.
 *
 * The threshold is in index points, so it means the same thing for every measure on the chart: five
 * points of divergence is five percent of the opening value, whatever that value was denominated in.
 */
export const DIVERGENCE_POINTS = 5;

export function divergenceOf(series: readonly TrendSeries[]): Divergence | null {
  const withEnd = series.filter(
    (s) => s.points.at(-1)?.indexed !== null && s.points.at(-1)?.indexed !== undefined,
  );
  if (withEnd.length < 2) return null;

  const ranked = [...withEnd].sort(
    (a, b) => (b.points.at(-1)?.indexed ?? 0) - (a.points.at(-1)?.indexed ?? 0),
  );
  const leader = ranked[0] as TrendSeries;
  const laggard = ranked[ranked.length - 1] as TrendSeries;
  const gap = (leader.points.at(-1)?.indexed ?? 0) - (laggard.points.at(-1)?.indexed ?? 0);
  if (gap < DIVERGENCE_POINTS) return null;

  /* The first month the gap opened past the threshold and stayed open. "Stayed" matters: a single month
     crossing and closing again is noise, and naming it would send a reader to look at nothing. */
  let from: FiscalMonth | undefined;
  leader.points.forEach((point, index) => {
    const other = laggard.points[index]?.indexed;
    if (point.indexed === null || other === null || other === undefined) return;
    const open = point.indexed - other >= DIVERGENCE_POINTS;
    if (open && from === undefined) from = point.month;
    if (!open) from = undefined;
  });

  return {
    leader,
    laggard,
    ...(from === undefined ? {} : { from }),
    gap,
    statement:
      `${leader.short} has grown ${gap.toFixed(0)} index points further than ${laggard.short.toLowerCase()} ` +
      `over this window` +
      (from === undefined ? '.' : `, and the two parted in ${monthLabel(from)}.`) +
      ` Growth is ${gap >= DIVERGENCE_POINTS ? 'not converting fully into' : 'converting into'} ` +
      `${laggard.short.toLowerCase()}; the bridges below decompose the difference.`,
  };
}

export interface Trend {
  readonly series: readonly TrendSeries[];
  readonly months: readonly FiscalMonth[];
  readonly divergence: Divergence | null;
}

export function buildTrend(
  ctx: MeasureContext,
  allMonths: readonly FiscalMonth[],
  through: FiscalMonth,
  selected: readonly string[],
  count = 12,
): Trend {
  const end = allMonths.indexOf(through);
  /* Ending at the selected month, not at the end of the model. A historical selection has closed months
     after it, and slicing the last twelve of the model would quietly move the chart into the future. */
  const months = end === -1 ? [] : allMonths.slice(Math.max(0, end - count + 1), end + 1);

  const series = TREND_MEASURES.filter((entry) => selected.includes(entry.id)).map((entry) =>
    seriesFor(entry.id, entry.short, ctx, months),
  );

  return { series, months, divergence: divergenceOf(series) };
}

/** Which measures a URL asked for, falling back to the default pair rather than to an empty chart. */
export function selectedTrend(raw: string | string[] | undefined): TrendMeasureId[] {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (text === undefined) return [...DEFAULT_TREND];
  const asked = text
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is TrendMeasureId => TREND_MEASURES.some((entry) => entry.id === part));
  /* One series is a legitimate choice — an empty chart is not, and neither is a URL that silently
     resolves to something the reader did not ask for. Zero readable ids means the parameter was
     nonsense, so the default is the honest answer. */
  return asked.length === 0 ? [...DEFAULT_TREND] : asked;
}
