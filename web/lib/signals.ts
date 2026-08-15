/**
 * What each section would tell you if you opened it — shown in the rail, before you do.
 *
 * A grouped rail is orientation: it says where things are. This is the part that makes it triage. A
 * chief financial officer opening a workbench on the sixth working day is not browsing; they are
 * looking for where the problems are, and a navigation list that cannot say makes them click twelve
 * times to find out that eleven pages were quiet.
 *
 * ## The rule that keeps this honest
 *
 * **A signal exists only where the page itself already renders a warning.** Every count here is the
 * same computation the destination performs — the cash surface's own breach, the capital page's own
 * over-budget verdict, the commentary queue's own affordances. Nothing is invented for the rail, and
 * nothing is scored.
 *
 * That constraint is what stops this becoming a dashboard of made-up severity. It also means the
 * absence of a badge is a real statement: the page ran its own test and found nothing, rather than
 * nobody having looked.
 *
 * ## Why there is no badge on Performance, Forecast, KPIs or Scenarios
 *
 * Because those pages have no pass/fail of their own. Performance decomposes a variance the Overview
 * already flagged; a scenario is a question, not a task; a forecast version is a record. Putting a
 * dot on them to make the rail look evenly instrumented would be the exact failure this file's rule
 * exists to prevent — and the codebase has the lesson written down elsewhere: a detector that fires
 * on everything has found nothing.
 *
 * ## Cost
 *
 * These run on every page render, and one of them — the year-to-go outlook — is the most expensive
 * computation in the product at around 120ms. So the whole set is memoised against a signature of
 * the things that can change it. A demo holds one persona and period for minutes at a time, so the
 * first click pays and every click after it is free.
 */

import { closePositionsFor, seedCommentaryQueue } from '@kestrel/model';
import { buildCapital, buildOutlook, directForecast } from '@kestrel/analysis';

import { commentaryAffordances, commentaryForView } from './commentary';
import type { View } from './world';
import { briefFor, contextOf, world } from './world';

export interface RailSignal {
  /** How many things are outstanding. Always at least one where the signal exists. */
  readonly count: number;
  /** What the count means, for the link's accessible name and its tooltip. */
  readonly label: string;
}

export type RailSignals = Readonly<Record<string, RailSignal>>;

/**
 * Everything that can change a signal.
 *
 * The persona is in it because every count is row-level scoped, and the comparator because "behind
 * budget" is a different question from "behind forecast". A signature missing either would serve one
 * reader's counts to another, which is the quiet version of a permission leak.
 */
function signatureOf(view: View): string {
  return [
    view.principal.id,
    view.entityId,
    view.scope.startMonth,
    view.scope.endMonth,
    view.comparator.id,
    view.comparator.versionId ?? '',
    view.lens,
    view.version.id,
  ].join('|');
}

const cache = new Map<string, RailSignals>();

export function railSignals(view: View): RailSignals {
  const key = signatureOf(view);
  const held = cache.get(key);
  if (held !== undefined) return held;
  const built = compute(view);
  cache.set(key, built);
  return built;
}

function compute(view: View): RailSignals {
  const out: Record<string, RailSignal> = {};
  const ctx = contextOf(view);

  /* Overview: everything the detectors kept after triage. The same number the boards render, so a
     reader who clicks through finds exactly that many items and not a different count. */
  const brief = briefFor(view);
  const decisions = brief.boards.reduce((sum, board) => sum + board.triage.kept.length, 0);
  if (decisions > 0) {
    out['/app'] = {
      count: decisions,
      label: `${decisions} ${decisions === 1 ? 'item needs' : 'items need'} a decision`,
    };
  }

  /* Cash: the thirteen-week forecast against the board floor. One signal, not a count — a breach is
     a single event with a week attached, and "3" would imply three separate problems. */
  const cash = directForecast(ctx);
  if (cash.breach !== undefined) {
    out['/app/cash'] = {
      count: 1,
      label: `Cash floor breached in week ${cash.breach.index}`,
    };
  }

  /* Year to Go: measures landing behind budget on the management-adjusted outlook — the same column
     the page takes its own flags from. */
  const outlook = buildOutlook(ctx);
  const behind = outlook.lines.filter((line) => line.trajectory === 'behind').length;
  if (behind > 0) {
    out['/app/year-to-go'] = {
      count: behind,
      label: `${behind} ${behind === 1 ? 'measure lands' : 'measures land'} behind budget`,
    };
  }

  /* Capex: projects whose approval will not cover them once commitments are counted. */
  const capital = buildCapital(ctx);
  const exposed = capital.projects.filter(
    (row) => row.verdict === 'over_budget' || row.verdict === 'at_risk',
  ).length;
  if (exposed > 0) {
    out['/app/capital'] = {
      count: exposed,
      label: `${exposed} ${exposed === 1 ? 'project has' : 'projects have'} no budget headroom left`,
    };
  }

  /* Commentary: only what *this* principal can act on. An analyst sees drafts to submit and a
     controller sees reviews to approve, because the queue's own affordance rule decides both — a
     badge counting everything would send a reader to a page with nothing for them on it. */
  const waiting = commentaryForView(seedCommentaryQueue(world()), view).filter(
    (item) => commentaryAffordances(item, view.principal).length > 0,
  ).length;
  if (waiting > 0) {
    out['/app/commentary'] = {
      count: waiting,
      label: `${waiting} ${waiting === 1 ? 'item is' : 'items are'} waiting on you`,
    };
  }

  /* Controls: ledgers still open at the reporting boundary, scoped to what this session may read. */
  const open = closePositionsFor(world().closePositions, view.scope.endMonth)
    .filter((position) => view.permission.entityIds.includes(position.entityId))
    .filter((position) => position.state !== 'closed').length;
  if (open > 0) {
    out['/app/controls'] = {
      count: open,
      label: `${open} ${open === 1 ? 'ledger is' : 'ledgers are'} not closed`,
    };
  }

  return out;
}
