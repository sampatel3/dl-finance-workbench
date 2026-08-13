/**
 * Year to go — the expected fiscal-year landing from actuals at the reporting boundary and the
 * approved forecast.
 *
 * The arithmetic depends on what a measure is. Profit-and-loss flows add: closed actual YTD plus
 * the approved forecast after the selected close. A margin does not add, so it is recomputed from
 * the landed gross profit and revenue. Cash is a closing balance, so it is rebased: the latest
 * actual cash plus the movement from the approved forecast between that close and year end.
 *
 * Keeping those three rules together prevents a surface from summing margins or adding closing cash
 * balances merely because both are displayed beside additive measures.
 */

import type { FiscalCalendar, FiscalMonth, PeriodScope, VersionSpec } from '@kestrel/model';
import {
  ACTUAL_VERSION,
  CALENDAR_YEAR,
  VERSIONS,
  compareMonths,
  fiscalYearOf,
  fiscalYearScope,
  formatMonthLong,
  lastMonthOfFiscalYear,
  monthScope,
} from '@kestrel/model';
import type { MeasureContext, MeasureWithComparison } from '@kestrel/measures';
import {
  assessMateriality,
  compareMeasure,
  computeMeasure,
  contextAtScope,
  delta,
  resolveComparator,
} from '@kestrel/measures';

import { activeApprovedForecast } from './forecast.ts';
import { buildThreeWaySplit } from './three-way.ts';

export const YEAR_TO_GO_MEASURES = [
  'revenue',
  'gross_profit',
  'gross_margin',
  'ebitda',
  'cash',
] as const;

export type YearToGoMeasureId = (typeof YEAR_TO_GO_MEASURES)[number];
export type Trajectory = 'ahead' | 'on_track' | 'behind' | 'unavailable';
export type RemainingValueKind = 'flow' | 'rate' | 'balance_movement';

export interface YearToGoLine {
  readonly measureId: YearToGoMeasureId;
  readonly label: string;
  readonly unit: 'currency' | 'percent';
  /** Actuals from fiscal-year start through the selected boundary. Cash is the closing balance. */
  readonly actualYtd: number | null;
  /** Approved forecast after the close. For cash, this is the forecast movement to year end. */
  readonly remainingForecast: number | null;
  readonly remainingKind: RemainingValueKind;
  readonly expectedFullYear: number | null;
  readonly fullYearBudget: number | null;
  readonly approvedForecastFullYear: number | null;
  readonly priorYearFullYear: number | null;
  /** Expected landing less budget, in money or basis points. */
  readonly varianceToBudget: number | null;
  readonly varianceUnit: 'currency' | 'bps';
  /** Relative variance for money measures. Margin uses basis points instead. */
  readonly relativeVarianceToBudget: number | null;
  readonly favourableToBudget: boolean | null;
  readonly trajectory: Trajectory;
  readonly materiality: string;
  readonly owner: string;
  readonly status: 'approved' | 'draft';
}

export interface YearToGoProjection {
  /** False when the selected reporting boundary predates the approved forecast's embedded actuals. */
  readonly available: boolean;
  readonly unavailableReason?: string;
  readonly through: FiscalMonth;
  readonly fiscalYear: number;
  readonly fiscalYearScope: PeriodScope;
  readonly actualYtdScope: PeriodScope;
  readonly remainingScope: PeriodScope | null;
  readonly approvedForecast: VersionSpec;
  readonly budget: VersionSpec;
  /** The actuals cut-off embedded in the approved forecast version, not the selected reporting boundary. */
  readonly actualsCutoff: FiscalMonth;
  readonly projectionStarts: FiscalMonth;
  readonly remainingStarts: FiscalMonth | null;
  readonly lines: readonly YearToGoLine[];
  readonly basis: {
    readonly actual: string;
    readonly remaining: string;
    readonly expected: string;
    readonly cash: string;
  };
}

export interface YearToGoRequest {
  readonly ctx: MeasureContext;
  readonly calendar?: FiscalCalendar;
}

function activeApprovedBudget(): VersionSpec {
  const budget = [...VERSIONS]
    .filter((candidate) => candidate.scenario === 'BUDGET' && candidate.status === 'approved')
    .pop();
  if (budget === undefined) throw new Error('no approved budget version');
  return budget;
}

function addLanding(actual: number | null, remaining: number | null): number | null {
  return actual === null || remaining === null ? null : actual + remaining;
}

function comparisonForLanding(
  measureId: YearToGoMeasureId,
  expected: number | null,
  budgetValue: number | null,
  ctx: MeasureContext,
  scope: PeriodScope,
  budget: VersionSpec,
): MeasureWithComparison {
  const scoped = contextAtScope(ctx, scope);
  const template = computeMeasure(measureId, {
    ...scoped,
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
  });
  const movement = delta(expected, budgetValue, template.unit);
  const difference =
    expected === null || budgetValue === null ? null : expected - budgetValue;
  const favourable =
    difference === null || difference === 0 || template.polarity === 'neutral'
      ? null
      : template.polarity === 'higher_is_better'
        ? difference > 0
        : difference < 0;

  return {
    current: { ...template, value: expected, scope },
    comparator: resolveComparator(
      { id: 'budget', versionId: budget.id },
      scoped,
    ),
    comparativeValue: budgetValue,
    movement: movement.value,
    movementUnit: movement.unit,
    favourable,
  };
}

function lineFor(
  measureId: YearToGoMeasureId,
  actualYtd: number | null,
  remainingForecast: number | null,
  remainingKind: RemainingValueKind,
  expectedFullYear: number | null,
  ctx: MeasureContext,
  fullYearScope: PeriodScope,
  forecast: VersionSpec,
  budget: VersionSpec,
): YearToGoLine {
  const scoped = contextAtScope(ctx, fullYearScope);
  const budgetValue = computeMeasure(measureId, {
    ...scoped,
    scenario: budget.scenario,
    versionId: budget.id,
  }).value;
  const forecastValue = computeMeasure(measureId, {
    ...scoped,
    scenario: forecast.scenario,
    versionId: forecast.id,
  }).value;
  const priorYearValue = compareMeasure(measureId, scoped, { id: 'prior_year' }).comparativeValue;
  const comparison = comparisonForLanding(
    measureId,
    expectedFullYear,
    budgetValue,
    ctx,
    fullYearScope,
    budget,
  );
  const classOf = measureId === 'cash' ? 'cf' : 'pl';
  const verdict = assessMateriality(comparison, classOf);
  const difference =
    expectedFullYear === null || budgetValue === null
      ? null
      : expectedFullYear - budgetValue;
  const varianceUnit = comparison.current.unit === 'percent' ? 'bps' : 'currency';
  const varianceToBudget =
    difference === null
      ? null
      : varianceUnit === 'bps'
        ? difference * 10_000
        : difference;
  const relativeVarianceToBudget =
    varianceUnit === 'currency' && difference !== null && budgetValue !== null && budgetValue !== 0
      ? difference / Math.abs(budgetValue)
      : null;
  const trajectory: Trajectory =
    expectedFullYear === null || budgetValue === null
      ? 'unavailable'
      : !verdict.material || comparison.favourable === null
        ? 'on_track'
        : comparison.favourable
          ? 'ahead'
          : 'behind';

  if (comparison.current.unit !== 'currency' && comparison.current.unit !== 'percent') {
    throw new Error(`Year-to-go does not support ${comparison.current.unit} for ${measureId}`);
  }

  return {
    measureId,
    label: comparison.current.label,
    unit: comparison.current.unit,
    actualYtd,
    remainingForecast,
    remainingKind,
    expectedFullYear,
    fullYearBudget: budgetValue,
    approvedForecastFullYear: forecastValue,
    priorYearFullYear: priorYearValue,
    varianceToBudget,
    varianceUnit,
    relativeVarianceToBudget,
    favourableToBudget: comparison.favourable,
    trajectory,
    materiality: verdict.reason,
    owner: comparison.current.owner,
    status: comparison.current.status,
  };
}

/**
 * Build the expected fiscal-year landing at the selected reporting boundary.
 *
 * The approved forecast is a governed version, not the caller's selected draft. A selected draft or
 * data scenario elsewhere in the workbench therefore cannot silently become the outlook here.
 */
export function buildYearToGo(request: YearToGoRequest): YearToGoProjection {
  const calendar = request.calendar ?? CALENDAR_YEAR;
  const through = request.ctx.scope.endMonth;
  const fiscalYear = fiscalYearOf(through, calendar);
  const fullYearScope = fiscalYearScope(fiscalYear, calendar);
  const fiscalYearEnd = lastMonthOfFiscalYear(fiscalYear, calendar);
  const forecast = activeApprovedForecast();
  const budget = activeApprovedBudget();

  const revenue = buildThreeWaySplit({ measureId: 'revenue', ctx: request.ctx, calendar });
  const grossProfit = buildThreeWaySplit({
    measureId: 'gross_profit',
    ctx: request.ctx,
    calendar,
  });
  const grossMargin = buildThreeWaySplit({
    measureId: 'gross_margin',
    ctx: request.ctx,
    calendar,
  });
  const ebitda = buildThreeWaySplit({ measureId: 'ebitda', ctx: request.ctx, calendar });

  const selectedBoundarySupportsForecast = compareMonths(through, forecast.actualsThrough) >= 0;
  const remainingScope = selectedBoundarySupportsForecast ? revenue.slices[2].scope : null;
  const hasCompleteLanding =
    selectedBoundarySupportsForecast && (remainingScope !== null || through === fiscalYearEnd);
  const flowLanding = (split: typeof revenue): number | null => {
    const actual = split.slices[1].value.value;
    if (!hasCompleteLanding) return null;
    if (remainingScope === null) return actual;
    return addLanding(actual, split.slices[2].value?.value ?? null);
  };

  const expectedRevenue = flowLanding(revenue);
  const expectedGrossProfit = flowLanding(grossProfit);
  const expectedEbitda = flowLanding(ebitda);
  const expectedGrossMargin =
    expectedRevenue === null || expectedGrossProfit === null || expectedRevenue === 0
      ? null
      : expectedGrossProfit / expectedRevenue;

  const throughScope = monthScope(through);
  const endScope = monthScope(fiscalYearEnd);
  const actualCash = computeMeasure('cash', {
    ...contextAtScope(request.ctx, throughScope),
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
  }).value;
  const forecastCashThrough = computeMeasure('cash', {
    ...contextAtScope(request.ctx, throughScope),
    scenario: forecast.scenario,
    versionId: forecast.id,
  }).value;
  const forecastCashAtYearEnd = computeMeasure('cash', {
    ...contextAtScope(request.ctx, endScope),
    scenario: forecast.scenario,
    versionId: forecast.id,
  }).value;
  const remainingCashMovement =
    !hasCompleteLanding || forecastCashThrough === null || forecastCashAtYearEnd === null
      ? null
      : forecastCashAtYearEnd - forecastCashThrough;
  const expectedCash =
    actualCash === null || remainingCashMovement === null
      ? null
      : actualCash + remainingCashMovement;

  const lines: YearToGoLine[] = [
    lineFor(
      'revenue',
      revenue.slices[1].value.value,
      selectedBoundarySupportsForecast ? (revenue.slices[2].value?.value ?? null) : null,
      'flow',
      expectedRevenue,
      request.ctx,
      fullYearScope,
      forecast,
      budget,
    ),
    lineFor(
      'gross_profit',
      grossProfit.slices[1].value.value,
      selectedBoundarySupportsForecast ? (grossProfit.slices[2].value?.value ?? null) : null,
      'flow',
      expectedGrossProfit,
      request.ctx,
      fullYearScope,
      forecast,
      budget,
    ),
    lineFor(
      'gross_margin',
      grossMargin.slices[1].value.value,
      selectedBoundarySupportsForecast ? (grossMargin.slices[2].value?.value ?? null) : null,
      'rate',
      expectedGrossMargin,
      request.ctx,
      fullYearScope,
      forecast,
      budget,
    ),
    lineFor(
      'ebitda',
      ebitda.slices[1].value.value,
      selectedBoundarySupportsForecast ? (ebitda.slices[2].value?.value ?? null) : null,
      'flow',
      expectedEbitda,
      request.ctx,
      fullYearScope,
      forecast,
      budget,
    ),
    lineFor(
      'cash',
      actualCash,
      remainingCashMovement,
      'balance_movement',
      expectedCash,
      request.ctx,
      fullYearScope,
      forecast,
      budget,
    ),
  ];

  return {
    available: selectedBoundarySupportsForecast,
    ...(selectedBoundarySupportsForecast
      ? {}
      : {
          unavailableReason:
            `A complete landing cannot be built at ${formatMonthLong(through)} from ` +
            `${forecast.label}, whose embedded actuals run through ` +
            `${formatMonthLong(forecast.actualsThrough)}. Choose that month or a later ` +
            'reporting boundary so no month is omitted or double-counted.',
        }),
    through,
    fiscalYear,
    fiscalYearScope: fullYearScope,
    actualYtdScope: revenue.slices[1].scope,
    remainingScope,
    approvedForecast: forecast,
    budget,
    actualsCutoff: forecast.actualsThrough,
    projectionStarts: revenue.projectionStarts,
    remainingStarts: remainingScope?.startMonth ?? null,
    lines,
    basis: {
      actual: `Actuals through ${formatMonthLong(through)}, ${ACTUAL_VERSION}`,
      remaining:
        !selectedBoundarySupportsForecast
          ? `Unavailable before ${forecast.label}'s actuals cut-off of ${formatMonthLong(forecast.actualsThrough)}`
          : remainingScope === null
          ? 'No approved forecast remains inside the selected fiscal year'
          : `${forecast.label}, ${remainingScope.label}`,
      expected:
        selectedBoundarySupportsForecast
          ? `Actuals through ${formatMonthLong(through)} plus ${forecast.label} thereafter`
          : 'Unavailable at the selected reporting boundary',
      cash:
        `Closing cash at ${formatMonthLong(through)} plus the movement in ${forecast.label} ` +
        `from ${formatMonthLong(through)} to ${formatMonthLong(fiscalYearEnd)}`,
    },
  };
}
