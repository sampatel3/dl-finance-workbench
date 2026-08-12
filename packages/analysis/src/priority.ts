/**
 * The priority boards.
 *
 * `FW-DASH-001` asks for a dashboard of priority insights. This is the projection behind it, and the one
 * decision in this file is that the boards are a **partition** rather than four queries.
 *
 * ## Why the 2×2 and not a ranked list
 *
 * A single ranked list of findings is what most management reporting tools produce, and it fails in a
 * specific way: the most material thing is almost always something that has already happened, so the
 * list is permanently topped by history and the forward items — the ones where a decision is still
 * available — sit below the fold. A CFO reading it gets a very good account of last month and no prompt
 * to do anything about next month.
 *
 * Splitting on **horizon** fixes that by construction: the forward board is never crowded out by the
 * current one, because they are different boards. Splitting on **direction** does the same for
 * favourable news, which a materiality-ranked list buries for the same reason — bad news is usually
 * bigger. And a demo whose every finding is adverse reads as a scold rather than as a product.
 *
 * ## The partition is by construction, not by judgement
 *
 * Each detector declares its direction and horizon, so placing a finding is a lookup rather than a
 * decision. Nothing here can put a finding on two boards or on none, and the test that says so is not
 * checking a rule this file applies — it is checking that the type made the rule unnecessary.
 *
 * ## What ranking is left
 *
 * Only *within* a board, and only by the materiality policy's priority. There is no cross-board ranking
 * because there is no defensible one: a £48k reconciliation break and a £0.8m opportunity are not
 * comparable quantities, and a product that ranks them anyway has invented a number with no owner.
 */

import type { PeriodScope } from '@kestrel/model';
import type { ComparatorChoice, Priority, ResolvedComparator } from '@kestrel/measures';
import { resolveComparator } from '@kestrel/measures';

import type {
  DetectorContext,
  DetectorError,
  Finding,
  FindingDirection,
  FindingHorizon,
} from './detectors.ts';
import { DETECTORS, runDetectors, triage } from './detectors.ts';
import type { Triage } from './detectors.ts';

export interface BoardKey {
  readonly direction: FindingDirection;
  readonly horizon: FindingHorizon;
}

export interface Board extends BoardKey {
  readonly id: string;
  readonly title: string;
  /** What the board is for, in one line the surface prints under the heading. */
  readonly question: string;
  /** Findings on this board, most material first. */
  readonly findings: readonly Finding[];
  /** What a surface should say when it is empty — never a blank panel. */
  readonly emptyNote: string;
}

/**
 * The four boards, named.
 *
 * The titles are the client's own — Performance, Opportunities, Risks, and the current adverse board
 * their deck calls "Attention". The `question` matters more than the title: a board with a heading and
 * no stated purpose gets filled with whatever fires.
 */
const BOARD_SPECS: readonly (BoardKey & {
  id: string;
  title: string;
  question: string;
  emptyNote: string;
})[] = [
  {
    id: 'attention',
    direction: 'adverse',
    horizon: 'current',
    title: 'Needs attention',
    question: 'What went wrong in the period just closed, and who owns it?',
    emptyNote: 'Nothing adverse cleared materiality this period.',
  },
  {
    id: 'performance',
    direction: 'favourable',
    horizon: 'current',
    title: 'Performance',
    question: 'What went better than plan, and is it repeatable?',
    emptyNote: 'Nothing favourable cleared materiality this period.',
  },
  {
    id: 'risks',
    direction: 'adverse',
    horizon: 'forward',
    title: 'Risks',
    question: 'What is going to cost us if nothing changes?',
    emptyNote: 'No forward risks above the policy threshold.',
  },
  {
    id: 'opportunities',
    direction: 'favourable',
    horizon: 'forward',
    title: 'Opportunities',
    question: 'What could go better than the forecast assumes, and what is it worth?',
    emptyNote: 'No forward opportunities above the policy threshold.',
  },
];

const PRIORITY_ORDER: Readonly<Record<Priority, number>> = { high: 0, medium: 1, low: 2 };

export interface Boards {
  readonly scope: PeriodScope;
  readonly comparator: ResolvedComparator;
  readonly boards: readonly Board[];
  /** Every finding, before partitioning. Carried so a count can be reconciled against the boards. */
  readonly findings: readonly Finding[];
  /** Detectors that failed. Reported, because a silently missing board item is the worst outcome. */
  readonly errors: readonly DetectorError[];
  readonly duplicates: number;
}

/**
 * Build the four boards for a period and comparator.
 *
 * The comparator is resolved here and carried on the result, so a surface can always print what the
 * figures are being compared against. A board rendered without its basis is a board a reader has to
 * guess at, and the guess is usually "last year".
 */
export function priorityBoards(dctx: DetectorContext): Boards {
  const run = runDetectors(dctx);
  const comparator = resolveComparator(dctx.comparator, dctx.ctx);

  const boards = BOARD_SPECS.map((spec) => ({
    ...spec,
    findings: run.findings
      .filter((f) => f.direction === spec.direction && f.horizon === spec.horizon)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
  }));

  return {
    scope: dctx.ctx.scope,
    comparator,
    boards,
    findings: run.findings,
    errors: run.errors,
    duplicates: run.duplicates,
  };
}

/** One board by id, for a surface routed to a single board. */
export function board(boards: Boards, id: string): Board {
  const found = boards.boards.find((b) => b.id === id);
  if (!found) throw new Error(`Unknown board: ${id}`);
  return found;
}

/**
 * The brief: the boards, capped, with what was left out.
 *
 * Triaged **per board** rather than across all four. Capping globally would let a bad month crowd the
 * opportunities off the page entirely, which is the failure the partition exists to prevent — and it
 * would reintroduce it one layer up, where it is harder to see.
 */
export interface Brief {
  readonly boards: readonly (Board & { readonly triage: Triage })[];
  readonly comparator: ResolvedComparator;
  readonly scope: PeriodScope;
  readonly errors: readonly DetectorError[];
}

export function brief(dctx: DetectorContext, capPerBoard = 3): Brief {
  const boards = priorityBoards(dctx);
  return {
    boards: boards.boards.map((b) => ({ ...b, triage: triage(b.findings, capPerBoard) })),
    comparator: boards.comparator,
    scope: boards.scope,
    errors: boards.errors,
  };
}

/**
 * Which board a detector's findings will land on, without running anything.
 *
 * The suite's coverage of the four boards is a property of the *definitions*, so it can be checked
 * without data — and a thirteenth detector that would leave a board empty is a failing test at the
 * moment it is added rather than a discovery in front of a client.
 */
export function boardCoverage(): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>();
  for (const spec of BOARD_SPECS) {
    out.set(
      spec.id,
      DETECTORS.filter((d) => d.direction === spec.direction && d.horizon === spec.horizon).map(
        (d) => d.id,
      ),
    );
  }
  return out;
}

/** The board a direction and horizon name. Exported so a surface can route a finding to its board. */
export function boardIdFor(key: BoardKey): string {
  const spec = BOARD_SPECS.find((s) => s.direction === key.direction && s.horizon === key.horizon);
  // Unreachable while both types are closed unions, and asserted rather than defaulted so that widening
  // either one fails loudly here instead of quietly routing findings to the first board.
  if (spec === undefined) throw new Error(`No board for ${key.direction}/${key.horizon}`);
  return spec.id;
}

/** Every comparator a surface can offer, so the selector is not a hand-maintained list. */
export function comparatorChoices(approvedForecastId: string): readonly ComparatorChoice[] {
  return [
    { id: 'prior_period' },
    { id: 'prior_year' },
    { id: 'budget', versionId: 'budget-fy26' },
    { id: 'forecast', versionId: approvedForecastId },
    { id: 'trend' },
  ];
}
