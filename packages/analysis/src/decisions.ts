/**
 * What a scenario asks management to decide, and how far outside experience it sits.
 *
 * The review's ask on the scenarios surface is to *"move from simple sensitivity to management
 * decision support"*: for each scenario, **state the management decision implied** — price increase,
 * cost reduction, hiring freeze, delayed capital spend, funding transfer — and **show probability or
 * confidence where appropriate**.
 *
 * ## The decision follows the breakage, not the lever
 *
 * The tempting shape is a lookup: moved the price lever, therefore the decision is a price decision.
 * That is a restatement of the input dressed as advice. It also gets the interesting cases exactly
 * backwards — the collections lever moves no profit-and-loss figure at all and puts the group through
 * the cash floor, and a lookup on the lever would answer "collections" when the decision on the table
 * is a funding transfer with a date on it.
 *
 * So a decision here is triggered by **what the outcome broke**, against thresholds written down in
 * {@link DECISION_POLICY}. The lever that moved is used only to choose between two decisions the same
 * breakage could imply — a margin that compressed because price fell is a pricing conversation, and the
 * same compression from delivery cost is an operational one.
 *
 * ## Why there is no percentage
 *
 * "72% likely" would be the easiest number on this surface to print and the only one nobody could
 * defend. Nothing in this world carries a probability distribution: the assumption sets are five stored
 * versions, and five observations is a range rather than a density.
 *
 * What the data does support is **precedent** — whether an assumption this scenario makes is one the
 * business has ever actually planned on. Cost to serve at 1.06 is not 30% likely; it is above every
 * value any of the five stored versions has assumed, and that is a fact a reader can check and act on.
 * {@link precedentFor} states it, {@link confidenceOf} takes the weakest across the moved levers, and
 * the surface says "how far outside experience" rather than "how likely".
 */

import type { AssumptionSet, VersionSpec } from '@kestrel/model';
import { VERSIONS } from '@kestrel/model';

import { formatValue } from '@kestrel/measures';

import type { FundingPlan } from './funding.ts';

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

/**
 * The thresholds a scenario has to cross before it implies a decision.
 *
 * Written down and exported rather than inlined, because the most useful thing this surface can say
 * is often *"no decision is implied"* — and that sentence is worth nothing unless it can name the
 * tolerance it stayed inside. A silent threshold turns "nothing to do" into "we did not look".
 */
export const DECISION_POLICY = {
  /** Headroom lost against the board floor before deferrable spend comes up. */
  headroomFallMinor: 500_000_00,
  /** Gross-margin compression, in basis points, before a pricing or cost-to-serve action is implied. */
  marginFallBps: 50,
  /** Share of base EBITDA lost before an overhead action is implied. */
  ebitdaFallShare: 0.05,
  /** The deeper share at which a hiring freeze joins the overhead action. */
  ebitdaFreezeShare: 0.12,
  /** Collection days added before the receivables book becomes the decision. */
  collectionSlipDays: 5,
} as const;

export type DecisionId =
  | 'funding_transfer'
  | 'defer_capital_spend'
  | 'collections_push'
  | 'price_action'
  | 'cost_to_serve_action'
  | 'overhead_reduction'
  | 'hiring_freeze';

export interface ImpliedDecision {
  readonly id: DecisionId;
  /** The decision itself, in the words a board minute would use. */
  readonly label: string;
  /** Who takes it. Named, because a decision without an owner is an observation. */
  readonly owner: string;
  /** The figure that triggered it, so a reader can disagree with the trigger rather than the advice. */
  readonly because: string;
  /**
   * When it has to be taken.
   *
   * A week number where the outcome put a date on it — a cash breach does — and otherwise the ordinary
   * cycle the decision belongs to. Distinguishing them is the point: one of these decisions has a
   * deadline and the others have a forum.
   */
  readonly by: string;
  /** True where the outcome fixed the date rather than the calendar. */
  readonly dated: boolean;
}

/** The outcome a scenario produced, as plain figures. No world, no store, no view. */
export interface ScenarioOutcome {
  /** Assumption keys the scenario moved. Used only to choose between decisions, never to trigger one. */
  readonly movedLevers: readonly string[];
  /** Signed movement of each assumption against the approved forecast's own value. */
  readonly leverMovement: Readonly<Record<string, number>>;
  readonly ebitdaBase: number | null;
  readonly ebitdaMovement: number | null;
  /** Gross-margin movement in basis points, because a margin is not summed and not quoted in money. */
  readonly marginMovementBps: number | null;
  /** Headroom against the board floor at the horizon's low point, in both worlds. */
  readonly baseHeadroom: number;
  readonly scenarioHeadroom: number;
  readonly breachWeek: number | null;
  readonly shortfallMinor: number;
  /** Present where the breach could be costed against the group's own balances. */
  readonly funding?: FundingPlan;
  /**
   * What the movements are measured against, for the prose only.
   *
   * A scenario's outcome is a difference from the approved forecast; the year-to-go gap is a difference
   * from budget. Same engine, same thresholds, and a sentence that names the wrong comparator is the
   * kind of error a reader catches instantly and never trusts the page again after.
   */
  readonly basisLabel?: string;
}

// ---------------------------------------------------------------------------
// Implied decisions
// ---------------------------------------------------------------------------

/* The product's own formatter, so a decision reads "£844k" like every figure it sits beside. A
   locally-rolled version printed "£843,627" — arithmetically identical and visibly foreign, which is
   how a page stops looking like one product. */
const money = (minor: number): string => formatValue(Math.abs(minor), 'currency');

/**
 * The decisions this outcome implies, most urgent first.
 *
 * Order is by whether the outcome fixed a date, then by the thing that breaks first. A cash breach
 * outranks a margin conversation not because cash matters more but because it arrives on a Tuesday.
 */
export function impliedDecisions(outcome: ScenarioOutcome): readonly ImpliedDecision[] {
  const out: ImpliedDecision[] = [];
  const basis = outcome.basisLabel ?? 'the approved forecast';

  if (outcome.breachWeek !== null) {
    const plan = outcome.funding;
    const earliest = plan?.usable
      .map((option) => option.startByWeek)
      .filter((week): week is number => week !== null)
      .sort((a, b) => a - b)[0];
    /* Where the group cannot reach the shortfall from its own balances, the decision is not "move
       money" — it is the facility, and saying so is the difference between a plan and a wish. */
    const covered = plan === undefined || plan.covered;
    out.push({
      id: 'funding_transfer',
      label: covered
        ? 'Fund the trough from group balances'
        : 'Draw on the facility — the group cannot cover this from its own balances',
      owner: 'Group Treasurer, with the Chief Financial Officer',
      because:
        `The floor is breached in week ${outcome.breachWeek} by ${money(outcome.shortfallMinor)}` +
        (plan === undefined ? '' : `, and ${money(plan.reachableMinor)} can be reached in time`),
      by:
        earliest === undefined
          ? `week ${outcome.breachWeek}`
          : `week ${earliest}, which is the last week the transfer can be requested and still clear`,
      dated: true,
    });
  } else if (outcome.baseHeadroom - outcome.scenarioHeadroom >= DECISION_POLICY.headroomFallMinor) {
    out.push({
      id: 'defer_capital_spend',
      label: 'Hold discretionary capital spend until the trough has passed',
      owner: 'Chief Financial Officer',
      because:
        `Headroom at the low point falls ${money(outcome.baseHeadroom - outcome.scenarioHeadroom)} ` +
        `to ${money(outcome.scenarioHeadroom)}, which clears the floor but not by much`,
      by: 'the next capital approvals meeting',
      dated: false,
    });
  }

  const daysAdded = outcome.leverMovement['dsoDays'] ?? 0;
  if (daysAdded >= DECISION_POLICY.collectionSlipDays) {
    out.push({
      id: 'collections_push',
      label: 'Put the receivables book on a weekly collections call',
      owner: 'Group Treasurer, with each entity controller',
      because:
        `Collection days are ${daysAdded} above ${basis}, which reaches cash without ` +
        'touching a single profit-and-loss line',
      by: 'this month',
      dated: false,
    });
  }

  const marginFall = outcome.marginMovementBps === null ? 0 : -outcome.marginMovementBps;
  if (marginFall >= DECISION_POLICY.marginFallBps) {
    /* Same compression, two different conversations. Which one it is depends on which side of the
       margin the scenario moved — and where it moved both, the cost side is the one management can act
       on this quarter. */
    const costSide =
      (outcome.leverMovement['serviceDeliveryCost'] ?? 0) > 0 ||
      (outcome.leverMovement['subcontractRate'] ?? 0) > 0;
    out.push(
      costSide
        ? {
            id: 'cost_to_serve_action',
            label: 'Re-price the delivery book or take cost out of it',
            owner: 'Services Director, with the Commercial Director',
            because:
              `Gross margin is ${marginFall.toFixed(0)}bps below ${basis}, from the delivery cost side`,
            by: 'the next operating review',
            dated: false,
          }
        : {
            id: 'price_action',
            label: 'Hold price on renewal rather than defend volume',
            owner: 'Commercial Director',
            because: `Gross margin is ${marginFall.toFixed(0)}bps below ${basis}, from the price side`,
            by: 'the next commercial review',
            dated: false,
          },
    );
  }

  const ebitdaShare =
    outcome.ebitdaBase === null || outcome.ebitdaBase === 0 || outcome.ebitdaMovement === null
      ? 0
      : -outcome.ebitdaMovement / Math.abs(outcome.ebitdaBase);
  if (ebitdaShare >= DECISION_POLICY.ebitdaFallShare) {
    out.push({
      id: 'overhead_reduction',
      label: 'Take a fixed-cost reduction to the board',
      owner: 'Chief Financial Officer',
      because:
        `EBITDA is ${money(outcome.ebitdaMovement ?? 0)} below ${basis}, which is ` +
        `${(ebitdaShare * 100).toFixed(1)}% of it`,
      by: 'the next board meeting',
      dated: false,
    });
  }
  if (ebitdaShare >= DECISION_POLICY.ebitdaFreezeShare) {
    out.push({
      id: 'hiring_freeze',
      label: 'Freeze recruitment outside delivery roles',
      owner: 'Chief Financial Officer, with the Group HR Director',
      because:
        `The EBITDA shortfall against ${basis} of ${(ebitdaShare * 100).toFixed(1)}% is past the ` +
        `${(DECISION_POLICY.ebitdaFreezeShare * 100).toFixed(0)}% point where cost actions stop ` +
        'being discretionary',
      by: 'immediately, if the scenario is adopted',
      dated: false,
    });
  }

  return out.sort((a, b) => Number(b.dated) - Number(a.dated));
}

/**
 * The sentence to print where nothing was triggered.
 *
 * It names every threshold the scenario stayed inside, because "no decision is implied" from a surface
 * that will not say what it tested is indistinguishable from a surface that tested nothing.
 */
export function noDecisionBecause(): string {
  return (
    'No management decision is implied. The scenario stays inside every threshold this surface tests: ' +
    `the cash floor holds with at least ${money(DECISION_POLICY.headroomFallMinor)} of headroom kept, ` +
    `gross margin moves less than ${DECISION_POLICY.marginFallBps}bps, EBITDA moves less than ` +
    `${(DECISION_POLICY.ebitdaFallShare * 100).toFixed(0)}% of the comparison, and collection ` +
    `days move less than ${DECISION_POLICY.collectionSlipDays}.`
  );
}

// ---------------------------------------------------------------------------
// Precedent, which is what this world can honestly say instead of probability
// ---------------------------------------------------------------------------

export type PrecedentBand = 'within' | 'edge' | 'beyond';

export interface Precedent {
  readonly key: string;
  readonly value: number;
  /** The range the stored versions have actually assumed for this driver. */
  readonly low: number;
  readonly high: number;
  readonly lowVersion: VersionSpec;
  readonly highVersion: VersionSpec;
  readonly band: PrecedentBand;
  /** One line naming the version that bounds it, so the claim can be checked. */
  readonly statement: string;
}

/** How far past the observed range still counts as the edge of experience rather than beyond it. */
const EDGE_SHARE = 0.5;

const fmt = (key: string, value: number): string =>
  key === 'dsoDays' ? `${value > 0 ? '+' : ''}${value.toFixed(0)} days` : value.toFixed(3);

/**
 * Where one assumption sits against every value the stored versions have assumed for it.
 *
 * All five versions count, budget and superseded included. A superseded forecast is not a mistake to be
 * excluded — it is evidence that the business once thought this driver could sit there, which is
 * exactly the question being asked.
 */
export function precedentFor(key: keyof AssumptionSet, value: number): Precedent {
  const observed = VERSIONS.map((version) => ({ version, value: version.assumptions[key] })).sort(
    (a, b) => a.value - b.value,
  );
  const lowest = observed[0];
  const highest = observed[observed.length - 1];
  if (lowest === undefined || highest === undefined) {
    throw new Error('no stored versions to take precedent from');
  }

  const width = highest.value - lowest.value;
  const outside =
    value < lowest.value ? lowest.value - value : value > highest.value ? value - highest.value : 0;
  const band: PrecedentBand =
    outside === 0 ? 'within' : outside <= width * EDGE_SHARE ? 'edge' : 'beyond';

  const bounding = value > highest.value ? highest : lowest;
  const statement =
    band === 'within'
      ? `${fmt(key, value)} sits inside the ${fmt(key, lowest.value)} to ${fmt(key, highest.value)} range the ${observed.length} stored versions have assumed.`
      : `${fmt(key, value)} is ${value > highest.value ? 'above' : 'below'} anything any stored version has assumed — the ${value > highest.value ? 'highest' : 'lowest'} is ${fmt(key, bounding.value)} in ${bounding.version.label}${bounding.version.status === 'approved' ? '' : ` (${bounding.version.status})`}.`;

  return {
    key,
    value,
    low: lowest.value,
    high: highest.value,
    lowVersion: lowest.version,
    highVersion: highest.version,
    band,
    statement,
  };
}

export interface Confidence {
  readonly band: PrecedentBand;
  readonly label: string;
  /** What the band means for how the outcome should be read. */
  readonly statement: string;
  readonly precedents: readonly Precedent[];
}

const CONFIDENCE_LABEL: Readonly<Record<PrecedentBand, string>> = {
  within: 'Inside experience',
  edge: 'At the edge of experience',
  beyond: 'Outside experience',
};

/**
 * The scenario's overall standing: the weakest of its moved assumptions.
 *
 * The weakest rather than an average, because averaging is how a scenario with one impossible
 * assumption and four ordinary ones reports as ordinary.
 */
export function confidenceOf(precedents: readonly Precedent[]): Confidence {
  const order: readonly PrecedentBand[] = ['within', 'edge', 'beyond'];
  const band = precedents.reduce<PrecedentBand>(
    (worst, precedent) =>
      order.indexOf(precedent.band) > order.indexOf(worst) ? precedent.band : worst,
    'within',
  );

  const statement =
    precedents.length === 0
      ? 'Nothing has moved, so there is nothing to place against precedent.'
      : band === 'within'
        ? 'Every assumption moved sits inside the range the stored versions have used, so this outcome ' +
          'is about as reliable as the forecast it is built on.'
        : band === 'edge'
          ? 'At least one assumption sits just outside anything a stored version has planned on. The ' +
            'arithmetic holds; the assumption is the part to argue about.'
          : 'At least one assumption is further from experience than the whole range the stored ' +
            'versions cover. Read the outcome as a direction and a magnitude, not as a forecast.';

  return { band, label: CONFIDENCE_LABEL[band], statement, precedents };
}
