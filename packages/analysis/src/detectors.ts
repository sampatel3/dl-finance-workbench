/**
 * The detectors.
 *
 * Twelve rules, one per planted condition, and each of them is the answer to a question the client's
 * PRD asks the *user* to ask. `FW-DASH-001` wants a dashboard of priority insights; a dashboard is a
 * layout, and what makes it an insight is a rule that fired on data and can say why.
 *
 * ## Four properties, and each rules out a specific way this goes wrong
 *
 * **A finding carries the closed set of figures behind it.** Not a reference to where they could be
 * looked up — the values, with their units. This is the mechanism that lets a model write the
 * commentary without being able to invent a number: it is handed the figures and nothing else, so a
 * figure that is not in the set cannot appear in the prose. A detector that returned only a sentence
 * would make the sentence unfalsifiable.
 *
 * **A finding declares its direction and horizon.** Adverse or favourable, current or forward. The
 * four priority boards are the 2×2 of those two, so a finding lands on exactly one board **by
 * construction** — there is no ranking step that decides, and therefore no step that can decide
 * wrongly. It also makes the suite's balance checkable: a detector set that plants only bad news
 * leaves a board empty, and that is a test rather than a discovery in front of a client.
 *
 * **A finding carries a fingerprint.** Two runs over the same period that find the same thing produce
 * the same fingerprint, so a brief can dedupe without comparing prose. The fingerprint deliberately
 * excludes the values: a variance that moved from £0.7m to £0.8m is the same finding, and a product
 * that reports it twice is one nobody reads twice.
 *
 * **A finding carries a typed action, as a route.** Explain, propose, or run a scenario — never post.
 * The action ladder stops short of the ledger on purpose, and it stops here rather than in the surface,
 * because a capability the engine cannot express is one no screen can accidentally offer.
 *
 * ## What the detectors do not do
 *
 * They do not rank against each other. Priority is per finding, from the materiality policy, and the
 * boards sort within themselves — so "the top three things" is a question about a board, not about the
 * suite. A global ranking across twelve heterogeneous rules would be a number with no owner.
 */

import type { FiscalMonth, SegmentCode } from '@kestrel/model';
import {
  ACTUAL_VERSION,
  IC_MATERIALITY_MINOR,
  SEGMENTS,
  addMonths,
  closeCompleteness,
  consolidate,
  entity,
  mappingSetFor,
  monthScope,
  priorYearScope,
  segment as segmentSpec,
  tradingEntities,
} from '@kestrel/model';
import type { World } from '@kestrel/model';
import type {
  ComparatorChoice,
  MaterialityClass,
  MeasureContext,
  Priority,
  Unit,
} from '@kestrel/measures';
import {
  POLICY,
  assessMateriality,
  compareMeasure,
  computeByEntity,
  computeMeasure,
  contextAtScope,
  formatValue,
  priorityOf,
} from '@kestrel/measures';

import { buildBridge, principalDriver } from './bridge.ts';
import { readDriver } from './drivers.ts';
import { activeApprovedForecast, forecastInForce } from './forecast.ts';
import { MINIMUM_CASH, directForecast } from './cash.ts';
import { SCORED_MEASURES, detectBias } from './quality.ts';

/** Global controls are only meaningful when the context can read the whole unfiltered group. */
function hasUnfilteredGroupScope(ctx: MeasureContext): boolean {
  if (ctx.segmentId !== undefined || ctx.costCentreId !== undefined) return false;
  const visible = new Set(ctx.entityIds);
  return tradingEntities().every((candidate) => visible.has(candidate.id));
}

// ---------------------------------------------------------------------------
// What a finding is
// ---------------------------------------------------------------------------

/** Adverse or favourable — from the measure's polarity, never from the arithmetic sign. */
export type FindingDirection = 'adverse' | 'favourable';

/**
 * Has it happened, or is it going to?
 *
 * The axis the client's four boards turn on and the one a variance report does not have. A margin
 * that already fell is a different conversation from a contractor rate that will keep costing more:
 * the first needs explaining and the second needs deciding.
 */
export type FindingHorizon = 'current' | 'forward';

/**
 * What a finding lets a reader do next.
 *
 * A closed set, and it stops at `run_scenario`. Nothing here writes to a ledger, and nothing here
 * changes an approved figure — the ladder is explain, propose, model, and then a person. A product that
 * offers to post the adjustment is a product whose every other number needs re-auditing.
 */
export type ActionKind =
  /** Open the surface that owns the variance, with the commentary and the drill. */
  | 'expand_commentary'
  /** Open the forecast's driver panel at the assumption in question. */
  | 'open_forecast_drivers'
  /** Model it. A proposal, held against the approved version rather than replacing it. */
  | 'run_scenario'
  /** Open the reconciliation that failed. */
  | 'open_reconciliation'
  /** Open close readiness. */
  | 'open_close'
  /** Open the load and vintage register. */
  | 'open_vintages'
  /** Open the mapping set, at the codes it could not place. */
  | 'open_mapping';

export interface FindingAction {
  readonly kind: ActionKind;
  readonly label: string;
  /** A route into the surface that owns it. The engine names the destination; the surface renders it. */
  readonly href: string;
  /** Who it goes to. An action with no owner is a conversation with one end. */
  readonly owner: string;
}

/** One figure behind a finding. The commentary may use these and nothing else. */
export interface FindingFigure {
  readonly label: string;
  readonly value: number | null;
  readonly unit: Unit;
}

export interface Finding {
  readonly detectorId: string;
  /** A short headline, written from the figures rather than from a template with a number dropped in. */
  readonly title: string;
  /** Why it fired, in a sentence a reader can check against the figures. */
  readonly statement: string;
  readonly direction: FindingDirection;
  readonly horizon: FindingHorizon;
  readonly priority: Priority;
  /** The closed set. Everything the narration is allowed to say a number about. */
  readonly figures: readonly FindingFigure[];
  readonly action: FindingAction;
  /**
   * Stable across runs and independent of the values, so a brief can dedupe on identity rather than on
   * prose. Includes the period and the comparator, because the same rule over a different window is a
   * different finding.
   */
  readonly fingerprint: string;
  readonly entityId?: string;
  readonly segmentId?: SegmentCode;
  /** Which planted condition this is, so a reader can get from a board item to the seed line. */
  readonly plantedCondition: number;
  /** The materiality test it cleared, in the policy's own words. Absent where the rule is not a variance. */
  readonly materiality?: string;
  /** Where a figure in the set is not yet governed. Disclosed on the finding, not in a footnote. */
  readonly caveat?: string;
  /**
   * What caused it, in a few words. **Optional, and deliberately absent where the rule has no answer.**
   *
   * The review asked every board item to carry *finding, driver, £ impact, owner and next action*. Four
   * of those a detector has always known. The driver is the one that was buried in the statement, where a
   * reader had to mine a paragraph for it.
   *
   * It stays optional because filling it in for every rule would mean inventing one. An intercompany
   * break has two sides and no driver; a restatement's driver is the restatement. A field that is always
   * populated is a field a reader stops reading, and a plausible guess in this slot is worse than a gap —
   * it is the product asserting a cause, which is the one thing it must not do.
   */
  readonly driver?: string;
  /**
   * The single number this finding is worth, chosen by the rule that knows.
   *
   * Not derivable from `figures`: the largest figure in the set is usually the base rather than the
   * exposure — a margin finding's biggest number is the segment's revenue, and the answer to "how much is
   * this worth" is the gross profit at stake. Picking it in the detector is the only place the difference
   * is known.
   */
  readonly impact?: FindingFigure;
}

/**
 * What a detector needs.
 *
 * The world as well as the measure context, because a third of these rules are not about a variance at
 * all: an unmapped account, an unclosed ledger and a restatement live in the register and the mapping
 * set. A product that can only detect variances cannot detect the reasons a variance is not the
 * problem, which is F5's point about what a real pilot hits in week one.
 */
export interface DetectorContext {
  readonly world: World;
  readonly ctx: MeasureContext;
  /** The comparator the boards are being read against. Changing it re-partitions them. */
  readonly comparator: ComparatorChoice;
}

export interface DetectorDefinition {
  readonly id: string;
  readonly label: string;
  readonly direction: FindingDirection;
  readonly horizon: FindingHorizon;
  /** The planted condition it exists to find, so the suite's coverage is checkable. */
  readonly plantedCondition: number;
  /** The question it answers, in the words a user would ask it. */
  readonly question: string;
  readonly run: (dctx: DetectorContext) => Finding[];
}

// ---------------------------------------------------------------------------
// Shared machinery
// ---------------------------------------------------------------------------

const fingerprint = (
  detectorId: string,
  dctx: DetectorContext,
  parts: readonly string[] = [],
): string =>
  [
    detectorId,
    dctx.ctx.scope.type,
    dctx.ctx.scope.startMonth,
    dctx.ctx.scope.endMonth,
    dctx.comparator.id,
    dctx.comparator.versionId ?? '',
    ...parts,
  ].join(':');

/** Priority where a rule is not a variance against a comparative: how far past its own floor it is. */
function priorityFromMultiple(multiple: number): Priority {
  if (multiple >= 3) return 'high';
  if (multiple >= 1.5) return 'medium';
  return 'low';
}

/** The months in the closing quarter of a scope, for the rules that look for a run. */
function closingQuarter(endMonth: FiscalMonth): FiscalMonth[] {
  return [addMonths(endMonth, -2), addMonths(endMonth, -1), endMonth];
}

// ---------------------------------------------------------------------------
// 1 — revenue ahead of the forecast in force
// ---------------------------------------------------------------------------

const revenueAheadOfForecast: DetectorDefinition = {
  id: 'revenue_ahead_of_forecast',
  label: 'Revenue ahead of forecast',
  direction: 'favourable',
  horizon: 'current',
  plantedCondition: 1,
  question: 'Are we ahead of the plan, and on what?',
  run: (dctx) => {
    // The comparator the reader chose, not a basis this rule picked for itself. "Revenue is ahead" is
    // meaningless without "of what", and a rule that always answers "of the forecast" makes the
    // comparator selector decorative — changing it would reorder one list rather than re-partition the
    // boards, which is exactly the failure the selector exists to avoid.
    //
    // It also gets the trend right for free: a fitted expectation is not a plan anybody committed to, so
    // materiality refuses it and this rule goes quiet without needing to know why.
    const choice = dctx.comparator;
    const comparison = compareMeasure('revenue', dctx.ctx, choice);
    const verdict = assessMateriality(comparison, 'pl');
    if (!verdict.material || comparison.favourable !== true) return [];

    // `movement` on a currency measure is the *relative* change — `deltaUnitFor('currency')` is
    // 'percent' — so formatting it as money prints £0.00 for a £0.7m variance. The first version of this
    // detector did exactly that, and the figure was wrong in the one place a reader looks first. The
    // money variance is the subtraction, and it is done here rather than trusted from a field whose unit
    // says what it is.
    const variance =
      comparison.current.value === null || comparison.comparativeValue === null
        ? null
        : comparison.current.value - comparison.comparativeValue;
    if (variance === null) return [];

    // The bridge is what turns "ahead" into "ahead on volume", and it is computed rather than
    // asserted: the bar that dominates is read off a decomposition that sums to the total.
    const bridge = buildBridge({ measureId: 'revenue', ctx: dctx.ctx, comparator: choice });
    const principal = principalDriver(bridge);
    const basis = comparison.comparator.label;

    return [
      {
        detectorId: revenueAheadOfForecast.id,
        title: `Revenue ${formatValue(Math.abs(variance), 'currency')} ahead of ${basis.toLowerCase()}`,
        statement:
          `Revenue of ${formatValue(comparison.current.value, 'currency')} is ` +
          `${formatValue(Math.abs(variance), 'currency')} ahead of ${basis.toLowerCase()} ` +
          `(${comparison.comparator.basis}), ` +
          `${formatValue(comparison.movement, comparison.movementUnit)} in relative terms` +
          (principal === undefined
            ? '.'
            : `, and ${principal.label.toLowerCase()} is the largest single component of the difference at ` +
              `${formatValue(Math.abs(principal.value), 'currency')}.`),
        direction: 'favourable',
        horizon: 'current',
        priority: priorityOf(comparison, 'pl'),
        driver:
          principal === undefined
            ? 'No single component dominates the difference'
            : `${principal.label}, the largest single component`,
        impact: { label: 'Ahead by', value: variance, unit: 'currency' },
        figures: [
          { label: 'Revenue', value: comparison.current.value, unit: 'currency' },
          { label: basis, value: comparison.comparativeValue, unit: 'currency' },
          { label: 'Variance', value: variance, unit: 'currency' },
          {
            label: 'Variance, relative',
            value: comparison.movement,
            unit: comparison.movementUnit,
          },
          ...(principal === undefined
            ? []
            : [{ label: principal.label, value: principal.value, unit: 'currency' as Unit }]),
        ],
        action: {
          kind: 'expand_commentary',
          label: 'Open revenue commentary and evidence',
          href:
            `/app/commentary?focus=section-commentary&measure=revenue&month=${dctx.ctx.scope.endMonth}` +
            `&comparator=${choice.id}` +
            (choice.versionId === undefined ? '' : `&version=${choice.versionId}`),
          owner: 'Commercial Director',
        },
        fingerprint: fingerprint(revenueAheadOfForecast.id, dctx),
        plantedCondition: 1,
        materiality: verdict.reason,
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// 2 — a segment's margin behind the forecast
// ---------------------------------------------------------------------------

const segmentMarginBehindForecast: DetectorDefinition = {
  id: 'segment_margin_behind_forecast',
  label: 'Adverse segment margin variance',
  direction: 'adverse',
  horizon: 'current',
  plantedCondition: 2,
  question: 'Which part of the business is losing margin against the plan?',
  run: (dctx) => {
    const choice = dctx.comparator;
    const findings: Finding[] = [];

    for (const spec of SEGMENTS.filter(
      (candidate) => dctx.ctx.segmentId === undefined || candidate.code === dctx.ctx.segmentId,
    )) {
      const ctx: MeasureContext = { ...dctx.ctx, segmentId: spec.code };
      const comparison = compareMeasure('gross_margin', ctx, choice);
      // A margin is a percentage, so only the relative test applies — which is correct here and worth
      // saying: a 3-point fall on a large segment and on a small one are equally wrong per pound sold,
      // and the money at stake is carried as its own figure rather than smuggled into the threshold.
      const verdict = assessMateriality(comparison, 'pl');
      if (!verdict.material || comparison.favourable !== false) continue;

      const basis = comparison.comparator.label;
      const revenue = computeMeasure('revenue', ctx).value;
      // The movement arrives in basis points, because that is the unit the measure layer names for a
      // change in a percentage. Converting to a rate here rather than assuming points is the difference
      // between £250k of gross profit at stake and £25m of it.
      const asRate = (comparison.movement ?? 0) / 10_000;
      const atStake = revenue === null ? null : revenue * asRate;

      findings.push({
        detectorId: segmentMarginBehindForecast.id,
        title:
          `${spec.label} margin ${formatValue(Math.abs(comparison.movement ?? 0), 'bps')} ` +
          `behind ${basis.toLowerCase()}`,
        statement:
          `${spec.label} gross margin of ${formatValue(comparison.current.value, 'percent')} is ` +
          `${formatValue(Math.abs(comparison.movement ?? 0), 'bps')} behind ${basis.toLowerCase()}` +
          (atStake === null
            ? '.'
            : `, which is ${formatValue(Math.abs(atStake), 'currency')} of gross profit on the segment's ` +
              `${formatValue(revenue, 'currency')} of revenue.`),
        direction: 'adverse',
        horizon: 'current',
        priority: priorityOf(comparison, 'pl'),
        driver: `Cost to serve on ${spec.label.toLowerCase()}, not price`,
        impact: { label: 'Gross profit at stake', value: atStake, unit: 'currency' },
        figures: [
          { label: `${spec.label} gross margin`, value: comparison.current.value, unit: 'percent' },
          { label: `${basis} margin`, value: comparison.comparativeValue, unit: 'percent' },
          { label: 'Variance', value: comparison.movement, unit: comparison.movementUnit },
          { label: `${spec.label} revenue`, value: revenue, unit: 'currency' },
          { label: 'Gross profit at stake', value: atStake, unit: 'currency' },
        ],
        action: {
          kind: 'expand_commentary',
          label: `Open ${spec.label} commentary and evidence`,
          href:
            `/app/commentary?focus=section-commentary&measure=gross_margin` +
            `&month=${dctx.ctx.scope.endMonth}&segment=${spec.code}&comparator=${choice.id}`,
          owner: 'Operations Director',
        },
        fingerprint: fingerprint(segmentMarginBehindForecast.id, dctx, [spec.code]),
        segmentId: spec.code,
        plantedCondition: 2,
        materiality: verdict.reason,
      });
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// 3 — a driver running above its assumption, three months in a row
// ---------------------------------------------------------------------------

/** How many consecutive months a driver must run above assumption before it is a run rather than a month. */
export const RUN_RATE_MONTHS = 3;

const driverAboveAssumption: DetectorDefinition = {
  id: 'driver_above_assumption',
  label: 'Driver running above assumption',
  direction: 'adverse',
  horizon: 'forward',
  plantedCondition: 3,
  question: 'Is a cost running above what the forecast assumes, and for how long?',
  run: (dctx) => {
    const forecast = activeApprovedForecast();
    const months = closingQuarter(dctx.ctx.scope.endMonth);

    // Each month against the forecast that was in force *then*, not against today's version. Comparing
    // the closing quarter to v6 compares May and June to themselves — v6's actuals run to June, so inside
    // its own cut-off it holds the actual and the gap is zero by construction. The first version of this
    // rule did that, found a run of one, and stayed silent on a condition that is in the data three months
    // running. A run that survives a re-forecast is the stronger finding, not the weaker one.
    //
    // Both sides come from the driver graph rather than from two different places, so the comparison
    // cannot be between two definitions of the same word.
    const pairs = months.map((month) => {
      const scope = monthScope(month);
      const inForce = forecastInForce(month);
      const actual = readDriver('subcontract_rate', {
        ...contextAtScope(dctx.ctx, scope),
        scenario: 'ACTUAL',
        versionId: ACTUAL_VERSION,
      }).value;
      const assumed =
        inForce === undefined
          ? null
          : readDriver('subcontract_rate', {
              ...contextAtScope(dctx.ctx, scope),
              scenario: 'FORECAST',
              versionId: inForce.id,
            }).value;
      return { month, actual, assumed, versionId: inForce?.id ?? null };
    });

    if (pairs.some((p) => p.actual === null || p.assumed === null)) return [];
    const above = pairs.filter((p) => (p.actual ?? 0) > (p.assumed ?? 0));
    if (above.length < RUN_RATE_MONTHS) return [];

    const latest = pairs[pairs.length - 1];
    const actual = latest?.actual ?? 0;
    const assumed = latest?.assumed ?? 0;
    const gap = assumed === 0 ? 0 : (actual - assumed) / assumed;

    // The size test is the **money the gap costs**, not the gap itself. A rate is pounds per hour and its
    // gap is pennies, so an absolute test on the rate is meaningless, and a relative test on it answers a
    // question about percentages rather than about the business.
    //
    // And it is tested at the **run rate**, not at one month. This is a forward finding: what makes it one
    // is that it continues until somebody changes the assumption, so its size is what it costs over the
    // year it continues for. Judging a run-rate item on a single month's cost understates it by twelve and
    // puts the thing that will cost half a million below the floor — which is what happened here.
    const anchorScope = monthScope(dctx.ctx.scope.endMonth);
    const anchorCtx: MeasureContext = {
      ...dctx.ctx,
      scope: anchorScope,
      ...(dctx.ctx.lens === 'constant' ? { comparativeScope: priorYearScope(anchorScope) } : {}),
    };
    const hours = computeMeasure('subcontract_hours', anchorCtx).value;
    const monthlyCost = hours === null ? null : hours * (actual - assumed);
    const annualCost = monthlyCost === null ? null : monthlyCost * 12;
    if (annualCost === null || annualCost < POLICY.thresholds.pl.absoluteMinor) return [];

    return [
      {
        detectorId: driverAboveAssumption.id,
        title: `Subcontract rate above assumption for ${above.length} months`,
        statement:
          `The subcontract rate paid is ${formatValue(actual, 'rate')} against ${formatValue(assumed, 'rate')} ` +
          `assumed in ${forecast.label} — ${(gap * 100).toFixed(1)}% above, and above the forecast in force ` +
          `in each of the last ${above.length} months (${[...new Set(pairs.map((p) => p.versionId))].filter(Boolean).join(', ')})` +
          (monthlyCost === null
            ? '.'
            : `, costing ${formatValue(monthlyCost, 'currency')} a month at current hours — ` +
              `${formatValue(annualCost, 'currency')} a year if it runs. A run of ${above.length} months ` +
              `is what makes this a forward item rather than a variance: it continues until somebody ` +
              `changes the assumption, which is why it is measured at the run rate and not at one month.`),
        direction: 'adverse',
        horizon: 'forward',
        priority: priorityFromMultiple(annualCost / POLICY.thresholds.pl.absoluteMinor),
        driver: `The rate paid is running above the assumption in ${forecast.label}`,
        impact: { label: 'Cost a year if it runs', value: annualCost, unit: 'currency' },
        figures: [
          { label: 'Rate paid', value: actual, unit: 'rate' },
          { label: `${forecast.label} assumption`, value: assumed, unit: 'rate' },
          { label: 'Subcontract hours', value: hours, unit: 'hours' },
          { label: 'Cost of the gap, monthly', value: monthlyCost, unit: 'currency' },
          { label: 'Cost of the gap, annualised', value: annualCost, unit: 'currency' },
          { label: 'Months above assumption', value: above.length, unit: 'count' },
        ],
        action: {
          kind: 'open_forecast_drivers',
          label: 'Open the subcontract rate assumption',
          href:
            `/app/forecast?focus=section-drivers&month=${dctx.ctx.scope.endMonth}` +
            `&driver=subcontract_rate&version=${forecast.id}`,
          owner: 'Operations Director',
        },
        fingerprint: fingerprint(driverAboveAssumption.id, dctx, ['subcontract_rate']),
        plantedCondition: 3,
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// 4 — currency flattering or flattening the reported growth
// ---------------------------------------------------------------------------

const currencyDistortsGrowth: DetectorDefinition = {
  id: 'currency_distorts_growth',
  label: 'Underlying growth ahead of reported',
  direction: 'favourable',
  horizon: 'current',
  plantedCondition: 4,
  question: 'How much of the growth is the business, and how much is the exchange rate?',
  run: (dctx) => {
    const comparativeScope = priorYearScope(dctx.ctx.scope);
    const reported = computeMeasure('revenue', { ...dctx.ctx, lens: 'reported' }).value;
    const constant = computeMeasure('revenue', {
      ...dctx.ctx,
      lens: 'constant',
      comparativeScope,
    }).value;
    const priorYear = computeMeasure('revenue', {
      ...dctx.ctx,
      lens: 'reported',
      scope: comparativeScope,
    }).value;
    if (reported === null || constant === null || priorYear === null || priorYear === 0) return [];

    // The currency effect is the difference between the two lenses on the *same* period, which is the
    // only definition under which reported and constant differ by exactly the translation.
    const fxEffect = constant - reported;
    // Judged against the profit-and-loss floor, not a threshold of its own. The euro moves a little
    // every month; what makes this a finding is that the movement is worth more than the policy's floor.
    if (Math.abs(fxEffect) < POLICY.thresholds.pl.absoluteMinor) return [];
    // Only the favourable direction: currency hiding growth is an item, currency flattering it is a
    // different finding with a different owner, and this detector does not pretend to be both.
    if (fxEffect <= 0) return [];

    const reportedGrowth = (reported - priorYear) / priorYear;
    const constantGrowth = (constant - priorYear) / priorYear;

    return [
      {
        detectorId: currencyDistortsGrowth.id,
        title: `Underlying revenue growth ${formatValue((constantGrowth - reportedGrowth) * 10_000, 'bps')} ahead of reported`,
        statement:
          `Revenue grew ${formatValue(reportedGrowth, 'percent')} as reported and ` +
          `${formatValue(constantGrowth, 'percent')} at last year's rates, so currency cost ` +
          `${formatValue(fxEffect, 'currency')} of the reported figure. The trading performance is better ` +
          `than the reported number shows, and the difference is translation rather than anything the ` +
          `business did.`,
        direction: 'favourable',
        horizon: 'current',
        priority: priorityFromMultiple(Math.abs(fxEffect) / POLICY.thresholds.pl.absoluteMinor),
        driver: 'Currency translation, not trading',
        impact: { label: 'Currency effect', value: fxEffect, unit: 'currency' },
        figures: [
          { label: 'Revenue, reported', value: reported, unit: 'currency' },
          { label: 'Revenue, constant currency', value: constant, unit: 'currency' },
          { label: 'Currency effect', value: fxEffect, unit: 'currency' },
          { label: 'Growth, reported', value: reportedGrowth, unit: 'percent' },
          { label: 'Growth, constant currency', value: constantGrowth, unit: 'percent' },
        ],
        action: {
          kind: 'expand_commentary',
          label: 'Open revenue commentary and evidence',
          href:
            `/app/commentary?focus=section-commentary&measure=revenue&month=${dctx.ctx.scope.endMonth}` +
            '&comparator=prior_year&lens=constant',
          owner: 'Group Treasurer',
        },
        fingerprint: fingerprint(currencyDistortsGrowth.id, dctx),
        plantedCondition: 4,
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// 5 — collections slipping at one entity
// ---------------------------------------------------------------------------

/**
 * How many days an entity has to slip **beyond the group's own movement** to be a finding.
 *
 * Measured against the group rather than against the entity's own history, and that is the whole design
 * of this rule. Days sales outstanding moves with the seasonal shape of revenue, so every entity's
 * figure drifts a few days every quarter and a rule with an absolute threshold either fires on all of
 * them or is tuned until it happens to fire on one. What is findable is an entity slipping *while the
 * others did not*, which needs no tuning and survives a change to the seasonality.
 */
export const DSO_SLIP_DAYS = 3;

const collectionsSlipping: DetectorDefinition = {
  id: 'collections_slipping',
  label: 'Collections slipping',
  direction: 'adverse',
  horizon: 'current',
  plantedCondition: 5,
  question: 'Is anybody collecting more slowly than the rest of the group?',
  run: (dctx) => {
    const quarter = closingQuarter(dctx.ctx.scope.endMonth);
    const from = quarter[0];
    if (from === undefined) return [];
    const fromScope = monthScope(addMonths(from, -1));
    const toScope = monthScope(dctx.ctx.scope.endMonth);

    const groupFrom = computeMeasure('dso', contextAtScope(dctx.ctx, fromScope)).value;
    const groupTo = computeMeasure('dso', contextAtScope(dctx.ctx, toScope)).value;
    if (groupFrom === null || groupTo === null) return [];
    const groupMove = groupTo - groupFrom;

    const before = computeByEntity('dso', contextAtScope(dctx.ctx, fromScope));
    const after = computeByEntity('dso', contextAtScope(dctx.ctx, toScope));

    const findings: Finding[] = [];
    for (const [entityId, current] of after) {
      const previous = before.get(entityId)?.value;
      if (previous === null || previous === undefined || current.value === null) continue;
      const move = current.value - previous;
      const excess = move - groupMove;
      if (excess < DSO_SLIP_DAYS) continue;

      const revenue = computeByEntity('revenue', contextAtScope(dctx.ctx, toScope)).get(
        entityId,
      )?.value;
      const days = 30.4;
      const cashTied = revenue === null || revenue === undefined ? null : (revenue * excess) / days;
      const e = entity(entityId);

      findings.push({
        detectorId: collectionsSlipping.id,
        title: `${e.name} collections ${move.toFixed(0)} days slower`,
        statement:
          `Days sales outstanding at ${e.name} moved from ${previous.toFixed(0)} to ` +
          `${current.value.toFixed(0)} days over the quarter, ${excess.toFixed(0)} days more than the ` +
          `group's own ${groupMove.toFixed(0)}-day movement — so this is the entity slipping rather than ` +
          `the seasonal shape of revenue` +
          (cashTied === null
            ? '.'
            : `. The excess is roughly ${formatValue(cashTied, 'currency')} of cash held in receivables.`),
        direction: 'adverse',
        horizon: 'current',
        priority: priorityFromMultiple(excess / DSO_SLIP_DAYS),
        driver: `Collections at ${e.name}`,
        impact: { label: 'Cash held in the excess', value: cashTied, unit: 'currency' },
        figures: [
          { label: `${e.name} DSO, opening`, value: previous, unit: 'days' },
          { label: `${e.name} DSO, closing`, value: current.value, unit: 'days' },
          { label: 'Movement', value: move, unit: 'days' },
          { label: 'Group movement', value: groupMove, unit: 'days' },
          { label: 'Excess over the group', value: excess, unit: 'days' },
          { label: 'Cash held in the excess', value: cashTied, unit: 'currency' },
        ],
        action: {
          kind: 'run_scenario',
          label: 'Model the collections recovery',
          href:
            `/app/scenarios?focus=section-levers&month=${dctx.ctx.scope.endMonth}` +
            `&entity=${entityId}&dsoDays=-10`,
          owner: 'Group Treasurer',
        },
        fingerprint: fingerprint(collectionsSlipping.id, dctx, [entityId]),
        entityId,
        plantedCondition: 5,
      });
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// 6 — the cash forecast under the board's floor
// ---------------------------------------------------------------------------

const cashFloorBreach: DetectorDefinition = {
  id: 'cash_floor_breach',
  label: 'Cash below the board floor',
  direction: 'adverse',
  horizon: 'forward',
  plantedCondition: 6,
  question: 'Do we go under the minimum cash the board set, and in which week?',
  run: (dctx) => {
    const forecast = directForecast(dctx.ctx);
    const breach = forecast.breach;
    if (breach === undefined) return [];
    const week = forecast.weeks[breach.index - 1];

    return [
      {
        detectorId: cashFloorBreach.id,
        title:
          `Cash breaches the floor by ${formatValue(breach.shortfall, 'currency')} ` +
          `in week ${breach.index}`,
        statement:
          `The 13-week forecast first breaches the floor in week ${breach.index}, closing at ` +
          `${formatValue(week?.closing ?? null, 'currency')}, ` +
          `${formatValue(breach.shortfall, 'currency')} under the ` +
          `${formatValue(MINIMUM_CASH.amountMinor, 'currency')} floor set in ${MINIMUM_CASH.owner}. ` +
          `Its low point is ${formatValue(forecast.low.amount, 'currency')} in week ${forecast.low.index}. ` +
          `It recovers by the end of the horizon, so this is a week to fund rather than a solvency ` +
          `question — the dividend and a supplier run land together.`,
        direction: 'adverse',
        horizon: 'forward',
        priority: priorityFromMultiple(
          breach.shortfall / (MINIMUM_CASH.amountMinor * POLICY.thresholds.cf.relative),
        ),
        driver: 'The dividend and a supplier run landing in the same week',
        impact: { label: 'Shortfall against the floor', value: breach.shortfall, unit: 'currency' },
        figures: [
          { label: 'Opening cash', value: forecast.opening, unit: 'currency' },
          { label: `Week ${breach.index} closing`, value: week?.closing ?? null, unit: 'currency' },
          { label: 'Board floor', value: MINIMUM_CASH.amountMinor, unit: 'currency' },
          { label: 'Shortfall', value: breach.shortfall, unit: 'currency' },
          {
            label: `Low point · week ${forecast.low.index}`,
            value: forecast.low.amount,
            unit: 'currency',
          },
          {
            label: `Week ${breach.index} payments`,
            value: week?.payments ?? null,
            unit: 'currency',
          },
          {
            label: `Week ${breach.index} receipts`,
            value: week?.receipts ?? null,
            unit: 'currency',
          },
        ],
        action: {
          kind: 'run_scenario',
          label: 'Stress the cash floor',
          href:
            `/app/scenarios?focus=section-headroom&month=${dctx.ctx.scope.endMonth}` +
            '&dsoDays=10',
          owner: 'Group Treasurer',
        },
        fingerprint: fingerprint(cashFloorBreach.id, dctx),
        plantedCondition: 6,
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// 7 — ledger accounts nothing could map
// ---------------------------------------------------------------------------

const unmappedAccounts: DetectorDefinition = {
  id: 'unmapped_accounts',
  label: 'Unmapped ledger accounts',
  direction: 'adverse',
  horizon: 'current',
  plantedCondition: 7,
  question: 'Is anything in the ledger not reaching the reported figures?',
  run: (dctx) => {
    const set = mappingSetFor(dctx.world.mappingSets, dctx.ctx.scope.endMonth);
    if (
      set === undefined ||
      dctx.ctx.segmentId !== undefined ||
      dctx.ctx.costCentreId !== undefined
    ) {
      return [];
    }
    const visibleEntities = new Set(dctx.ctx.entityIds);
    const unmapped = set.unmapped.filter((account) => visibleEntities.has(account.entityId));
    if (unmapped.length === 0) return [];

    const total = unmapped.reduce((sum, u) => sum + u.amountMinor, 0);
    if (Math.abs(total) < POLICY.thresholds.pl.absoluteMinor) return [];

    return [
      {
        detectorId: unmappedAccounts.id,
        title: `${unmapped.length} unmapped accounts, ${formatValue(total, 'currency')} at stake`,
        statement:
          `${unmapped.length} ledger accounts appeared in the load with nothing in mapping set ` +
          `${set.id} to place them, carrying ${formatValue(total, 'currency')}: ` +
          unmapped.map((u) => `${u.sourceCode} ${u.sourceLabel}`).join(', ') +
          `. Until they are mapped that value is outside the reported profit and loss, so the figures ` +
          `are complete against the mapping and not against the ledger — which is the difference this ` +
          `line exists to show.`,
        direction: 'adverse',
        horizon: 'current',
        priority: priorityFromMultiple(Math.abs(total) / POLICY.thresholds.pl.absoluteMinor),
        driver: 'Ledger codes arriving with nothing in the mapping set to place them',
        impact: { label: 'Value at stake', value: total, unit: 'currency' },
        figures: [
          { label: 'Accounts unmapped', value: unmapped.length, unit: 'count' },
          { label: 'Value at stake', value: total, unit: 'currency' },
          ...unmapped.map((u) => ({
            label: `${u.sourceCode} ${u.sourceLabel}`,
            value: u.amountMinor,
            unit: 'currency' as Unit,
          })),
        ],
        action: {
          kind: 'open_mapping',
          label: 'Open the mapping set',
          href: `/app/controls?focus=section-mappings&set=${set.id}`,
          owner: set.owner,
        },
        fingerprint: fingerprint(unmappedAccounts.id, dctx, [set.id]),
        plantedCondition: 7,
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// 8 — the intercompany reconciliation that fails
// ---------------------------------------------------------------------------

const intercompanyMismatch: DetectorDefinition = {
  id: 'intercompany_mismatch',
  label: 'Intercompany not reconciled',
  direction: 'adverse',
  horizon: 'current',
  plantedCondition: 8,
  question: 'Do both sides of every intercompany transaction agree?',
  run: (dctx) => {
    if (!hasUnfilteredGroupScope(dctx.ctx)) return [];
    const c = consolidate({
      store: dctx.ctx.store,
      rates: dctx.ctx.rates,
      scope: dctx.ctx.scope,
      scenario: dctx.ctx.scenario,
      versionId: dctx.ctx.versionId,
      lens: dctx.ctx.lens,
      entityIds: dctx.ctx.entityIds,
    });
    const trading = c.unreconciled.trading;
    if (Math.abs(trading) <= IC_MATERIALITY_MINOR) return [];

    return [
      {
        detectorId: intercompanyMismatch.id,
        title: `Intercompany out by ${formatValue(Math.abs(trading), 'currency')}`,
        statement:
          `Group intercompany revenue and the matching intercompany cost differ by ` +
          `${formatValue(Math.abs(trading), 'currency')}, so one side of a transaction has been recorded ` +
          `and the other has not. The consolidation reports the difference rather than forcing the two ` +
          `sides to agree — a reconciliation that always balances is one that has stopped being a check.`,
        direction: 'adverse',
        horizon: 'current',
        priority: 'high',
        impact: { label: 'Out by', value: trading, unit: 'currency' },
        figures: [
          { label: 'Unreconciled, profit and loss', value: trading, unit: 'currency' },
          { label: 'Unreconciled, balance sheet', value: c.unreconciled.balance, unit: 'currency' },
          { label: 'Matching threshold', value: IC_MATERIALITY_MINOR, unit: 'currency' },
        ],
        action: {
          kind: 'open_reconciliation',
          label: 'Open the intercompany reconciliation',
          href:
            `/app/controls?focus=section-checks&check=intercompany_trading` +
            `&month=${dctx.ctx.scope.endMonth}`,
          owner: 'Group Financial Controller',
        },
        fingerprint: fingerprint(intercompanyMismatch.id, dctx),
        plantedCondition: 8,
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// 9 — a measure the forecast is habitually wrong about
// ---------------------------------------------------------------------------

const forecastBias: DetectorDefinition = {
  id: 'forecast_bias',
  label: 'Forecast bias',
  direction: 'adverse',
  horizon: 'forward',
  plantedCondition: 9,
  question: 'Is there something we get wrong the same way every time?',
  run: (dctx) => {
    const findings: Finding[] = [];

    for (const measureId of SCORED_MEASURES) {
      const bias = detectBias(measureId, dctx.ctx);
      if (!bias.biased) continue;

      const label = computeMeasure(measureId, dctx.ctx).label;
      const direction = bias.direction === 'under' ? 'under-called' : 'over-called';

      findings.push({
        detectorId: forecastBias.id,
        title: `${label} ${direction} in ${bias.consecutiveVersions} consecutive forecasts`,
        statement:
          `${label} has been ${direction} in each of the last ${bias.consecutiveVersions} forecast ` +
          `versions of ${bias.versionsScored} scored, by ` +
          `${formatValue(Math.abs(bias.meanSignedError), 'percent')} on average. A miss in one direction ` +
          `repeatedly is an assumption to change rather than a variance to explain — and the misses ` +
          `shrink each time, which is why no single version's variance looked like a pattern.`,
        direction: 'adverse',
        horizon: 'forward',
        priority: priorityFromMultiple(
          Math.abs(bias.meanSignedError) / POLICY.thresholds.pl.relative,
        ),
        driver: `The assumption behind ${label.toLowerCase()}, not one version's variance`,
        impact: {
          label: 'Mean error across the run',
          value: bias.meanSignedError,
          unit: 'percent',
        },
        figures: [
          { label: 'Mean error', value: bias.meanSignedError, unit: 'percent' },
          { label: 'Consecutive versions', value: bias.consecutiveVersions, unit: 'count' },
          { label: 'Versions scored', value: bias.versionsScored, unit: 'count' },
          ...bias.byVersion.map((v) => ({
            label: `${v.versionId} error`,
            value: v.meanSignedError,
            unit: 'percent' as Unit,
          })),
        ],
        action: {
          kind: 'open_forecast_drivers',
          label: 'Open forecast quality',
          href:
            `/app/quality?focus=section-bias&month=${dctx.ctx.scope.endMonth}` +
            `&measure=${measureId}`,
          owner: 'Group FP&A',
        },
        fingerprint: fingerprint(forecastBias.id, dctx, [measureId]),
        plantedCondition: 9,
      });
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// 10 — a ledger submitted and not closed
// ---------------------------------------------------------------------------

const closeIncomplete: DetectorDefinition = {
  id: 'close_incomplete',
  label: 'Close not complete',
  direction: 'adverse',
  horizon: 'current',
  plantedCondition: 10,
  question: 'Is the figure on the front page final?',
  run: (dctx) => {
    if (dctx.ctx.segmentId !== undefined || dctx.ctx.costCentreId !== undefined) return [];
    const month = dctx.ctx.scope.endMonth;
    const visibleEntities = new Set(dctx.ctx.entityIds);
    const completeness = closeCompleteness(
      dctx.world.closePositions.filter((position) => visibleEntities.has(position.entityId)),
      month,
    );
    if (completeness.open.length === 0) return [];

    const names = completeness.open.map((p) => entity(p.entityId).name).join(', ');
    const closingScope = monthScope(month);
    const closingCtx: MeasureContext = {
      ...dctx.ctx,
      scope: closingScope,
      ...(dctx.ctx.lens === 'constant' ? { comparativeScope: priorYearScope(closingScope) } : {}),
    };
    const openRevenue = completeness.open.reduce((sum, p) => {
      const value = computeMeasure('revenue', {
        ...closingCtx,
        entityIds: [p.entityId],
      }).value;
      return sum + (value ?? 0);
    }, 0);

    return [
      {
        detectorId: closeIncomplete.id,
        title: `${completeness.open.length} of ${completeness.total} ledgers not closed`,
        statement:
          `${names} has submitted ${month} and not closed it, so ` +
          `${formatValue(openRevenue, 'currency')} of revenue in the closing month may still move. ` +
          `The selected-scope figure is ` +
          `not wrong; it is not final, and nothing in the figure itself says so — which is why this is a ` +
          `board item rather than a footnote.` +
          (completeness.open[0]?.note === undefined ? '' : ` ${completeness.open[0].note}`),
        direction: 'adverse',
        horizon: 'current',
        priority: 'medium',
        driver:
          completeness.open.map((p) => entity(p.entityId).name).join(', ') + ' has not closed',
        impact: { label: 'Revenue not yet closed', value: openRevenue, unit: 'currency' },
        figures: [
          { label: 'Ledgers closed', value: completeness.closed, unit: 'count' },
          { label: 'Ledgers in selected scope', value: completeness.total, unit: 'count' },
          { label: 'Revenue not yet closed', value: openRevenue, unit: 'currency' },
        ],
        action: {
          kind: 'open_close',
          label: 'Open close readiness',
          href: `/app/controls?focus=section-close&month=${month}`,
          owner: completeness.open[0]?.owner ?? 'Group Financial Controller',
        },
        fingerprint: fingerprint(
          closeIncomplete.id,
          dctx,
          completeness.open.map((p) => p.entityId),
        ),
        ...(completeness.open.length === 1 && completeness.open[0] !== undefined
          ? { entityId: completeness.open[0].entityId }
          : {}),
        plantedCondition: 10,
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// 11 — a load that restated a closed month
// ---------------------------------------------------------------------------

const restatementInLoad: DetectorDefinition = {
  id: 'restatement_in_load',
  label: 'A closed month was restated',
  direction: 'adverse',
  horizon: 'current',
  plantedCondition: 11,
  question: 'Has anything I already reported changed since I reported it?',
  run: (dctx) => {
    /* The seeded vintage register records the load, not an entity-attributed restatement relation. Until
       that relation exists, exposing it below full-group scope would disclose global close metadata. */
    if (!hasUnfilteredGroupScope(dctx.ctx)) return [];
    const restatements = dctx.world.register
      .restatements()
      .filter((v) => v.toMonth <= dctx.ctx.scope.endMonth);
    if (restatements.length === 0) return [];

    const findings: Finding[] = [];
    for (const vintage of restatements) {
      const restated = vintage.restatesVintageId;
      const asFiled = computeMeasure('gross_margin', {
        ...contextAtScope(dctx.ctx, monthScope(vintage.toMonth)),
        ...(restated === undefined ? {} : { asOfVintage: restated }),
      }).value;
      const asNow = computeMeasure(
        'gross_margin',
        contextAtScope(dctx.ctx, monthScope(vintage.toMonth)),
      ).value;

      findings.push({
        detectorId: restatementInLoad.id,
        title: `${vintage.toMonth} restated after it was reported`,
        statement:
          `Load ${vintage.id} restates ${vintage.toMonth}, which had already been reported. Gross margin ` +
          `for that month was ${formatValue(asFiled, 'percent')} as filed and is ` +
          `${formatValue(asNow, 'percent')} now. Both are correct — one is the month as it stood when it ` +
          `was signed, and a pack that pins a vintage keeps saying the first while the current view says ` +
          `the second.`,
        direction: 'adverse',
        horizon: 'current',
        priority: 'medium',
        impact: {
          label: 'Gross margin, as filed against now',
          value: asNow === null || asFiled === null ? null : asNow - asFiled,
          unit: 'percent',
        },
        figures: [
          { label: 'Gross margin as filed', value: asFiled, unit: 'percent' },
          { label: 'Gross margin now', value: asNow, unit: 'percent' },
          {
            label: 'Movement',
            value: asFiled === null || asNow === null ? null : (asNow - asFiled) * 10_000,
            unit: 'bps',
          },
        ],
        action: {
          kind: 'open_vintages',
          label: 'Open the load register',
          href: `/app/controls?focus=section-vintages&vintage=${vintage.id}`,
          owner: 'Group Financial Controller',
        },
        fingerprint: fingerprint(restatementInLoad.id, dctx, [vintage.id]),
        plantedCondition: 11,
      });
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// 12 — an operational driver running ahead of the plan
// ---------------------------------------------------------------------------

const pipelineAheadOfAssumption: DetectorDefinition = {
  id: 'pipeline_ahead_of_assumption',
  label: 'Pipeline ahead of assumption',
  direction: 'favourable',
  horizon: 'forward',
  plantedCondition: 12,
  question: 'Is anything running better than the plan assumes, and what is it worth?',
  run: (dctx) => {
    const forecast = activeApprovedForecast();
    const anchorScope = monthScope(dctx.ctx.scope.endMonth);
    const anchorCtx: MeasureContext = {
      ...dctx.ctx,
      scope: anchorScope,
      ...(dctx.ctx.lens === 'constant' ? { comparativeScope: priorYearScope(anchorScope) } : {}),
    };
    const actual = readDriver('pipeline_conversion', {
      ...anchorCtx,
      scenario: 'ACTUAL',
      versionId: ACTUAL_VERSION,
    });
    const assumed = readDriver('pipeline_conversion', {
      ...anchorCtx,
      scenario: 'FORECAST',
      versionId: forecast.id,
    });
    if (actual.value === null || assumed.value === null || assumed.value === 0) return [];

    const gap = (actual.value - assumed.value) / assumed.value;
    if (gap < POLICY.thresholds.operational.relative) return [];

    // What it is worth if it holds: the coverage gap applied to the forecast's own remaining revenue.
    const annualRevenue = computeMeasure('revenue', anchorCtx).value;
    const atStake = annualRevenue === null ? null : annualRevenue * 12 * gap * 0.5;

    return [
      {
        detectorId: pipelineAheadOfAssumption.id,
        title: `Pipeline conversion ${(gap * 100).toFixed(0)}% ahead of assumption`,
        statement:
          `The CRM is converting ${formatValue(actual.value, 'percent')} of weighted pipeline against ` +
          `${formatValue(assumed.value, 'percent')} assumed in ${forecast.label}` +
          (atStake === null
            ? '.'
            : `, worth roughly ${formatValue(atStake, 'currency')} of full-year revenue if the conversion ` +
              `holds.`) +
          ` This is a scenario to run rather than a number to book — the forecast in force does not ` +
          `include it, and the honest action is to model it beside the approved version.`,
        direction: 'favourable',
        horizon: 'forward',
        priority: priorityFromMultiple(gap / POLICY.thresholds.operational.relative),
        driver: `The CRM is converting ahead of the rate ${forecast.label} assumes`,
        impact: { label: 'Full-year revenue at stake', value: atStake, unit: 'currency' },
        figures: [
          { label: 'Pipeline conversion, actual', value: actual.value, unit: 'percent' },
          { label: `${forecast.label} assumption`, value: assumed.value, unit: 'percent' },
          { label: 'Full-year revenue at stake', value: atStake, unit: 'currency' },
        ],
        action: {
          kind: 'run_scenario',
          label: 'Open scenario levers',
          /* Pipeline conversion is a draft observed measure, not one of the bounded scenario levers.
             Land on the real scenario surface without smuggling an ignored `scenario=pipeline` claim
             into the URL. A future governed pipeline lever can make this link more specific. */
          href: `/app/scenarios?focus=section-levers&month=${dctx.ctx.scope.endMonth}`,
          owner: 'Sales Director',
        },
        fingerprint: fingerprint(pipelineAheadOfAssumption.id, dctx, ['pipeline_conversion']),
        plantedCondition: 12,
        // The one draft measure in the catalogue raising the one favourable forward item. Disclosed on
        // the finding rather than in a footnote, because the caveat is the reason the action is "model
        // it" and not "raise the forecast".
        caveat:
          'Pipeline conversion is a draft measure sourced from the CRM’s own weighting, which no one in ' +
          'Finance owns yet. It is admissible as an opportunity to model and not as a forecast input.',
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// The suite
// ---------------------------------------------------------------------------

/**
 * The twelve, in the order of the conditions they find.
 *
 * Held as an array rather than assembled by a registry, so the suite's coverage of the four boards is
 * readable here without running anything — and so a thirteenth detector has to declare its direction and
 * horizon before it can be added.
 */
export const DETECTORS: readonly DetectorDefinition[] = [
  revenueAheadOfForecast,
  segmentMarginBehindForecast,
  driverAboveAssumption,
  currencyDistortsGrowth,
  collectionsSlipping,
  cashFloorBreach,
  unmappedAccounts,
  intercompanyMismatch,
  forecastBias,
  closeIncomplete,
  restatementInLoad,
  pipelineAheadOfAssumption,
];

export function detector(id: string): DetectorDefinition {
  const found = DETECTORS.find((d) => d.id === id);
  if (!found) throw new Error(`Unknown detector: ${id}`);
  return found;
}

/**
 * Run every detector and dedupe.
 *
 * A detector that throws is not allowed to take the board down with it: the surface's job is to show
 * what fired, and one rule failing on an edge case must not blank the other eleven. The failure is
 * carried out as a `DetectorError` rather than swallowed, because a silently missing board item is the
 * worst of the three outcomes.
 */
export interface DetectorError {
  readonly detectorId: string;
  readonly message: string;
}

export interface DetectorRun {
  readonly findings: readonly Finding[];
  readonly errors: readonly DetectorError[];
  /** Findings dropped because an earlier detector produced the same fingerprint. */
  readonly duplicates: number;
}

export function runDetectors(dctx: DetectorContext): DetectorRun {
  const findings: Finding[] = [];
  const errors: DetectorError[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (const definition of DETECTORS) {
    let produced: Finding[];
    try {
      produced = definition.run(dctx);
    } catch (error) {
      errors.push({
        detectorId: definition.id,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    for (const finding of produced) {
      if (seen.has(finding.fingerprint)) {
        duplicates += 1;
        continue;
      }
      seen.add(finding.fingerprint);
      findings.push(finding);
    }
  }

  return { findings, errors, duplicates };
}

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------

/** How many findings reach a brief. Board attention is the scarce resource, not screen space. */
export const TRIAGE_CAP = 6;

const PRIORITY_ORDER: Readonly<Record<Priority, number>> = { high: 0, medium: 1, low: 2 };

export interface Triage {
  readonly kept: readonly Finding[];
  /** How many were dropped, and what they were — reported, never silent. */
  readonly suppressed: readonly Finding[];
  readonly cap: number;
  /** The line a surface prints under a shortened list. */
  readonly note: string;
}

/**
 * Cap what reaches a brief, and say what was left out.
 *
 * The count is the point. A product that quietly shows the top six trains a reader to believe there
 * were six, and the seventh is the one that gets asked about in the meeting. So the suppressed findings
 * are carried out whole rather than counted, and the surface can open them.
 */
export function triage(findings: readonly Finding[], cap: number = TRIAGE_CAP): Triage {
  const ranked = [...findings].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );
  const kept = ranked.slice(0, cap);
  const suppressed = ranked.slice(cap);
  return {
    kept,
    suppressed,
    cap,
    note:
      suppressed.length === 0
        ? `All ${findings.length} findings shown.`
        : `${kept.length} of ${findings.length} shown, ranked by priority. ` +
          `${suppressed.length} below the cut: ${suppressed.map((f) => f.title).join('; ')}.`,
  };
}

/** Which materiality class a measure's findings are judged under. Exported so a surface can say. */
export function classForMeasure(measureId: string): MaterialityClass {
  if (measureId === 'cash' || measureId === 'working_capital') return 'cf';
  return 'pl';
}

/** Every segment code, for a surface that iterates them beside a finding. */
export function segmentLabel(code: SegmentCode): string {
  return segmentSpec(code).label;
}
