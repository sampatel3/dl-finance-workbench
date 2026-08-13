/** Overview-specific projections kept outside the page so their reporting boundary is testable. */

import type { FiscalMonth } from '@kestrel/model';
import { closeCompleteness, entity, monthScope, priorYearScope } from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { computeMeasure, formatValue } from '@kestrel/measures';

import { headlinesFor } from './headline';
import type { View } from './world';
import { briefFor, contextOf, scopeLabel, world } from './world';

export interface OverviewRevenuePoint {
  readonly month: FiscalMonth;
  readonly value: number | null;
  readonly comparative: number | null;
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
    world().closePositions.filter((position) => view.permission.entityIds.includes(position.entityId)),
    view.scope.endMonth,
  );

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
      `${completeness.closed} of ${completeness.total} ledgers are closed for ${entity(view.entityId).name}.`,
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
      ctx.comparativeScope === undefined
        ? { ...ctx, scope }
        : { ...ctx, scope, comparativeScope };

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
