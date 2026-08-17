/**
 * Ledger codes created during the month, and who has to look at them.
 *
 * The review calls this *"a vital monthly control point"*, and it is a different thing from the unmapped
 * exception the mapping panel already shows. The distinction is the whole reason this file exists:
 *
 *   An **unmapped** code has already arrived carrying value, and the money is sitting in a line nobody
 *   owns. It is a problem being reported.
 *
 *   A **new** code has been created and may map perfectly well. Most do. What matters is that somebody
 *   in Finance knows it appeared *before* it starts carrying value, because the alternative is finding
 *   out three months later when a comparative does not agree with itself.
 *
 * So a new code is not an error and is not rendered as one. It is a queue with a deadline: authorised or
 * not, mapped or not, reviewed or not — and the review's own worry, *"unauthorised codes can break
 * mapping, reporting and comparability"*, is exactly the case where those three answers differ.
 *
 * ## The alert is modelled, and says so
 *
 * The review asks for an email to the Financial Controller. What is modelled here is the **shape** of
 * that alert: a recipient, a deadline, and the risk if it passes unreviewed. No message is sent, no
 * mailbox is dialled, and the Controls surface states that rather than implying a working integration.
 * A demo that appeared to send email would be making a claim about a system nobody has built.
 */

import { entity } from './entities.ts';
import type { FiscalMonth } from './period.ts';

/** Where a new code stands with the mapping set. */
export type CodeMappingState =
  /** Placed in the mapping set and flowing to a canonical account. */
  | 'mapped'
  /** Arrived with nothing to place it. This is the one that costs money silently. */
  | 'unmapped'
  /** A mapping is proposed and not yet approved. */
  | 'pending_review';

export interface NewGlCode {
  readonly sourceCode: string;
  readonly label: string;
  readonly entityId: string;
  /** Profit and loss, balance sheet, or a statistical account. */
  readonly accountType: 'pl' | 'bs' | 'stat';
  /** The month it first appeared in a load. */
  readonly createdIn: FiscalMonth;
  /** Stated, never read from a clock. */
  readonly createdAt: string;
  /** Who created it in the source ledger. A code with no creator is a code nobody can ask about. */
  readonly createdBy: string;
  /**
   * Whether its creation followed the chart-of-accounts standard.
   *
   * Authorisation and mapping are independent, which is the point of holding both: an authorised code
   * can still be unmapped, and an unauthorised one can map perfectly and still be a control failure.
   */
  readonly authorised: boolean;
  readonly mapping: CodeMappingState;
  /** Value posted to it so far, in minor units. Zero for a code created and not yet used. */
  readonly postedMinor: number;
  /** One line on why it exists, in the words the creator used. */
  readonly note?: string;
}

/**
 * The codes created in the closing month.
 *
 * Three of them, and the mix is the argument: one ordinary and authorised, one authorised and still
 * unmapped, and one created outside the standard. A month with only clean codes would show a control
 * that has never had to do anything; a month with only bad ones would be a demo about a broken finance
 * function rather than about a control that works.
 *
 * The two unmapped codes are the same two the mapping panel reports, by source code — so the GL-code
 * control and the mapping exception are two readings of one fact rather than two lists that happen to
 * agree today.
 */
export const NEW_GL_CODES: readonly NewGlCode[] = [
  {
    sourceCode: '58420',
    label: 'Subcontract labour — framework',
    entityId: 'services',
    accountType: 'pl',
    createdIn: '2026-07',
    createdAt: '2026-07-03T11:20:00Z',
    createdBy: 'A. Whitfield, Services Finance',
    authorised: true,
    mapping: 'unmapped',
    postedMinor: 148_000_00,
    note: 'Opened for the new framework agreement; mapping request raised with group.',
  },
  {
    sourceCode: '61155',
    label: 'Software subscriptions',
    entityId: 'manufacturing',
    accountType: 'pl',
    createdIn: '2026-07',
    createdAt: '2026-07-09T08:05:00Z',
    createdBy: 'IT shared services',
    // The one the review is worried about: created outside the standard, and already carrying value.
    authorised: false,
    mapping: 'unmapped',
    postedMinor: 64_000_00,
    note: 'Created in the source ledger without a chart-of-accounts request. No mapping proposed.',
  },
  {
    sourceCode: '21460',
    label: 'Accrued rebates payable',
    entityId: 'manufacturing',
    accountType: 'bs',
    createdIn: '2026-07',
    createdAt: '2026-07-15T14:40:00Z',
    createdBy: 'M. Adeyemi, Group Financial Control',
    authorised: true,
    mapping: 'pending_review',
    postedMinor: 0,
    note: 'Requested ahead of the rebate season; mapping drafted and awaiting approval.',
  },
];

/**
 * The alert the Financial Controller receives when codes are created.
 *
 * Modelled, not sent. The fields are the ones that make an alert actionable rather than informational:
 * who has to act, by when, and what happens if nobody does. An alert without a deadline is a
 * notification, and a notification about a control is one nobody actions.
 */
export interface CodeAlert {
  readonly recipient: string;
  readonly raisedAt: string;
  /** Working days from creation to review, per the control standard. */
  readonly reviewWindowDays: number;
  readonly dueBy: string;
  /** What goes wrong if the window passes. Stated, because "please review" is not a reason. */
  readonly risk: string;
  /** True where this demo would have sent it. It does not, and the surface says so. */
  readonly sent: false;
}

export const CODE_REVIEW_WINDOW_DAYS = 5;

export function codeAlertFor(month: FiscalMonth): CodeAlert {
  return {
    recipient: 'Group Financial Controller',
    raisedAt: `${month}-03T06:00:00Z`,
    reviewWindowDays: CODE_REVIEW_WINDOW_DAYS,
    dueBy: `${month}-10T17:00:00Z`,
    risk:
      'A code that reaches the ledger without a mapping still reaches the reported profit and loss ' +
      '— it lands on the unmapped line rather than the line it belongs on, so the total is right ' +
      'and the split is wrong — and one created outside the standard breaks comparability with the ' +
      'prior year. Both are cheap to fix in the month they appear and expensive to fix at year end.',
    sent: false,
  };
}

export interface GlCodeControl {
  readonly month: FiscalMonth;
  readonly codes: readonly (NewGlCode & { readonly entityName: string })[];
  readonly created: number;
  readonly unauthorised: number;
  readonly unmapped: number;
  readonly pending: number;
  /** Value already posted to codes that are not fully placed and approved. */
  readonly atRiskMinor: number;
  readonly alert: CodeAlert;
}

/**
 * The control for one month, scoped to the entities a session can read.
 *
 * `atRisk` counts value on any code that is either unauthorised or not mapped — not the intersection.
 * A code can fail either test independently and either failure puts its balance somewhere a reader
 * cannot rely on, so requiring both would report the smaller number and call it the exposure.
 */
export function glCodeControl(month: FiscalMonth, entityIds?: readonly string[]): GlCodeControl {
  const visible = entityIds === undefined ? null : new Set(entityIds);
  const codes = NEW_GL_CODES.filter(
    (code) => code.createdIn === month && (visible === null || visible.has(code.entityId)),
  ).map((code) => ({ ...code, entityName: entity(code.entityId).name }));

  const atRisk = codes.filter((code) => !code.authorised || code.mapping !== 'mapped');

  return {
    month,
    codes,
    created: codes.length,
    unauthorised: codes.filter((code) => !code.authorised).length,
    unmapped: codes.filter((code) => code.mapping === 'unmapped').length,
    pending: codes.filter((code) => code.mapping === 'pending_review').length,
    atRiskMinor: atRisk.reduce((sum, code) => sum + code.postedMinor, 0),
    alert: codeAlertFor(month),
  };
}
