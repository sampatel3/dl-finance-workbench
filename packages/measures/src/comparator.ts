/**
 * The five comparators.
 *
 * `FW-AI-005` makes the comparator a user choice rather than a baked-in prior year, which means it is
 * a parameter of every figure on every surface and a part of every commentary item's identity. A
 * quarterly commentary against budget and a monthly one against prior year are two different things,
 * and a product that treats the comparator as page context will eventually confuse them.
 *
 * Four of the five are lookups. One is not, and that difference is the most important thing in this
 * file:
 *
 *   prior period · prior year · budget · forecast — each resolves to a scope and a version, and the
 *   comparative value is the same measure computed there. Reproducible by construction.
 *
 *   **trend** is a FIT. There is no version of the world in which the trend is a number somebody
 *   recorded; it is an expectation derived from history, and its derivation is a choice. So it is
 *   stated in one place, labelled as an expectation everywhere it appears, and **excluded from
 *   materiality** — it may inform a reader and it may not raise a priority-board item. A comparator
 *   nobody can reproduce should not be able to put something in front of a chief financial officer.
 */

import type { FiscalMonth, PeriodScope, Scenario } from '@kestrel/model';
import {
  CALENDAR_YEAR,
  addMonths,
  fiscalHalfOf,
  fiscalQuarterOf,
  fiscalYearOf,
  formatMonthShort,
  priorPeriodScope,
  priorYearScope,
} from '@kestrel/model';

import type { MeasureContext, MeasureValue } from './compute.ts';
import { computeMeasure, contextAtScope, measureSeries } from './compute.ts';
import { measure } from './catalogue.ts';
import { delta } from './units.ts';
import type { Unit } from './units.ts';

export type ComparatorId = 'prior_period' | 'prior_year' | 'budget' | 'forecast' | 'trend';

export const COMPARATORS: readonly ComparatorId[] = [
  'prior_period',
  'prior_year',
  'budget',
  'forecast',
  'trend',
];

export interface ComparatorChoice {
  readonly id: ComparatorId;
  /** Which budget or forecast version. Ignored by the other three. */
  readonly versionId?: string;
}

export interface ResolvedComparator {
  readonly id: ComparatorId;
  readonly label: string;
  /** How the comparative value is produced. */
  readonly kind: 'lookup' | 'fit';
  /**
   * False for the trend, and it is enforced in `materiality.ts`. A fitted expectation is not a plan
   * anybody committed to, so nothing can be materially adverse against it.
   */
  readonly admissibleForMateriality: boolean;
  /** Present for a lookup: the window and version the comparative is read from. */
  readonly scope?: PeriodScope;
  readonly scenario?: Scenario;
  readonly versionId?: string;
  /** One line the surface prints so a reader always knows what a figure is being compared against. */
  readonly basis: string;
}

/** How many months of history the trend is fitted over. */
export const TREND_WINDOW_MONTHS = 12;

export function resolveComparator(
  choice: ComparatorChoice,
  ctx: MeasureContext,
): ResolvedComparator {
  switch (choice.id) {
    case 'prior_period': {
      const scope = priorPeriodScope(ctx.scope);
      return {
        id: choice.id,
        label: 'Prior period',
        kind: 'lookup',
        admissibleForMateriality: true,
        scope,
        scenario: 'ACTUAL',
        versionId: 'actual',
        basis: `${financePeriodLabel(scope)} Actual`,
      };
    }
    case 'prior_year': {
      const scope = priorYearScope(ctx.scope);
      return {
        id: choice.id,
        label: 'Prior year',
        kind: 'lookup',
        admissibleForMateriality: true,
        scope,
        scenario: 'ACTUAL',
        versionId: 'actual',
        basis: `${financePeriodLabel(scope)} Actual`,
      };
    }
    case 'budget': {
      const versionId = choice.versionId ?? 'budget-fy26';
      return {
        id: choice.id,
        label: 'Budget',
        kind: 'lookup',
        admissibleForMateriality: true,
        // The same window: a budget variance is this period against what this period was budgeted at.
        scope: ctx.scope,
        scenario: 'BUDGET',
        versionId,
        basis: `${financePeriodLabel(ctx.scope)} Budget (approved)`,
      };
    }
    case 'forecast': {
      const versionId = choice.versionId ?? 'v6';
      return {
        id: choice.id,
        label: 'Forecast',
        kind: 'lookup',
        admissibleForMateriality: true,
        scope: ctx.scope,
        scenario: 'FORECAST',
        versionId,
        basis: `${financePeriodLabel(ctx.scope)} Forecast ${versionId}`,
      };
    }
    case 'trend':
      return {
        id: choice.id,
        label: 'Trend',
        kind: 'fit',
        admissibleForMateriality: false,
        basis:
          `${financePeriodLabel(ctx.scope)} ${TREND_WINDOW_MONTHS}-month fitted trend ` +
          '(expectation, not an approved plan)',
      };
  }
}

/**
 * A compact finance label for a comparative window.
 *
 * A one-month period is named as "Jun 26", not "the 1 months to 2026-06". Complete fiscal
 * periods retain the familiar Q/H/FY convention; irregular or partial comparative windows name
 * their exact endpoints so the wording never implies months that are not in the calculation.
 */
export function financePeriodLabel(scope: PeriodScope): string {
  const months = monthsIn(scope);
  if (months === 1) return formatMonthShort(scope.endMonth);

  const fiscalYear = fiscalYearOf(scope.endMonth, CALENDAR_YEAR);
  const shortYear = String(fiscalYear).slice(-2);
  if (scope.type === 'QUARTER' && months === 3) {
    return `Q${fiscalQuarterOf(scope.endMonth, CALENDAR_YEAR)} FY${shortYear}`;
  }
  if (scope.type === 'HALF_YEAR' && months === 6) {
    return `H${fiscalHalfOf(scope.endMonth, CALENDAR_YEAR)} FY${shortYear}`;
  }
  if (scope.type === 'FISCAL_YEAR' && months === 12) return `FY${shortYear}`;
  if (scope.type === 'YTD') return `FY${shortYear} YTD to ${formatMonthShort(scope.endMonth)}`;
  if (scope.type === 'TTM' && months === 12) {
    return `12 months to ${formatMonthShort(scope.endMonth)}`;
  }

  return `${formatMonthShort(scope.startMonth)}–${formatMonthShort(scope.endMonth)}`;
}

/** A measure, its comparative, and the movement between them. */
export interface MeasureWithComparison {
  readonly current: MeasureValue;
  readonly comparator: ResolvedComparator;
  readonly comparativeValue: number | null;
  readonly movement: number | null;
  readonly movementUnit: Unit;
  /** True where the movement runs in the direction the measure's polarity calls good. */
  readonly favourable: boolean | null;
}

/**
 * Compute a measure against a comparator.
 *
 * `favourable` comes from the measure's own polarity rather than from the arithmetic sign, and that is
 * the whole reason it exists as a field. A cost that rose is a positive movement and unfavourable
 * news; a product that colours by sign prints a rising expense in the same green as rising income,
 * which is the single most common defect in a management report.
 */
export function compareMeasure(
  id: string,
  ctx: MeasureContext,
  choice: ComparatorChoice,
): MeasureWithComparison {
  const current = computeMeasure(id, ctx);
  const comparator = resolveComparator(choice, ctx);

  const comparativeValue =
    comparator.kind === 'fit'
      ? trendExpectation(id, ctx)
      : (() => {
          const scoped = contextAtScope(ctx, comparator.scope ?? ctx.scope);
          // A time comparator is the reported historic figure. Constant currency changes the current
          // side by translating it at that historic window's rates; applying another constant transform
          // to the historic side would borrow rates from a second, unrelated year.
          const historicalTimeComparator =
            ctx.lens === 'constant' &&
            (choice.id === 'prior_period' || choice.id === 'prior_year');
          return computeMeasure(id, {
            ...scoped,
            ...(historicalTimeComparator
              ? { lens: 'reported' as const, comparativeScope: undefined }
              : {}),
            scenario: comparator.scenario ?? ctx.scenario,
            versionId: comparator.versionId ?? ctx.versionId,
          }).value;
        })();

  const movement = delta(current.value, comparativeValue, current.unit);
  const favourable =
    movement.value === null || movement.value === 0 || current.polarity === 'neutral'
      ? null
      : current.polarity === 'higher_is_better'
        ? movement.value > 0
        : movement.value < 0;

  return {
    current,
    comparator,
    comparativeValue,
    movement: movement.value,
    movementUnit: movement.unit,
    favourable,
  };
}

// ---------------------------------------------------------------------------
// The trend
// ---------------------------------------------------------------------------

/**
 * The trend expectation for a window: a least-squares line through the twelve months before it,
 * extended across the window, then aggregated the way the measure declares.
 *
 * Three decisions are worth stating because each of them could reasonably go the other way, and none
 * of them is discoverable from the number:
 *
 *   **The fit uses the months BEFORE the window, never inside it.** A line fitted through the period
 *   it is meant to be an expectation for is not an expectation; it is a description, and the variance
 *   against it is always near zero.
 *
 *   **Aggregation is declared per measure, not derived.** A measure has no basis, so a flow summing
 *   and a stock reading its last value cannot be worked out from the definition. `trend: 'sum'` on a
 *   ratio would produce an expectation seven times too large for a year-to-date window.
 *
 *   **Fewer than three months of history means no expectation.** Two points make a line that says
 *   nothing, and returning it anyway is how a fitted comparator earns its bad reputation.
 */
export function trendExpectation(id: string, ctx: MeasureContext): number | null {
  const definition = measure(id);
  const historyEnd = addMonths(ctx.scope.startMonth, -1);
  const historyStart = addMonths(historyEnd, -(TREND_WINDOW_MONTHS - 1));

  const history = measureSeries(id, ctx, historyStart, historyEnd).filter(
    (point): point is { month: FiscalMonth; value: number } => point.value !== null,
  );
  if (history.length < 3) return null;

  // Least squares on the index, which is evenly spaced by construction.
  const n = history.length;
  const meanX = (n - 1) / 2;
  const meanY = history.reduce((sum, p) => sum + p.value, 0) / n;
  let covariance = 0;
  let variance = 0;
  history.forEach((point, i) => {
    covariance += (i - meanX) * (point.value - meanY);
    variance += (i - meanX) ** 2;
  });
  const slope = variance === 0 ? 0 : covariance / variance;
  const intercept = meanY - slope * meanX;

  // Extend across the window. Index n is the first month of the scope.
  const monthsInScope = monthsIn(ctx.scope);
  const predictions = Array.from({ length: monthsInScope }, (_, k) => intercept + slope * (n + k));

  switch (definition.trend) {
    case 'sum':
      return predictions.reduce((sum, value) => sum + value, 0);
    case 'last':
      return predictions[predictions.length - 1] ?? null;
    case 'mean':
      return predictions.reduce((sum, value) => sum + value, 0) / predictions.length;
  }
}

function monthsIn(scope: PeriodScope): number {
  const [startYear, startMonth] = scope.startMonth.split('-').map(Number);
  const [endYear, endMonth] = scope.endMonth.split('-').map(Number);
  return (endYear ?? 0) * 12 + (endMonth ?? 0) - ((startYear ?? 0) * 12 + (startMonth ?? 0)) + 1;
}
