/**
 * Accounting status: what a reader has to know about every figure on the page before reading one.
 *
 * The review's note was that the close area read as a system message rather than a control:
 * *"rename the ledger-close area to Status or Accounting Status … show outstanding entity, reason and
 * expected close date. This turns a system note into a CFO-ready control status."*
 *
 * The three additions are not decoration. "4/5 closed" tells a reader something is outstanding and
 * leaves them unable to act: they do not know whose it is, why, or whether it is a problem this morning
 * or on Friday. Each of the three answers one of those, and together they turn a caveat into a task with
 * a name on it.
 *
 * ## Why the grade has three states rather than two
 *
 * A period is `final`, `on_schedule` or `at_risk`, and the third exists because "not final" covers both
 * a ledger closing tomorrow as planned and one that has already missed its date. Those are different
 * conversations and one amber banner cannot hold both.
 *
 * The grade is computed from the stated expected close date against the group's published close day —
 * never from a clock. A demo whose status changed overnight is a demo whose screenshots go stale, and a
 * deadline inferred from the data itself would move when the data did, which makes "late" meaningless.
 */

import type { ClosePosition } from '@kestrel/model';
import { entity } from '@kestrel/model';

/** How settled the period is. Three states, because "not final" hides the distinction that matters. */
export type CloseGrade = 'final' | 'on_schedule' | 'at_risk';

export interface OutstandingLedger {
  readonly entityId: string;
  readonly entityName: string;
  /** Who the group is waiting on. Never "pending", which is not an owner. */
  readonly owner: string;
  /** Why, in words a reviewer can act on. */
  readonly reason?: string;
  /** The date the group expects it, as stated by the close calendar. */
  readonly expected?: string;
  /** Submitted but not closed, or not yet submitted at all. */
  readonly state: ClosePosition['state'];
}

export interface AccountingStatus {
  readonly grade: CloseGrade;
  readonly closed: number;
  readonly total: number;
  /** The headline: "4 of 5 ledgers closed — period not final." */
  readonly summary: string;
  /** Every outstanding ledger, named. A count with no names is a caveat nobody can act on. */
  readonly outstanding: readonly OutstandingLedger[];
  /** What it means for the figures below it, in one sentence. */
  readonly consequence: string;
  readonly final: boolean;
}

/** `2026-07-08T17:00:00Z` → `8 Jul`. Enough to schedule against; the year is elsewhere on the page. */
export function shortDate(iso: string): string {
  const [date] = iso.split('T');
  const [, month, day] = (date ?? '').split('-');
  const names = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${Number(day)} ${names[Number(month) - 1] ?? ''}`.trim();
}

/**
 * The group's published close day: the sixth, which is when every other ledger closes.
 *
 * Written down rather than inferred, so "late" is measured against a calendar somebody committed to. A
 * deadline derived from the data would move when the data did, and a ledger can hardly be late against
 * a target it set itself.
 */
export const GROUP_CLOSE_DAY = 6;

function gradeOf(outstanding: readonly OutstandingLedger[]): CloseGrade {
  if (outstanding.length === 0) return 'final';
  const late = outstanding.some((ledger) => {
    // No stated date is worse than a late one: nobody has committed to anything.
    if (ledger.expected === undefined) return true;
    const day = Number((ledger.expected.split('T')[0] ?? '').split('-')[2]);
    return Number.isFinite(day) && day > GROUP_CLOSE_DAY;
  });
  return late ? 'at_risk' : 'on_schedule';
}

export function accountingStatus(positions: readonly ClosePosition[]): AccountingStatus {
  const total = positions.length;
  const open = positions.filter((position) => position.state !== 'closed');
  const closed = total - open.length;

  const outstanding = open.map((position): OutstandingLedger => ({
    entityId: position.entityId,
    entityName: entity(position.entityId).name,
    owner: position.owner,
    state: position.state,
    ...(position.note === undefined ? {} : { reason: position.note }),
    ...(position.expectedCloseAt === undefined ? {} : { expected: position.expectedCloseAt }),
  }));

  const grade = gradeOf(outstanding);
  const noun = total === 1 ? 'ledger' : 'ledgers';

  return {
    grade,
    closed,
    total,
    summary:
      grade === 'final'
        ? `${closed} of ${total} ${noun} closed — period final.`
        : `${closed} of ${total} ${noun} closed — period not final.`,
    outstanding,
    consequence: consequenceOf(grade, outstanding),
    final: grade === 'final',
  };
}

/**
 * What an open ledger means for the figures, said in the banner rather than left to be inferred.
 *
 * The sentence a controller would otherwise write by hand in the covering email — and the reason this
 * banner sits above the numbers rather than below them.
 */
function consequenceOf(grade: CloseGrade, outstanding: readonly OutstandingLedger[]): string {
  if (grade === 'final') {
    return 'Every ledger is closed, so the figures below will not move for this period.';
  }
  const names = outstanding.map((ledger) => ledger.entityName).join(', ');
  const one = outstanding.length === 1;
  return (
    `The figures below are not wrong; they are not final. ${names} ` +
    `${one ? 'is' : 'are'} still open, so anything ${one ? 'it contributes' : 'they contribute'} may move` +
    (grade === 'at_risk'
      ? ` — and the expected close is past the group's ${ordinal(GROUP_CLOSE_DAY)}, so this is a schedule exception rather than a normal wait.`
      : ' before the group close date.')
  );
}

function ordinal(day: number): string {
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  return `${day}${suffix}`;
}

/**
 * The legacy one-liner, kept because the narration cache and the deterministic prose both read it.
 *
 * Left as its own function rather than folded into `accountingStatus`: the committed narration was
 * generated against this exact wording, and `narration.test.ts` compares the pinned projection against a
 * fresh run. Changing the sentence here would fail that test for a reason that has nothing to do with
 * the figures — so the banner gets the richer projection and the cached prose keeps its own.
 */
export interface CloseStatusCopy {
  readonly summary: string;
  readonly detail?: string;
  readonly final: boolean;
}

export function closeStatusCopy({
  closed,
  total,
  openNames,
}: {
  readonly closed: number;
  readonly total: number;
  readonly openNames: readonly string[];
}): CloseStatusCopy {
  const final = total > 0 && closed === total && openNames.length === 0;
  const noun = total === 1 ? 'ledger' : 'ledgers';
  const summary = `${closed}/${total} ${noun} closed — period ${final ? 'final' : 'not final'}.`;

  if (final || openNames.length === 0) return { summary, final };

  return {
    summary,
    detail:
      `Outstanding: ${openNames.join(', ')} ` +
      `${openNames.length === 1 ? 'has' : 'have'} submitted but not closed.`,
    final,
  };
}
