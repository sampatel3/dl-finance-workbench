/**
 * Three answers to "where does the year land", and the argument between them.
 *
 * The review's ask on Year to Go: *"clearly distinguish run-rate trajectory from approved forecast and
 * management-adjusted outlook"*, add *"On Track / Ahead / Behind flags and direction of travel"*, show
 * *"the biggest risks and opportunities that could move the expected FY landing"*, and give *"actions
 * required to close the gap where expected FY is behind target"*.
 *
 * ## Why three numbers rather than one
 *
 * A single "expected landing" hides the argument. These three disagree on purpose:
 *
 *   **Run rate** is where the year lands if the business keeps doing exactly what it has done. It
 *   contains no plan at all, which is the point — it is the number nobody can be accused of massaging,
 *   and the one a board reaches for at the moment it stops believing the forecast.
 *
 *   **Approved** is actuals plus the approved forecast. The governed answer, and the only one that ties
 *   to a version somebody signed.
 *
 *   **Management-adjusted** is the approved forecast corrected where a driver has missed in the same
 *   direction for {@link PERSISTENCE_MONTHS} months running.
 *
 * The gap between the first two is the whole question. **An approved forecast above the run rate is a
 * forecast assuming a recovery**, and naming the size of that assumption is worth more than either
 * figure alone — which is where {@link buildOutlook}'s risks come from. They are not a list somebody
 * typed; they are the assumptions the approved plan makes that the actuals do not yet support.
 *
 * ## What "management-adjusted" honestly means here
 *
 * In a real finance function it is a person's judgement: the chief financial officer believes the Q4
 * award lands, or does not. This demo will not invent that. A fabricated executive opinion presented as
 * an outlook would be the one figure on the page nobody could check.
 *
 * So it is derived, and the derivation is stated on the surface: the approved forecast's remaining
 * months carried at the bias the last three months actually delivered, and **only** where the miss ran
 * one way in all three. A single bad month is noise and is left alone. Where nothing is persistent the
 * management column equals the approved one and the page says why — which is the correct answer rather
 * than an empty column.
 */

import type { FiscalCalendar, FiscalMonth, PeriodScope } from '@kestrel/model';
import {
  ACTUAL_VERSION,
  CALENDAR_YEAR,
  addMonths,
  firstMonthOfFiscalYear,
  fiscalYearOf,
  fiscalYearScope,
  formatMonthLong,
  monthScope,
  monthsBetween,
} from '@kestrel/model';
import type { MeasureContext, Unit } from '@kestrel/measures';
import { computeMeasure, contextAtScope, formatValue, measure } from '@kestrel/measures';

import { contributorsFor, type Contributors } from './contributors.ts';
import { DECISION_POLICY, impliedDecisions, type ImpliedDecision } from './decisions.ts';
import { forecastInForce } from './forecast.ts';
import { buildYearToGo, type Trajectory, type YearToGoProjection } from './year-to-go.ts';

/** How many consecutive same-direction months make a miss a bias rather than a month. */
export const PERSISTENCE_MONTHS = 3;

/**
 * The measures the landing is reported on.
 *
 * The review names *"Revenue, Gross Margin, EBITDA, PAT, Cash"*. `net_income` is PAT and was the one
 * missing — a landing page without profit after tax is one a board cannot use.
 */
export const OUTLOOK_MEASURES = ['revenue', 'gross_margin', 'ebitda', 'net_income', 'cash'] as const;

export type OutlookMeasureId = (typeof OUTLOOK_MEASURES)[number];

/** Whether the gap to plan is closing, holding or opening. */
export type DirectionOfTravel = 'improving' | 'holding' | 'deteriorating' | 'unavailable';

export interface Persistence {
  /** True where every one of the last {@link PERSISTENCE_MONTHS} months missed the same way. */
  readonly persistent: boolean;
  /** Actual over forecast across the run, less one. Zero where there is no run. */
  readonly bias: number;
  readonly months: readonly FiscalMonth[];
  /** One line naming the run, or saying why there is not one. */
  readonly statement: string;
}

export interface OutlookLine {
  readonly measureId: OutlookMeasureId;
  readonly label: string;
  readonly unit: Unit;
  readonly actualYtd: number | null;
  readonly monthsElapsed: number;
  readonly monthsRemaining: number;
  /** Actuals carried at the rate they have run. No judgement and no plan. */
  readonly runRate: number | null;
  /** Actuals plus the approved forecast. The governed answer. */
  readonly approved: number | null;
  /** The approved forecast carried at a persistent bias, where one exists. */
  readonly management: number | null;
  readonly persistence: Persistence;
  readonly budget: number | null;
  readonly priorYear: number | null;
  /** Management-adjusted landing against budget, in the measure's own terms or basis points. */
  readonly gapToBudget: number | null;
  readonly gapUnit: Unit;
  readonly favourable: boolean | null;
  readonly trajectory: Trajectory;
  readonly direction: DirectionOfTravel;
  /** Why the direction reads as it does, in one line. */
  readonly directionNote: string;
  /** What the approved forecast assumes over the run rate — the recovery, or the fade. */
  readonly assumedRecovery: number | null;
}

export interface LandingRisk {
  readonly measureId: OutlookMeasureId;
  readonly label: string;
  readonly kind: 'risk' | 'opportunity';
  /** How far the landing moves if the run rate is right and the plan is not. Always positive. */
  readonly exposure: number;
  readonly unit: Unit;
  readonly statement: string;
  /** Who owns the largest contributor to the current gap. */
  readonly owner: string;
  /**
   * Where a recovery would have to come from, in one line.
   *
   * Deliberately **not** a sizing of the exposure above it, and worded so it cannot be read as one. The
   * first cut printed "largest contributor against budget: Service contracts at −£13.7m" directly under
   * a £456k exposure. The two answer different questions — one is the year's variance to budget, the
   * other is the difference between two landings — and stacked under one heading the second reads as
   * though it explained the first. A reader trying to reconcile £13.7m to £456k would conclude the page
   * was broken, and would be right to.
   */
  readonly recoveryFrom?: string;
  readonly contributors?: Contributors;
}

export interface Outlook {
  readonly fiscalYear: number;
  readonly scope: PeriodScope;
  readonly through: FiscalMonth;
  readonly monthsElapsed: number;
  readonly monthsRemaining: number;
  readonly available: boolean;
  readonly unavailableReason?: string;
  readonly projection: YearToGoProjection;
  readonly lines: readonly OutlookLine[];
  /** Ranked by how far they would move the landing, largest first. */
  readonly risks: readonly LandingRisk[];
  /** What to do where the management-adjusted landing is behind budget. */
  readonly actions: readonly ImpliedDecision[];
  /** Why the action list is empty, where it is. */
  readonly noActionBecause?: string;
}

// ---------------------------------------------------------------------------
// Persistence — the only judgement this file is willing to make
// ---------------------------------------------------------------------------

/**
 * Whether a measure has missed the forecast the same way three months running, and by how much.
 *
 * Each month is compared against **the forecast in force then**, not against today's version. Comparing
 * the closing quarter to the current approved forecast compares two of those months to themselves — a
 * version's actuals run to its own cut-off, so inside it the gap is zero by construction and a genuine
 * three-month run reads as a run of one. The detector that looks for the same shape learned this the
 * hard way; the note is repeated here because the mistake is invisible in the output.
 */
export function persistenceFor(measureId: string, ctx: MeasureContext): Persistence {
  const end = ctx.scope.endMonth;
  const window = monthsBetween(addMonths(end, -(PERSISTENCE_MONTHS - 1)), end);

  const pairs = window.map((month) => {
    const scoped = contextAtScope(ctx, monthScope(month));
    const inForce = forecastInForce(month);
    const actual = computeMeasure(measureId, {
      ...scoped,
      scenario: 'ACTUAL',
      versionId: ACTUAL_VERSION,
    }).value;
    const assumed =
      inForce === undefined
        ? null
        : computeMeasure(measureId, {
            ...scoped,
            scenario: inForce.scenario,
            versionId: inForce.id,
          }).value;
    return { month, actual, assumed };
  });

  const complete = pairs.filter(
    (pair): pair is { month: FiscalMonth; actual: number; assumed: number } =>
      pair.actual !== null && pair.assumed !== null,
  );

  const label = measure(measureId).label;
  if (complete.length < PERSISTENCE_MONTHS) {
    return {
      persistent: false,
      bias: 0,
      months: [],
      statement:
        `${label} does not have a comparable forecast in every one of the last ` +
        `${PERSISTENCE_MONTHS} months, so no bias is claimed and the approved forecast is carried as it stands.`,
    };
  }

  const above = complete.filter((pair) => pair.actual > pair.assumed).length;
  const persistent = above === complete.length || above === 0;

  if (!persistent) {
    return {
      persistent: false,
      bias: 0,
      months: complete.map((pair) => pair.month),
      statement:
        `${label} has missed both ways across the last ${PERSISTENCE_MONTHS} months, which is noise ` +
        'rather than a bias. The approved forecast is carried unadjusted.',
    };
  }

  const actualSum = complete.reduce((total, pair) => total + pair.actual, 0);
  const assumedSum = complete.reduce((total, pair) => total + pair.assumed, 0);
  const bias = assumedSum === 0 ? 0 : actualSum / assumedSum - 1;

  return {
    persistent: true,
    bias,
    months: complete.map((pair) => pair.month),
    statement:
      `${label} has run ${formatValue(Math.abs(bias), 'percent')} ` +
      `${bias > 0 ? 'above' : 'below'} the forecast in force in each of ` +
      `${complete.map((pair) => formatMonthLong(pair.month)).join(', ')}. The remaining months are ` +
      'carried at that bias.',
  };
}

// ---------------------------------------------------------------------------
// The three landings
// ---------------------------------------------------------------------------

/** Where in the fiscal year the reporting boundary sits. */
interface YearPosition {
  readonly fiscalYear: number;
  readonly scope: PeriodScope;
  readonly elapsed: number;
  readonly remaining: number;
  readonly total: number;
}

function yearPosition(through: FiscalMonth, calendar: FiscalCalendar): YearPosition {
  const fiscalYear = fiscalYearOf(through, calendar);
  const scope = fiscalYearScope(fiscalYear, calendar);
  const elapsed = monthsBetween(firstMonthOfFiscalYear(fiscalYear, calendar), through).length;
  const total = monthsBetween(scope.startMonth, scope.endMonth).length;
  return { fiscalYear, scope, elapsed, remaining: total - elapsed, total };
}

function ytdScopeFor(position: YearPosition, through: FiscalMonth): PeriodScope {
  return {
    type: 'YTD',
    startMonth: position.scope.startMonth,
    endMonth: through,
    label: `YTD through ${formatMonthLong(through)}`,
  };
}

function actualAt(measureId: string, ctx: MeasureContext, scope: PeriodScope): number | null {
  return computeMeasure(measureId, {
    ...contextAtScope(ctx, scope),
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
  }).value;
}

function gapUnitFor(unit: Unit): Unit {
  return unit === 'percent' ? 'bps' : unit;
}

/**
 * Which way the gap to plan is moving.
 *
 * About the **gap**, not the figure. Revenue rising while the plan rises faster is a business going
 * backwards against its plan, and a column that painted that green would be confidently reporting the
 * wrong thing.
 */
function directionOf(
  measureId: string,
  ctx: MeasureContext,
): { readonly direction: DirectionOfTravel; readonly note: string } {
  const end = ctx.scope.endMonth;
  const gapAt = (month: FiscalMonth): number | null => {
    const inForce = forecastInForce(month);
    if (inForce === undefined) return null;
    const scoped = contextAtScope(ctx, monthScope(month));
    const actual = computeMeasure(measureId, {
      ...scoped,
      scenario: 'ACTUAL',
      versionId: ACTUAL_VERSION,
    }).value;
    const assumed = computeMeasure(measureId, {
      ...scoped,
      scenario: inForce.scenario,
      versionId: inForce.id,
    }).value;
    if (actual === null || assumed === null || assumed === 0) return null;
    return (actual - assumed) / Math.abs(assumed);
  };

  const latest = gapAt(end);
  const before = [gapAt(addMonths(end, -2)), gapAt(addMonths(end, -1))].filter(
    (value): value is number => value !== null,
  );
  if (latest === null || before.length === 0) {
    return {
      direction: 'unavailable',
      note: 'No comparable forecast in the prior months, so no direction is claimed.',
    };
  }

  const prior = before.reduce((total, value) => total + value, 0) / before.length;
  const moved = latest - prior;
  /* A tenth of a point either way is a rounding difference, not a direction, and a column that calls it
     one teaches a reader to stop looking at the column. */
  if (Math.abs(moved) < 0.001) {
    return {
      direction: 'holding',
      note: `The gap to plan is unchanged on the prior two months, at ${formatValue(latest, 'percent')}.`,
    };
  }

  const improving = measure(measureId).polarity === 'lower_is_better' ? moved < 0 : moved > 0;
  return {
    direction: improving ? 'improving' : 'deteriorating',
    note:
      `The gap to plan moved from ${formatValue(prior, 'percent')} across the prior two months to ` +
      `${formatValue(latest, 'percent')} this month.`,
  };
}

/**
 * The landing if the year keeps doing what it has done.
 *
 * Three shapes of arithmetic, because a landing is not one calculation: a flow is carried at its
 * monthly rate, a rate is recomputed from its parts, and a balance is rebased from the latest close.
 * Getting this wrong is how a page reports a summed margin or an added-up cash balance and looks
 * confident doing it.
 */
function runRateFor(
  measureId: string,
  ctx: MeasureContext,
  position: YearPosition,
  through: FiscalMonth,
): number | null {
  if (position.elapsed === 0) return null;
  const aggregation = measure(measureId).trend;
  const ytd = ytdScopeFor(position, through);

  if (aggregation === 'sum') {
    const actualYtd = actualAt(measureId, ctx, ytd);
    return actualYtd === null ? null : (actualYtd / position.elapsed) * position.total;
  }

  if (aggregation === 'mean') {
    /* A rate is recomputed from its parts, never carried forward as a rate. Extrapolating a margin
       directly gives the same answer only where revenue and gross profit run at identical rates, which
       is precisely the case in which the extrapolation was unnecessary. */
    const revenue = runRateFor('revenue', ctx, position, through);
    const grossProfit = runRateFor('gross_profit', ctx, position, through);
    return revenue === null || grossProfit === null || revenue === 0 ? null : grossProfit / revenue;
  }

  /* A balance: the latest close carried at the average monthly movement since the year opened. Summing
     closing balances is the other way to do this and is nonsense. */
  const opening = actualAt(measureId, ctx, monthScope(addMonths(position.scope.startMonth, -1)));
  const closing = actualAt(measureId, ctx, monthScope(through));
  if (opening === null || closing === null) return null;
  return closing + ((closing - opening) / position.elapsed) * position.remaining;
}

/**
 * The approved forecast's remaining months, carried at a bias the actuals have shown.
 *
 * Only where the bias is persistent. One month's miss adjusting the whole back half of a year is how an
 * outlook ends up more volatile than the business it describes.
 */
function managementFor(
  measureId: string,
  approved: number | null,
  actualYtd: number | null,
  remainingForecast: number | null,
  persistence: Persistence,
): number | null {
  if (approved === null) return null;
  if (!persistence.persistent) return approved;

  if (measure(measureId).trend === 'sum' && actualYtd !== null && remainingForecast !== null) {
    /* Only the months still to come are adjusted. The banked months are actuals and are not a matter of
       opinion — a bias applied to the whole year would restate the closed half. */
    return actualYtd + remainingForecast * (1 + persistence.bias);
  }
  /* A rate or a balance does not decompose into "the part already banked plus the part to come", so the
     bias lands on the landing itself. */
  return approved * (1 + persistence.bias);
}

/**
 * What could move the landing, taken from where the approved plan and the run rate disagree.
 *
 * **An approved forecast above the run rate is a forecast assuming a recovery**, and the size of that
 * assumption is the exposure: if the run rate is right and the plan is not, the landing moves by exactly
 * that. The reverse is the opportunity — a plan below the run rate is assuming a fade the actuals do not
 * show.
 */
function risksFor(lines: readonly OutlookLine[], yearCtx: MeasureContext): LandingRisk[] {
  return lines
    .filter((line) => line.assumedRecovery !== null && line.assumedRecovery !== 0)
    .map((line): LandingRisk => {
      const definition = measure(line.measureId);
      const exposure = line.assumedRecovery ?? 0;
      const unit = gapUnitFor(definition.unit);
      const size = formatValue(Math.abs(exposure), unit);
      /* A plan above the run rate is a risk where higher is better and an opportunity where it is not.
         Taking the sign alone would call a cost forecast above run rate good news. */
      const higherIsBetter = definition.polarity !== 'lower_is_better';
      const kind: 'risk' | 'opportunity' = exposure > 0 === higherIsBetter ? 'risk' : 'opportunity';

      const contributors = contributorsFor({
        measureId: line.measureId,
        ctx: yearCtx,
        comparator: { id: 'budget' },
        limit: 2,
      });
      const top = contributors.rows[0];

      return {
        measureId: line.measureId,
        label: definition.label,
        kind,
        exposure: Math.abs(exposure),
        unit,
        /* The measure's name is not repeated into the sentence. It is already the heading, and the
           first attempt lowercased it to fit — which turned EBITDA into "ebitda", the kind of small
           wrongness a finance reader notices before anything else on the page. */
        statement:
          kind === 'risk'
            ? `The approved forecast lands ${size} above the rate the year has actually run. That ` +
              'difference is a recovery the plan is assuming, and it is what is at stake if the ' +
              'recovery does not arrive.'
            : `The rate the year has actually run lands ${size} above the approved forecast, which is ` +
              'assuming a fade the actuals do not show.',
        owner: top?.owner ?? 'Group FP&A',
        ...(top === undefined || top.movement === null
          ? {}
          : {
              /* Stated as a fact rather than as a relationship. "Where a recovery would come from"
                 reads wrong on an opportunity card, and any wording that ties this figure to the
                 exposure above invites a reconciliation that does not exist — these rows are
                 measurements at a pinned slice and do not sum to the group. */
              recoveryFrom:
                `Largest single gap to budget for the year: ${top.label}, ` +
                `${formatValue(Math.abs(top.movement), contributors.movementUnit)} ` +
                `${(top.movement < 0) === higherIsBetter ? 'behind' : 'ahead'}.`,
            }),
        ...(contributors.rows.length === 0 ? {} : { contributors }),
      };
    })
    /* Ranked within a unit, never across one. Sorting basis points against minor units by raw
       magnitude puts every money exposure above every rate exposure regardless of which matters —
       44bps of margin is not "smaller" than £149k of cash, it is not the same kind of thing. Money
       first because it is what a board acts on, and the surface says the ordering is by class. */
    .sort((a, b) => {
      const classOf = (risk: LandingRisk): number => (risk.unit === 'currency' ? 0 : 1);
      return classOf(a) - classOf(b) || b.exposure - a.exposure;
    });
}

/**
 * Build all three landings, the flags, what could move them, and what to do about the gap.
 *
 * The approved column comes from {@link buildYearToGo} rather than being recomputed, so this page and
 * that table cannot disagree about the governed answer — which is the failure mode of every second
 * outlook screen: two places computing one landing and drifting by a month's rounding.
 */
export function buildOutlook(
  ctx: MeasureContext,
  calendar: FiscalCalendar = CALENDAR_YEAR,
): Outlook {
  const through = ctx.scope.endMonth;
  const position = yearPosition(through, calendar);
  const projection = buildYearToGo({ ctx, calendar });
  const yearCtx = contextAtScope(ctx, position.scope);

  const lines = OUTLOOK_MEASURES.map((measureId): OutlookLine => {
    const definition = measure(measureId);
    const fromProjection = projection.lines.find((line) => line.measureId === measureId);
    const actualYtd = actualAt(measureId, ctx, ytdScopeFor(position, through));
    const runRate = runRateFor(measureId, ctx, position, through);
    const approved = fromProjection?.expectedFullYear ?? null;
    const persistence = persistenceFor(measureId, ctx);
    const management = managementFor(
      measureId,
      approved,
      actualYtd,
      fromProjection?.remainingForecast ?? null,
      persistence,
    );

    const budget = fromProjection?.fullYearBudget ?? null;
    const gapUnit = gapUnitFor(definition.unit);
    const rawGap = management === null || budget === null ? null : management - budget;
    const gapToBudget =
      rawGap === null ? null : definition.unit === 'percent' ? rawGap * 10_000 : rawGap;
    const favourable =
      rawGap === null || rawGap === 0 || definition.polarity === 'neutral'
        ? null
        : definition.polarity === 'higher_is_better'
          ? rawGap > 0
          : rawGap < 0;
    const travel = directionOf(measureId, ctx);

    return {
      measureId,
      label: definition.label,
      unit: definition.unit,
      actualYtd,
      monthsElapsed: position.elapsed,
      monthsRemaining: position.remaining,
      runRate,
      approved,
      management,
      persistence,
      budget,
      priorYear: fromProjection?.priorYearFullYear ?? null,
      gapToBudget,
      gapUnit,
      favourable,
      /* The flag is taken on the management-adjusted landing rather than the approved one. A page that
         flags "on track" against a forecast its own three-month history contradicts is the reason
         nobody trusts the flag. */
      trajectory:
        management === null || budget === null
          ? 'unavailable'
          : favourable === null
            ? 'on_track'
            : favourable
              ? 'ahead'
              : 'behind',
      direction: travel.direction,
      directionNote: travel.note,
      assumedRecovery:
        approved === null || runRate === null
          ? null
          : definition.unit === 'percent'
            ? (approved - runRate) * 10_000
            : approved - runRate,
    };
  });

  const ebitda = lines.find((line) => line.measureId === 'ebitda');
  const margin = lines.find((line) => line.measureId === 'gross_margin');
  const behind = lines.filter((line) => line.trajectory === 'behind');

  /* The same decision engine the scenarios surface runs, on the year's gap instead of a scenario's. One
     policy rather than two: a product that recommends a cost action on one page and stays silent on the
     same-sized gap on another has two opinions and no policy. */
  const actions =
    behind.length === 0
      ? []
      : impliedDecisions({
          movedLevers: [],
          /* The "lever" here is the persistent bias: where the margin has run below assumption for a
             quarter, the gap is a delivery-cost conversation rather than a pricing one, and the decision
             layer needs to be told which side of the margin moved. */
          leverMovement: {
            serviceDeliveryCost:
              margin?.persistence.persistent === true && margin.persistence.bias < 0
                ? -margin.persistence.bias
                : 0,
          },
          ebitdaBase: ebitda?.budget ?? null,
          ebitdaMovement: ebitda?.gapToBudget ?? null,
          marginMovementBps: margin?.gapToBudget ?? null,
          baseHeadroom: 0,
          scenarioHeadroom: 0,
          breachWeek: null,
          shortfallMinor: 0,
          basisLabel: 'budget',
        });

  return {
    fiscalYear: position.fiscalYear,
    scope: position.scope,
    through,
    monthsElapsed: position.elapsed,
    monthsRemaining: position.remaining,
    available: projection.available,
    ...(projection.unavailableReason === undefined
      ? {}
      : { unavailableReason: projection.unavailableReason }),
    projection,
    lines,
    risks: risksFor(lines, yearCtx),
    actions,
    ...(actions.length > 0
      ? {}
      : {
          noActionBecause:
            behind.length === 0
              ? `Every measure lands at or ahead of ${projection.budget.label} on the ` +
                'management-adjusted outlook, so there is no gap to close.'
              : `The gap to ${projection.budget.label} is inside every threshold this product acts on: ` +
                `EBITDA within ${(DECISION_POLICY.ebitdaFallShare * 100).toFixed(0)}% of budget, and ` +
                `gross margin within ${DECISION_POLICY.marginFallBps}bps of it.`,
        }),
  };
}
