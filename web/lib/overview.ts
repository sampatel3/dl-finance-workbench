/** Overview-specific projections kept outside the page so their reporting boundary is testable. */

import type { FiscalMonth } from '@kestrel/model';
import { closeCompleteness, entity, monthScope, priorYearScope } from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { computeMeasure, formatValue } from '@kestrel/measures';
import type { Contributors } from '@kestrel/analysis';
import { becauseOf, contributorsFor } from '@kestrel/analysis';

import { closeStatusCopy } from './close';
import type { Headline } from './headline';
import { headlinesFor } from './headline';
import type { View } from './world';
import { briefFor, contextOf, scopeLabel, world } from './world';

export interface OverviewRevenuePoint {
  readonly month: FiscalMonth;
  readonly value: number | null;
  readonly comparative: number | null;
}

/** A headline figure with the reason underneath it. */
export interface HeadlineWithDrivers {
  readonly headline: Headline;
  /** Absent where the movement is immaterial: an explanation of nothing is noise. */
  readonly contributors?: Contributors;
  /** The "because of…" sentence, written by code from the contribution rows. */
  readonly because?: string;
}

/**
 * The headline row, each material movement carrying what drove it.
 *
 * The review's core note: *"the Revenue / Margin / EBITDA / Cash summary should show what is driving the
 * change… numbers alone do not tell the CFO the underlying story."*
 *
 * **Only material movements get an explanation**, and that is the part worth defending. Explaining all
 * four unconditionally would put a "because of…" line under a figure that moved 0.3% — which trains a
 * reader to skip the line, and the one month it says something urgent they will skip that too. The
 * materiality policy already decides what is worth a reader's attention; this reuses that decision rather
 * than inventing a second threshold.
 *
 * Cash is the interesting exception in practice: it is compared on the cash-flow policy class, so it
 * clears on a different threshold from the P&L measures above it, and it should — a £600k swing in
 * revenue and a £600k swing in cash are not the same news.
 */
export function headlinesWithDrivers(view: View): HeadlineWithDrivers[] {
  const ctx = contextOf(view);
  return headlinesFor(ctx, view.comparator).map((headline) => {
    if (!headline.material) return { headline };
    const contributors = contributorsFor({
      measureId: headline.measureId,
      ctx,
      comparator: view.comparator,
      /* Three rows. A fourth is rarely the answer to "why", and the remainder is reported, so the cap
         costs a reader nothing they are not told about. */
      limit: 3,
    });
    return { headline, contributors, because: becauseOf(contributors, formatValue) };
  });
}

export interface OverviewNarration {
  readonly headline: string;
  readonly body: string;
}

/**
 * The code-written overview sentence for every reporting identity that is not in the small build-time
 * narration cache.
 *
 * Period, comparator, lens and version all change the governed figures. Reusing the cached monthly
 * sentence after one of those controls changes would leave plausible prose attached to the wrong
 * evidence. This projection reads the selected view instead and states both identity fields in words.
 */
export function deterministicOverviewNarration(view: View): OverviewNarration {
  const ctx = contextOf(view);
  const brief = briefFor(view);
  const headlines = headlinesFor(ctx, view.comparator);
  const period = scopeLabel(view.periodKind, view.scope);
  const findings = brief.boards.flatMap((board) => board.triage.kept);
  const boards = brief.boards
    .filter((board) => board.triage.kept.length > 0)
    .map((board) => `${board.triage.kept.length} on ${board.title.toLowerCase()}`);
  const forward = brief.boards
    .filter((board) => board.horizon === 'forward')
    .reduce((sum, board) => sum + board.triage.kept.length, 0);
  const completeness = closeCompleteness(
    world().closePositions.filter((position) =>
      view.permission.entityIds.includes(position.entityId),
    ),
    view.scope.endMonth,
  );
  const close = closeStatusCopy({
    closed: completeness.closed,
    total: completeness.total,
    openNames: completeness.open.map((position) => entity(position.entityId).name),
  });

  const headline =
    findings.length === 0
      ? `${period} has nothing above the materiality threshold`
      : `${findings.length} items need a decision in ${period}`;
  const boardSentence =
    findings.length === 0
      ? `Nothing cleared the materiality policy in ${period}.`
      : `${findings.length} findings in ${period}: ${boards.join(', ')}. ${forward} of them are forward items.`;

  return {
    headline,
    body:
      `${boardSentence} Revenue was ${formatValue(headlines[0]?.value ?? null, 'currency')} and ` +
      `EBITDA ${formatValue(headlines[2]?.value ?? null, 'currency')}, against ${brief.comparator.basis}. ` +
      `${close.summary} Reporting scope: ${entity(view.entityId).name}.` +
      (close.detail === undefined ? '' : ` ${close.detail}`),
  };
}

/**
 * Revenue history ending at the view's selected reporting boundary.
 *
 * The model contains closed months after a historical selection, so taking the last twelve model months
 * would silently move the chart into the future. Resolve the end index first and slice through it. For a
 * constant-currency view, each point also borrows that point's prior-year rates; retaining the aggregate
 * view's comparative scope would apply one selected month's rate window to the whole line.
 */
export function overviewRevenueSeries(
  ctx: MeasureContext,
  months: readonly FiscalMonth[],
  through: FiscalMonth,
  count = 12,
): OverviewRevenuePoint[] {
  const end = months.indexOf(through);
  if (end === -1) return [];

  return months.slice(Math.max(0, end - count + 1), end + 1).map((month) => {
    const scope = monthScope(month);
    const comparativeScope = priorYearScope(scope);
    const pointContext: MeasureContext =
      ctx.comparativeScope === undefined ? { ...ctx, scope } : { ...ctx, scope, comparativeScope };

    return {
      month,
      value: computeMeasure('revenue', pointContext).value,
      // The comparative line is the same month a year earlier as reported, not a second
      // constant-currency transformation whose rate basis would need yet another prior year.
      comparative: computeMeasure('revenue', {
        ...pointContext,
        scope: comparativeScope,
        lens: 'reported',
        comparativeScope: undefined,
      }).value,
    };
  });
}
