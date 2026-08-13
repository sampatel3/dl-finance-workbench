/**
 * The performance three-way view.
 *
 * A single-period variance cannot distinguish timing from a change in run rate. Finance reads three
 * horizons together instead: the closed month, the year to date, and the part of the approved
 * forecast that remains after the selected close (and after its actuals cut-off). This module makes
 * those horizons one deterministic object so the Performance surface cannot assemble three subtly
 * different definitions itself.
 *
 * The selected scope contributes only its `endMonth`. A quarter-to-date or partial-year selection
 * therefore ends the in-month and YTD reads at the same hard reporting boundary. Remaining forecast
 * is different: it runs from strictly after both the selected close and the approved forecast's
 * `actualsThrough` to the selected fiscal year's end. That keeps the closed month out of both the
 * in-month actual and the remaining projection, while also excluding months held as actuals inside
 * the approved version.
 */

import type {
  FiscalCalendar,
  FiscalMonth,
  PeriodScope,
  VersionSpec,
} from '@kestrel/model';
import {
  ACTUAL_VERSION,
  CALENDAR_YEAR,
  VERSIONS,
  addMonths,
  compareMonths,
  firstMonthOfFiscalYear,
  fiscalYearOf,
  formatMonthLong,
  lastMonthOfFiscalYear,
  monthScope,
  ytdScope,
} from '@kestrel/model';
import type {
  MeasureContext,
  MeasureValue,
  MeasureWithComparison,
  Unit,
} from '@kestrel/measures';
import { compareMeasure, contextAtScope } from '@kestrel/measures';

import { activeApprovedForecast } from './forecast.ts';

export type ThreeWaySliceKind = 'in_month' | 'year_to_date' | 'remaining_forecast';

/** One named basis and the variance to it, in both level and relative units. */
export interface ThreeWayVariance {
  readonly label: string;
  readonly basis: string;
  readonly comparativeValue: number | null;
  /** Subject less comparative, expressed in a unit a finance reader expects. */
  readonly variance: number | null;
  readonly varianceUnit: Unit;
  /** Relative movement for levels, absolute movement for rates, as defined by the measure layer. */
  readonly movement: number | null;
  readonly movementUnit: Unit;
  readonly favourable: boolean | null;
}

export interface ActualThreeWaySlice {
  readonly kind: 'in_month' | 'year_to_date';
  readonly label: string;
  readonly subject: 'actual';
  readonly subjectLabel: 'Actual';
  readonly scope: PeriodScope;
  readonly value: MeasureValue;
  readonly vsBudget: ThreeWayVariance;
  readonly vsApprovedForecast: ThreeWayVariance;
}

export interface RemainingForecastSlice {
  readonly kind: 'remaining_forecast';
  readonly label: 'Remaining forecast';
  readonly subject: 'approved_forecast';
  readonly subjectLabel: string;
  /** Null when the selected fiscal year ends before this version's first projected month. */
  readonly scope: PeriodScope | null;
  readonly value: MeasureValue | null;
  readonly vsBudget: ThreeWayVariance | null;
  /** Comparing the approved forecast with itself would be a decorative zero, so it is absent. */
  readonly vsApprovedForecast: null;
  readonly emptyReason?: string;
}

export type ThreeWaySlice = ActualThreeWaySlice | RemainingForecastSlice;

export interface ThreeWaySplit {
  readonly measureId: string;
  readonly measureLabel: string;
  readonly unit: Unit;
  /** The selected reporting boundary, irrespective of whether the selected shape is M/Q/H/Y/YTD. */
  readonly through: FiscalMonth;
  readonly fiscalYear: number;
  readonly approvedForecast: VersionSpec;
  readonly budget: VersionSpec;
  readonly actualsCutoff: FiscalMonth;
  /** The first month that is genuinely projected in the approved version. */
  readonly projectionStarts: FiscalMonth;
  readonly bases: {
    readonly actual: string;
    readonly budget: string;
    readonly approvedForecast: string;
  };
  /** Fixed order is part of the object: month, YTD, then the remaining projection. */
  readonly slices: readonly [ActualThreeWaySlice, ActualThreeWaySlice, RemainingForecastSlice];
}

export interface ThreeWaySplitRequest {
  readonly measureId: string;
  readonly ctx: MeasureContext;
  readonly calendar?: FiscalCalendar;
}

/** The approved budget carried by the seeded reporting model. */
function activeApprovedBudget(): VersionSpec {
  const budget = [...VERSIONS]
    .filter((candidate) => candidate.scenario === 'BUDGET' && candidate.status === 'approved')
    .pop();
  if (budget === undefined) throw new Error('no approved budget version');
  return budget;
}

/**
 * Subject less comparative in the measure's reading unit.
 *
 * A movement between percentages is stated in basis points. Other units retain their own unit; the
 * separate `movement` field carries the relative percentage for additive levels such as revenue.
 */
function levelVariance(comparison: MeasureWithComparison): {
  readonly value: number | null;
  readonly unit: Unit;
} {
  const { value, unit } = comparison.current;
  const comparative = comparison.comparativeValue;
  if (value === null || comparative === null) {
    return { value: null, unit: unit === 'percent' ? 'bps' : unit };
  }
  if (unit === 'percent') return { value: (value - comparative) * 10_000, unit: 'bps' };
  return { value: value - comparative, unit };
}

function varianceOf(comparison: MeasureWithComparison): ThreeWayVariance {
  const variance = levelVariance(comparison);
  return {
    label: comparison.comparator.label,
    basis: comparison.comparator.basis,
    comparativeValue: comparison.comparativeValue,
    variance: variance.value,
    varianceUnit: variance.unit,
    movement: comparison.movement,
    movementUnit: comparison.movementUnit,
    favourable: comparison.favourable,
  };
}

function actualSlice(
  kind: ActualThreeWaySlice['kind'],
  label: string,
  measureId: string,
  ctx: MeasureContext,
  scope: PeriodScope,
  budget: VersionSpec,
  forecast: VersionSpec,
): ActualThreeWaySlice {
  const actualCtx: MeasureContext = {
    ...contextAtScope(ctx, scope),
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
  };
  const againstBudget = compareMeasure(measureId, actualCtx, {
    id: 'budget',
    versionId: budget.id,
  });
  const againstForecast = compareMeasure(measureId, actualCtx, {
    id: 'forecast',
    versionId: forecast.id,
  });

  return {
    kind,
    label,
    subject: 'actual',
    subjectLabel: 'Actual',
    scope,
    value: againstBudget.current,
    vsBudget: varianceOf(againstBudget),
    vsApprovedForecast: varianceOf(againstForecast),
  };
}

/** The selected-fiscal-year part of the approved version that is still a projection. */
function remainingScope(
  through: FiscalMonth,
  actualsCutoff: FiscalMonth,
  calendar: FiscalCalendar,
): PeriodScope | null {
  const fiscalYear = fiscalYearOf(through, calendar);
  const fiscalYearStart = firstMonthOfFiscalYear(fiscalYear, calendar);
  const fiscalYearEnd = lastMonthOfFiscalYear(fiscalYear, calendar);
  const firstProjected = addMonths(actualsCutoff, 1);
  const firstUnclosed = addMonths(through, 1);
  const start = [fiscalYearStart, firstProjected, firstUnclosed].reduce((latest, candidate) =>
    compareMonths(candidate, latest) > 0 ? candidate : latest,
  );
  if (compareMonths(start, fiscalYearEnd) > 0) return null;

  return {
    // This is the projected portion of the fiscal-year window, not a YTD scope.
    type: 'FISCAL_YEAR',
    startMonth: start,
    endMonth: fiscalYearEnd,
    label:
      start === fiscalYearEnd
        ? `Remaining forecast · ${formatMonthLong(fiscalYearEnd)}`
        : `Remaining forecast · ${formatMonthLong(start)} – ${formatMonthLong(fiscalYearEnd)}`,
  };
}

/**
 * Build the three horizons Finance reads together on Performance.
 *
 * This deliberately ignores the selected comparator and selected data scenario. The object has a
 * fixed meaning: closed actuals against the approved budget and approved forecast, followed by the
 * approved forecast's genuinely projected months against budget. A draft selected elsewhere in the
 * workbench therefore cannot quietly become the commitment shown here.
 */
export function buildThreeWaySplit(request: ThreeWaySplitRequest): ThreeWaySplit {
  const calendar = request.calendar ?? CALENDAR_YEAR;
  const through = request.ctx.scope.endMonth;
  const fiscalYear = fiscalYearOf(through, calendar);
  const forecast = activeApprovedForecast();
  const budget = activeApprovedBudget();
  const projectionStarts = addMonths(forecast.actualsThrough, 1);

  const inMonth = actualSlice(
    'in_month',
    'In month',
    request.measureId,
    request.ctx,
    monthScope(through),
    budget,
    forecast,
  );
  const yearToDate = actualSlice(
    'year_to_date',
    'Year to date',
    request.measureId,
    request.ctx,
    ytdScope(through, calendar),
    budget,
    forecast,
  );

  const scope = remainingScope(through, forecast.actualsThrough, calendar);
  let remaining: RemainingForecastSlice;
  if (scope === null) {
    remaining = {
      kind: 'remaining_forecast',
      label: 'Remaining forecast',
      subject: 'approved_forecast',
      subjectLabel: `${forecast.label} · approved`,
      scope: null,
      value: null,
      vsBudget: null,
      vsApprovedForecast: null,
      emptyReason:
        `The selected fiscal year ends before ${forecast.label}'s first projected month. ` +
        `Its actuals run through ${formatMonthLong(forecast.actualsThrough)}.`,
    };
  } else {
    const forecastCtx: MeasureContext = {
      ...contextAtScope(request.ctx, scope),
      scenario: forecast.scenario,
      versionId: forecast.id,
    };
    const againstBudget = compareMeasure(request.measureId, forecastCtx, {
      id: 'budget',
      versionId: budget.id,
    });
    remaining = {
      kind: 'remaining_forecast',
      label: 'Remaining forecast',
      subject: 'approved_forecast',
      subjectLabel: `${forecast.label} · approved`,
      scope,
      value: againstBudget.current,
      vsBudget: varianceOf(againstBudget),
      vsApprovedForecast: null,
    };
  }

  return {
    measureId: request.measureId,
    measureLabel: inMonth.value.label,
    unit: inMonth.value.unit,
    through,
    fiscalYear,
    approvedForecast: forecast,
    budget,
    actualsCutoff: forecast.actualsThrough,
    projectionStarts,
    bases: {
      actual: `Closed actuals through ${formatMonthLong(through)}, ${ACTUAL_VERSION}`,
      budget: `${budget.label}, ${budget.id}, ${budget.status}`,
      approvedForecast:
        `${forecast.label}, ${forecast.id}, ${forecast.status}; actuals through ` +
        `${formatMonthLong(forecast.actualsThrough)}, projected from ${formatMonthLong(projectionStarts)}`,
    },
    slices: [inMonth, yearToDate, remaining],
  };
}
