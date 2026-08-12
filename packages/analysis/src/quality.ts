/**
 * Forecast quality — the surface that holds the product accountable for its own output.
 *
 * The client's PRD measures the *product's* success by cycle time and adoption. It never measures the
 * *forecast's* accuracy, and that is the gap with a hole where the credibility should be: a product
 * that generates forecasts and never scores them is asking for trust it has not earned.
 *
 * It is also nearly free. The data is already here — the versions the product keeps are a record of
 * what it believed and when — so scoring is arithmetic over things already stored. That it is cheap
 * and was still omitted is the reason it is worth arguing into the MVP rather than a later phase.
 *
 * Three instruments, and each answers a different question:
 *
 *   **Error by horizon.** How wrong, and at what distance. A one-month-out claim and a six-month-out
 *   claim are different claims, and averaging them together hides the only useful thing about the
 *   pair — which is that the near one should be much better. A single accuracy number for a whole
 *   forecast is a number nobody can act on.
 *
 *   **Bias.** Wrong in the *same direction*, repeatedly. This is the one nothing else in the product
 *   will find, and it is the useful one: random error is the weather, but four versions in a row
 *   under-calling the same cost is an assumption somebody should change. Error and bias are
 *   independent — a forecast can be accurate on average and biased every single time.
 *
 *   **Value added.** Does the process beat "same as last month"? An uncomfortable question, and a
 *   forecast that loses to a naive baseline is a forecast that is costing more than it is worth. The
 *   comparison is against a stated baseline rather than an implied one, because "better than nothing"
 *   is not a claim anybody can check.
 */

import type { FiscalMonth, PeriodScope, VersionSpec } from '@kestrel/model';
import { addMonths, monthScope, monthsBetween } from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { computeMeasure } from '@kestrel/measures';

import { versionList } from './forecast.ts';

/** One forecast of one month, and what actually happened. */
export interface ForecastPoint {
  readonly versionId: string;
  readonly month: FiscalMonth;
  /** Months between the version's own cut-off and the month it is forecasting. */
  readonly horizon: number;
  readonly forecast: number;
  readonly actual: number;
  /** Signed: positive means the forecast was too high. */
  readonly error: number;
  /** Absolute percentage error. */
  readonly ape: number;
}

/**
 * Every point where a version forecast a month that has since closed.
 *
 * Only months **after** the version's cut-off count. A version's own actuals are not a forecast, and
 * scoring them would produce a perfect record for the first half of every version — which is exactly
 * the flattery a forecast-quality surface exists to remove.
 */
export function forecastPoints(measureId: string, ctx: MeasureContext): ForecastPoint[] {
  const points: ForecastPoint[] = [];

  for (const version of versionList()) {
    if (version.scenario !== 'FORECAST') continue;
    const firstForecastMonth = addMonths(version.actualsThrough, 1);
    // Only closed months can be scored, so the window ends at the last month the world holds.
    for (const month of monthsBetween(firstForecastMonth, ctx.scope.endMonth)) {
      const scope = monthScope(month);
      const forecast = computeMeasure(measureId, {
        ...ctx,
        scope,
        scenario: 'FORECAST',
        versionId: version.id,
      }).value;
      const actual = computeMeasure(measureId, {
        ...ctx,
        scope,
        scenario: 'ACTUAL',
        versionId: 'actual',
      }).value;
      if (forecast === null || actual === null || actual === 0) continue;

      const error = forecast - actual;
      points.push({
        versionId: version.id,
        month,
        horizon: monthsBetween(firstForecastMonth, month).length,
        forecast,
        actual,
        error,
        ape: Math.abs(error) / Math.abs(actual),
      });
    }
  }

  return points;
}

// ---------------------------------------------------------------------------
// Error by horizon
// ---------------------------------------------------------------------------

export interface HorizonAccuracy {
  readonly horizon: number;
  readonly points: number;
  /** Mean absolute percentage error at this distance. */
  readonly mape: number;
}

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, v) => total + v, 0) / values.length;

/**
 * Accuracy grouped by distance.
 *
 * Reported per horizon rather than pooled, because pooling answers a question nobody asked. A team
 * whose one-month forecast is excellent and whose six-month forecast is guesswork has a specific,
 * fixable problem, and a single average conceals it in both directions.
 */
export function accuracyByHorizon(measureId: string, ctx: MeasureContext): HorizonAccuracy[] {
  const points = forecastPoints(measureId, ctx);
  const byHorizon = new Map<number, number[]>();
  for (const point of points) {
    const bucket = byHorizon.get(point.horizon);
    if (bucket) bucket.push(point.ape);
    else byHorizon.set(point.horizon, [point.ape]);
  }
  return [...byHorizon.entries()]
    .map(([horizon, apes]) => ({ horizon, points: apes.length, mape: mean(apes) }))
    .sort((a, b) => a.horizon - b.horizon);
}

// ---------------------------------------------------------------------------
// Bias
// ---------------------------------------------------------------------------

export interface Bias {
  readonly measureId: string;
  /** Mean signed error as a share of actual. Positive means habitually too high. */
  readonly meanSignedError: number;
  /** How many of the scored points erred in the majority direction. */
  readonly sameDirection: number;
  readonly points: number;
  /** Consecutive versions whose mean error ran the same way. The finding, not the number. */
  readonly consecutiveVersions: number;
  /**
   * How many versions were scored at all. Carried because a run of three out of three versions is a
   * weaker claim than a run of three out of eight, and a surface that shows only the run implies the
   * stronger one.
   */
  readonly versionsScored: number;
  readonly direction: 'over' | 'under' | 'none';
  /** True where the run is long enough AND large enough to be an assumption rather than the weather. */
  readonly biased: boolean;
  /** Which of the two tests the finding failed, where it failed one. Empty when biased. */
  readonly withheld?: 'run too short' | 'movement immaterial';
  /** Per-version mean signed error, so a surface can show the run rather than assert it. */
  readonly byVersion: readonly { versionId: string; meanSignedError: number }[];
}

/** How many consecutive versions erring the same way counts as bias rather than luck. */
export const BIAS_RUN_THRESHOLD = 3;

/**
 * How large the habitual miss has to be before it is worth somebody's afternoon.
 *
 * A run on its own is not a finding, for the same reason a variance on its own is not: three versions
 * each 30 basis points light on gross margin is a run, and it is also nothing. This mirrors the
 * materiality policy's shape — a direction test and a size test, both required — because a detector
 * that fires on a consistent rounding error will be switched off within a week, and then it will not
 * be there for the one that matters.
 *
 * It is a *relative* floor only. An absolute one would need each measure's own scale, and the mean
 * signed error is already scaled by the actual, so the comparison is like for like across measures.
 */
export const BIAS_MATERIALITY = 0.02;

/**
 * Is this measure habitually forecast wrong in one direction?
 *
 * The test is a run across **versions**, not across months. Months inside one version share its
 * assumptions, so twelve months all wrong the same way is one mistake seen twelve times; four
 * versions all wrong the same way is four separate opportunities to correct it, not taken.
 */
export function detectBias(measureId: string, ctx: MeasureContext): Bias {
  const points = forecastPoints(measureId, ctx);

  const byVersionMap = new Map<string, number[]>();
  for (const point of points) {
    const relative = point.error / Math.abs(point.actual);
    const bucket = byVersionMap.get(point.versionId);
    if (bucket) bucket.push(relative);
    else byVersionMap.set(point.versionId, [relative]);
  }

  // In the order the versions were made, so a run is a run in time.
  const byVersion = versionList()
    .filter((v) => byVersionMap.has(v.id))
    .map((v) => ({ versionId: v.id, meanSignedError: mean(byVersionMap.get(v.id) ?? []) }));

  const meanSignedError = mean(points.map((p) => p.error / Math.abs(p.actual)));
  const direction: Bias['direction'] =
    byVersion.length === 0 ? 'none' : meanSignedError > 0 ? 'over' : 'under';

  // The longest run of versions erring in the majority direction, ending at the most recent.
  let consecutive = 0;
  for (let i = byVersion.length - 1; i >= 0; i--) {
    const error = byVersion[i]?.meanSignedError ?? 0;
    const sameWay = direction === 'over' ? error > 0 : error < 0;
    if (!sameWay) break;
    consecutive += 1;
  }

  const sameDirection = points.filter((p) =>
    direction === 'over' ? p.error > 0 : p.error < 0,
  ).length;

  const runLongEnough = consecutive >= BIAS_RUN_THRESHOLD;
  const movementMaterial = Math.abs(meanSignedError) >= BIAS_MATERIALITY;
  const withheld: Bias['withheld'] = !runLongEnough
    ? 'run too short'
    : !movementMaterial
      ? 'movement immaterial'
      : undefined;

  return {
    measureId,
    meanSignedError,
    sameDirection,
    points: points.length,
    consecutiveVersions: consecutive,
    versionsScored: byVersion.length,
    direction: consecutive === 0 ? 'none' : direction,
    biased: runLongEnough && movementMaterial,
    ...(withheld === undefined ? {} : { withheld }),
    byVersion,
  };
}

// ---------------------------------------------------------------------------
// Value added
// ---------------------------------------------------------------------------

export interface ValueAdded {
  readonly measureId: string;
  /** The forecast's mean absolute percentage error. */
  readonly forecastMape: number;
  /** The naive baseline's: the same month a year earlier. */
  readonly baselineMape: number;
  /** How much better the forecast is than the baseline, as a share of the baseline's error. */
  readonly valueAdded: number;
  /** False where the process is losing to "same as last year", which is worth knowing. */
  readonly beatsBaseline: boolean;
  readonly baselineName: string;
}

/**
 * Does the forecast beat a naive baseline?
 *
 * The baseline is the same month a year earlier — stated, rather than implied, because "better than
 * nothing" is not a claim anybody can check. A seasonal business makes this a genuinely hard bar: last
 * July is a better guess at this July than last month is, and a forecasting process that cannot beat it
 * is one whose effort is going somewhere other than accuracy.
 */
export function valueAdded(measureId: string, ctx: MeasureContext): ValueAdded {
  const points = forecastPoints(measureId, ctx);

  const forecastApes: number[] = [];
  const baselineApes: number[] = [];

  for (const point of points) {
    const priorYear = computeMeasure(measureId, {
      ...ctx,
      scope: monthScope(addMonths(point.month, -12)),
      scenario: 'ACTUAL',
      versionId: 'actual',
    }).value;
    if (priorYear === null) continue;
    forecastApes.push(point.ape);
    baselineApes.push(Math.abs(priorYear - point.actual) / Math.abs(point.actual));
  }

  const forecastMape = mean(forecastApes);
  const baselineMape = mean(baselineApes);

  return {
    measureId,
    forecastMape,
    baselineMape,
    valueAdded: baselineMape === 0 ? 0 : (baselineMape - forecastMape) / baselineMape,
    beatsBaseline: forecastMape < baselineMape,
    baselineName: 'the same month a year earlier',
  };
}

// ---------------------------------------------------------------------------
// The surface's own summary
// ---------------------------------------------------------------------------

export interface QualityReport {
  readonly measureId: string;
  readonly label: string;
  readonly scope: PeriodScope;
  readonly horizons: readonly HorizonAccuracy[];
  readonly bias: Bias;
  readonly value: ValueAdded;
  /** The versions scored, so a reader knows what the numbers are made of. */
  readonly versions: readonly VersionSpec[];
}

/** The measures worth scoring. Revenue and the cost that has been habitually under-called. */
export const SCORED_MEASURES = ['revenue', 'cost_of_sales', 'subcontract_cost', 'ebitda'] as const;

export function qualityReport(measureId: string, ctx: MeasureContext): QualityReport {
  return {
    measureId,
    label: computeMeasure(measureId, ctx).label,
    scope: ctx.scope,
    horizons: accuracyByHorizon(measureId, ctx),
    bias: detectBias(measureId, ctx),
    value: valueAdded(measureId, ctx),
    versions: versionList().filter((v) => v.scenario === 'FORECAST'),
  };
}
