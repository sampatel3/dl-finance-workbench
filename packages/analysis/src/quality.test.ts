/**
 * Forecast quality.
 *
 * The thing being defended is the finding, not the arithmetic. The seed plants three consecutive
 * versions each assuming a subcontract rate and hours figure below the ones that arrived (PLANTED 9),
 * and this surface has to name that as bias rather than reporting three unrelated misses — while
 * staying quiet on revenue, which the same versions got wrong by more and in both directions.
 *
 * Four cases, and a detector needs all four to be worth having: the run that is a finding, the noise
 * that is not, the run that is too small to be one, and the healthy twin where none of it is there.
 */

import { describe, expect, it } from 'vitest';

import {
  ACTUAL_VERSION,
  SEED_END,
  buildHealthyWorld,
  buildWorld,
  monthScope,
} from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { allEntityIds } from '@kestrel/measures';

import {
  BIAS_MATERIALITY,
  BIAS_RUN_THRESHOLD,
  SCORED_MEASURES,
  accuracyByHorizon,
  detectBias,
  forecastPoints,
  qualityReport,
  valueAdded,
} from './quality.ts';

const world = buildWorld({ seed: 'kestrel-industrial-group' });
const healthy = buildHealthyWorld();

function ctx(w = world, overrides: Partial<MeasureContext> = {}): MeasureContext {
  return {
    store: w.store,
    rates: w.rates,
    scope: monthScope(SEED_END),
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
    lens: 'reported',
    entityIds: allEntityIds(),
    ...overrides,
  };
}

describe('what counts as a scoreable forecast', () => {
  const points = forecastPoints('revenue', ctx());

  it('scores only months after each version’s own cut-off', () => {
    // A version's actuals are not a forecast. Scoring them would give every version a perfect record
    // for its first half, which is the flattery this surface exists to remove — so v5, whose actuals
    // run to March, contributes nothing before April.
    const v5 = points.filter((p) => p.versionId === 'v5');
    expect(v5.length).toBeGreaterThan(0);
    expect(v5.every((p) => p.month > '2026-03')).toBe(true);
  });

  it('and only months that have since closed', () => {
    expect(points.every((p) => p.month <= SEED_END)).toBe(true);
    // v7's cut-off is the last closed month, so it has made no claim anybody can check yet. A surface
    // that scored it would be scoring the future.
    expect(points.some((p) => p.versionId === 'v7')).toBe(false);
  });

  it('excludes the budget, which is a target rather than a prediction', () => {
    // Scoring a budget for accuracy answers a question nobody asked: a budget is what the business
    // committed to, and missing it is a performance finding, not a forecasting one.
    expect(points.some((p) => p.versionId === 'budget-fy26')).toBe(false);
  });

  it('measures horizon from the version’s cut-off, not from today', () => {
    // The claim "next month will be X" made in December is a one-month claim, and it stays a one-month
    // claim in July. Measuring distance from now instead would make every old version look long-range.
    const v4 = points
      .filter((p) => p.versionId === 'v4')
      .sort((a, b) => (a.month < b.month ? -1 : 1));
    expect(v4[0]?.horizon).toBe(1);
    expect(v4[0]?.month).toBe('2026-01');
    v4.forEach((point, index) => expect(point.horizon).toBe(index + 1));
  });

  it('and keeps the signed error as well as the absolute one', () => {
    // Absolute error alone cannot find bias, which is the only finding here that nothing else in the
    // product will produce.
    expect(points.every((p) => Math.abs(p.error) === Math.abs(p.forecast - p.actual))).toBe(true);
    expect(points.some((p) => p.error < 0)).toBe(true);
  });
});

describe('accuracy is reported by distance', () => {
  const horizons = accuracyByHorizon('revenue', ctx());

  it('grouped per horizon rather than pooled into one number', () => {
    // A team whose one-month forecast is excellent and whose six-month forecast is guesswork has a
    // specific, fixable problem. A single MAPE conceals it in both directions.
    expect(horizons.length).toBeGreaterThan(3);
    expect(horizons.map((h) => h.horizon)).toEqual(
      [...horizons.map((h) => h.horizon)].sort((a, b) => a - b),
    );
    expect(horizons.every((h) => h.points > 0)).toBe(true);
  });

  it('and the near horizons carry more evidence than the far ones', () => {
    // Every version forecasts one month ahead; only the oldest forecasts seven. So the sample thins
    // with distance, and a surface that shows the far MAPE without the point count invites a reader to
    // trust the least-supported figure most.
    const near = horizons[0];
    const far = horizons[horizons.length - 1];
    expect(near?.points ?? 0).toBeGreaterThan(far?.points ?? 0);
  });

  it('and error is larger far out than near in, or the forecast is not doing any work', () => {
    // Not a law of arithmetic — a mechanical assertion here would be a lie about the data. It is a
    // property of this seed, and if it ever stopped holding the seed would be the thing to look at.
    const nearMape = horizons[0]?.mape ?? 0;
    const farMape = horizons[horizons.length - 1]?.mape ?? 0;
    expect(farMape).toBeGreaterThan(nearMape);
  });
});

describe('bias is a run across versions', () => {
  const bias = detectBias('subcontract_cost', ctx());

  it('and it finds the one the seed plants: subcontract cost, under-called every time', () => {
    // PLANTED 9. Each version assumed a subcontract rate below the one that arrived, and each by less
    // than the last — so the misses shrink, which is why no single variance looks like a pattern and
    // the run is the only thing that shows it.
    expect(bias.direction).toBe('under');
    expect(bias.biased).toBe(true);
    expect(bias.consecutiveVersions).toBeGreaterThanOrEqual(BIAS_RUN_THRESHOLD);
    expect(bias.meanSignedError).toBeLessThan(0);
    // Large enough to be worth the afternoon, which the run alone does not establish.
    expect(Math.abs(bias.meanSignedError)).toBeGreaterThan(BIAS_MATERIALITY);
    expect(bias.withheld).toBeUndefined();
  });

  it('and the misses shrink, so no single variance looks like a pattern', () => {
    // The reason the run is the only instrument that finds this. v4 was 11% light, v6 only 5.6% — each
    // version corrected part of the gap and none of them corrected the assumption. Every individual
    // variance is explicable on its own; the sequence is not.
    const magnitudes = bias.byVersion.map((v) => Math.abs(v.meanSignedError));
    expect(magnitudes).toEqual([...magnitudes].sort((a, b) => b - a));
  });

  it('counted across versions, not across months', () => {
    // Twelve months all wrong the same way is one mistake seen twelve times, because the months inside
    // a version share its assumptions. Four versions all wrong the same way is four separate chances to
    // correct it, not taken. So the run length is bounded by the number of versions scored.
    expect(bias.consecutiveVersions).toBeLessThanOrEqual(bias.byVersion.length);
    expect(bias.byVersion.length).toBeLessThan(bias.points);
  });

  it('and shows the run rather than asserting it', () => {
    // A reader who is told "biased" and shown one number has to take it on trust. The per-version
    // series is the evidence, in the order the versions were made so a run reads as a run in time.
    expect(bias.byVersion.map((v) => v.versionId)).toEqual(['v4', 'v5', 'v6']);
    expect(bias.byVersion.every((v) => v.meanSignedError < 0)).toBe(true);
  });

  it('and does not fire on the healthy twin', () => {
    // The same detector on a world without the planted condition. If it still said "biased" it would be
    // finding structure in the generator rather than in the business.
    //
    // This assertion is why the consolidation cache now carries the world's identity. It did not, so
    // the twin's queries returned the real world's cached numbers, and this test passed by comparing the
    // real world to itself. It is the assertion that caught it, and it only caught it because the twin
    // was expected to differ — a test that expects two things to agree can never notice.
    const twin = detectBias('subcontract_cost', ctx(healthy));
    expect(twin.biased).toBe(false);
    expect(twin.meanSignedError).toBe(0);
    expect(twin.meanSignedError).not.toBe(bias.meanSignedError);
  });

  it('and stays quiet on the measures the forecast is merely noisy about', () => {
    // Revenue is missed by more on average than subcontract cost is, and in both directions —
    // optimistic in v4, nearly right in v5, short in v6. That is a forecast doing its job imperfectly,
    // which is not a finding. A detector that called it bias would be reporting the existence of
    // forecasting rather than a fault in it.
    for (const measureId of ['revenue', 'gross_profit', 'dso', 'utilisation']) {
      const noise = detectBias(measureId, ctx());
      expect(noise.biased).toBe(false);
      expect(noise.consecutiveVersions).toBeLessThan(BIAS_RUN_THRESHOLD);
      expect(noise.withheld).toBe('run too short');
    }
    // And revenue's average miss is larger than the threshold, so it is the *run* test keeping it quiet
    // and not the size test. Both tests have to be able to be the one that fires.
    expect(Math.abs(detectBias('revenue', ctx()).meanSignedError)).toBeGreaterThan(
      BIAS_MATERIALITY,
    );
  });

  it('and follows the planted cause into the measures it flows through', () => {
    // The cost to serve was under-called in every version, so cost of sales is biased, and EBITDA — a
    // small difference of two large numbers — is biased by an order more. That amplification is the
    // reason the bias surface is worth having: nobody would find a 2% cost miss by looking at cost, and
    // everybody notices a 20% EBITDA miss. The drill runs the other way, from the noticed to the cause.
    const cost = detectBias('cost_of_sales', ctx());
    const ebitda = detectBias('ebitda', ctx());
    expect(cost.biased).toBe(true);
    expect(cost.direction).toBe('under');
    expect(ebitda.biased).toBe(true);
    // Costs under-called means profit over-called. Opposite directions from one cause, which a detector
    // keyed on the sign of the error rather than on the measure's polarity would report as two problems.
    expect(ebitda.direction).toBe('over');
    expect(Math.abs(ebitda.meanSignedError)).toBeGreaterThan(Math.abs(cost.meanSignedError));
  });

  it('and a run without size is not a finding either', () => {
    // Days payable outstanding was over-called in all three versions — a full run — by 58 basis points of
    // itself. Real, consistent, and not worth anybody's afternoon. Both tests have to pass, for the same
    // reason the materiality policy needs an absolute floor as well as a relative one: a detector that
    // fires on a consistent rounding error gets switched off, and then it is not there for the one that
    // counts.
    const dpo = detectBias('dpo', ctx());
    expect(dpo.consecutiveVersions).toBeGreaterThanOrEqual(BIAS_RUN_THRESHOLD);
    expect(Math.abs(dpo.meanSignedError)).toBeLessThan(BIAS_MATERIALITY);
    expect(dpo.biased).toBe(false);
    expect(dpo.withheld).toBe('movement immaterial');
  });

  it('and says how many versions it had to go on, because three out of three is a weak run', () => {
    // Only v4, v5 and v6 have made a claim that has since closed, so the longest possible run here is
    // three — the threshold itself. A surface showing "3 consecutive versions" without "of 3" implies a
    // history the data does not have.
    expect(bias.versionsScored).toBe(3);
    expect(bias.consecutiveVersions).toBe(bias.versionsScored);
  });

  it('is independent of accuracy: a forecast can be close on average and wrong every time', () => {
    // The point of keeping both instruments. Revenue's mean absolute error is larger than subcontract
    // cost's is at the near horizon, and revenue is the unbiased one — so a product reporting only MAPE
    // would rank the fixable problem below the unfixable one.
    expect(detectBias('revenue', ctx()).biased).toBe(false);
    expect(detectBias('subcontract_cost', ctx()).biased).toBe(true);
    expect(accuracyByHorizon('revenue', ctx()).length).toBe(
      accuracyByHorizon('subcontract_cost', ctx()).length,
    );
  });
});

describe('value added against a stated baseline', () => {
  const value = valueAdded('revenue', ctx());

  it('names the baseline rather than implying one', () => {
    // "Better than nothing" is not a claim anybody can check. This one is: the same month a year
    // earlier, which in a seasonal business is a genuinely hard bar rather than a straw man.
    expect(value.baselineName).toBe('the same month a year earlier');
    expect(value.baselineMape).toBeGreaterThan(0);
  });

  it('and the forecasting process beats it here', () => {
    expect(value.beatsBaseline).toBe(true);
    expect(value.valueAdded).toBeGreaterThan(0);
    expect(value.forecastMape).toBeLessThan(value.baselineMape);
  });

  it('and the comparison is like for like: the same months on both sides', () => {
    // A baseline scored over a different window is not a baseline. The value is only meaningful if
    // both errors are measured on exactly the months the forecast made a claim about.
    const points = forecastPoints('revenue', ctx());
    const rebuilt = valueAdded('revenue', ctx());
    expect(rebuilt.forecastMape).toBe(value.forecastMape);
    expect(points.length).toBeGreaterThan(0);
  });
});

describe('the report a surface renders', () => {
  it('carries the versions it scored, so a reader knows what the numbers are made of', () => {
    const report = qualityReport('subcontract_cost', ctx());
    expect(report.versions.every((v) => v.scenario === 'FORECAST')).toBe(true);
    expect(report.label).toBeTruthy();
    expect(report.scope).toEqual(monthScope(SEED_END));
  });

  it('and every scored measure produces one', () => {
    for (const measureId of SCORED_MEASURES) {
      const report = qualityReport(measureId, ctx());
      expect(report.horizons.length).toBeGreaterThan(0);
      expect(report.bias.points).toBeGreaterThan(0);
    }
  });
});
