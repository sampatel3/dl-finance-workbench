/**
 * Capital projects and procurement commitments, reconciled to the ledger.
 *
 * The review's argument for the section: *"CAPEX can distort cash and Balance Sheet movements"*, and
 * *"procurement commitments often create future cash pressure before invoices arrive"*. It asks for
 * approved budget, committed spend, actual to date, forecast to complete, remaining budget and
 * variance, project owner and status — and on the procurement side, orders against budget, supplier
 * commitments, contracted against non-contracted spend, upcoming major payments, leakage, and supplier
 * concentration.
 *
 * ## The two numbers that make this a page rather than a table
 *
 * **Committed but not invoiced.** Cash the business has agreed to spend that appears in no ledger. It
 * is the whole reason a treasurer reads a procurement report, and the reason the commitments here are
 * mapped onto the same thirteen-week horizon the cash surface uses — so the payment shows up before
 * the invoice does rather than after.
 *
 * **The reconciliation residual.** A project register is a different system from the general ledger,
 * and the control a capital accountant runs every month is the difference between them. So the ledger's
 * own capital spend is computed here and compared against the register's, and the difference is
 * **named** — capital spend not assigned to any project is how an asset gets capitalised against
 * nothing anybody owns.
 *
 * ## What is measured versus what is stated
 *
 * Budgets, approvals, owners and forecasts-to-complete are stated: they are decisions, not arithmetic,
 * and deriving them would be inventing them. Everything that can be computed is — variance, exposure,
 * concentration, leakage, the reconciliation — and the surface distinguishes the two.
 */

import type { CapitalProject, FiscalMonth, PurchaseOrder } from '@kestrel/model';
import {
  CAPITAL_PROJECTS,
  PURCHASE_ORDERS,
  entity,
  subtree,
  supplier as supplierById,
} from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { computeMeasure, formatValue } from '@kestrel/measures';

/** The share of committed spend with one supplier at which concentration becomes a finding. */
export const CONCENTRATION_THRESHOLD = 0.3;

/**
 * How much of an approval has to be spent or committed before a project is at risk.
 *
 * Ninety-eight per cent, and it started at ninety-five — which flagged three of the four in-flight
 * projects, so the column said "at risk" about almost everything and therefore about nothing. What a
 * capital review wants named is a project with **no room left**: less than two per cent of its
 * approval uncommitted is a conversation this month, and five per cent is still a quarter's headroom
 * on most of these.
 */
export const AT_RISK_CONSUMED = 0.98;

export type ProjectVerdict = 'within_budget' | 'at_risk' | 'over_budget' | 'closed';

export interface ProjectRow {
  readonly project: CapitalProject;
  readonly entityName: string;
  /** Spent plus committed plus forecast to complete: what the project will have cost. */
  readonly expectedTotalMinor: number;
  /** Approved budget less expected total. Negative is an overrun. */
  readonly remainingMinor: number;
  readonly variancePercent: number | null;
  readonly verdict: ProjectVerdict;
  /** One sentence naming the position, written from the figures. */
  readonly statement: string;
}

export interface SupplierRow {
  readonly supplierId: string;
  readonly name: string;
  readonly category: string;
  readonly contracted: boolean;
  readonly contractEnds?: FiscalMonth;
  readonly committedMinor: number;
  readonly share: number;
  readonly orders: number;
}

export interface UpcomingPayment {
  readonly order: PurchaseOrder;
  readonly supplierName: string;
  readonly week: number;
  readonly amountMinor: number;
  readonly contracted: boolean;
}

export interface Reconciliation {
  /** The ledger's capital spend for the selected window. */
  readonly ledgerMinor: number;
  /** What the project register accounts for in the same window. */
  readonly registerMinor: number;
  readonly residualMinor: number;
  readonly statement: string;
}

export interface Capital {
  readonly projects: readonly ProjectRow[];
  readonly totalApprovedMinor: number;
  readonly totalSpentMinor: number;
  readonly totalCommittedMinor: number;
  readonly totalExpectedMinor: number;
  readonly suppliers: readonly SupplierRow[];
  /** Committed spend with no contract behind it. */
  readonly leakageMinor: number;
  readonly leakageShare: number;
  /** The largest single-supplier share, and whether it clears the policy. */
  readonly concentration: { readonly share: number; readonly name: string; readonly breach: boolean };
  readonly upcoming: readonly UpcomingPayment[];
  readonly reconciliation: Reconciliation;
  /** The paragraph a board pack would carry. Composed from the rows above. */
  readonly statement: string;
}

const money = (minor: number): string => formatValue(Math.abs(minor), 'currency');

/**
 * Where a project will land against the money that was approved for it.
 *
 * `expectedTotal` includes the **commitment**, not only the spend. A project 75% through its budget
 * with an order out for the remaining quarter has no headroom, and a report that showed only spend
 * would call it comfortable.
 */
function rowFor(project: CapitalProject): ProjectRow {
  const expectedTotalMinor =
    project.spentToDateMinor + project.committedMinor + project.forecastToCompleteMinor;
  const remainingMinor = project.approvedBudgetMinor - expectedTotalMinor;
  const variancePercent =
    project.approvedBudgetMinor === 0 ? null : -remainingMinor / project.approvedBudgetMinor;

  /* At risk before over budget: a project with no room left is a conversation now, and one that only
     becomes a finding at 100% is a finding that arrives too late to act on. */
  const verdict: ProjectVerdict =
    project.status === 'complete'
      ? 'closed'
      : remainingMinor < 0
        ? 'over_budget'
        : expectedTotalMinor / Math.max(1, project.approvedBudgetMinor) > AT_RISK_CONSUMED
          ? 'at_risk'
          : 'within_budget';

  const statement =
    verdict === 'over_budget'
      ? `Spend, commitments and the forecast to complete total ${money(expectedTotalMinor)} against an ` +
        `approved ${money(project.approvedBudgetMinor)} — ${money(remainingMinor)} over, and visible now ` +
        'rather than at handover.'
      : verdict === 'at_risk'
        ? `${money(remainingMinor)} of the approval is left after commitments — under ` +
          `${((1 - AT_RISK_CONSUMED) * 100).toFixed(0)} per cent of it, and there is no room for a ` +
          'variation order.'
        : verdict === 'closed'
          ? `Closed at ${money(project.spentToDateMinor)} against an approved ${money(project.approvedBudgetMinor)}.`
          : `${money(remainingMinor)} of the approval is unspent and uncommitted.`;

  return {
    project,
    entityName: entity(project.entityId).name,
    expectedTotalMinor,
    remainingMinor,
    variancePercent,
    verdict,
    statement,
  };
}

/**
 * Capital and procurement for the entities this principal may read.
 *
 * Scoped the same way every other surface is. A business-unit controller sees their own projects and
 * their own suppliers' commitments, and the group's concentration is computed over what they can see —
 * a concentration percentage over a book a reader cannot inspect is a number they cannot check.
 */
export function buildCapital(ctx: MeasureContext): Capital {
  const readable = new Set(ctx.entityIds);
  /**
   * A project or order at entity X is readable only where the principal's scope covers **all** of X.
   *
   * `every`, not `some`, and the difference is a leak. A group-level project — the finance systems
   * programme — sits at `group`, whose subtree includes Gulf; under `some`, a Gulf-only controller
   * could read a group capital programme and the commitments on it. `every` asks the right question:
   * can this principal see the whole of what this project belongs to?
   */
  const visible = (entityId: string): boolean =>
    subtree(entityId).every((candidate) => readable.has(candidate));

  const projects = CAPITAL_PROJECTS.filter((candidate) => visible(candidate.entityId))
    .map(rowFor)
    .sort((a, b) => a.remainingMinor - b.remainingMinor);

  const orders = PURCHASE_ORDERS.filter((order) => visible(order.entityId));
  const totalCommittedMinor = orders.reduce((sum, order) => sum + order.outstandingMinor, 0);

  const bySupplier = new Map<string, { committed: number; orders: number }>();
  for (const order of orders) {
    const held = bySupplier.get(order.supplierId) ?? { committed: 0, orders: 0 };
    bySupplier.set(order.supplierId, {
      committed: held.committed + order.outstandingMinor,
      orders: held.orders + 1,
    });
  }

  const suppliers = [...bySupplier.entries()]
    .map(([id, held]): SupplierRow => {
      const record = supplierById(id);
      return {
        supplierId: id,
        name: record.name,
        category: record.category,
        contracted: record.contracted,
        ...(record.contractEnds === undefined ? {} : { contractEnds: record.contractEnds }),
        committedMinor: held.committed,
        share: totalCommittedMinor === 0 ? 0 : held.committed / totalCommittedMinor,
        orders: held.orders,
      };
    })
    .sort((a, b) => b.committedMinor - a.committedMinor);

  const leakageMinor = suppliers
    .filter((row) => !row.contracted)
    .reduce((sum, row) => sum + row.committedMinor, 0);
  const top = suppliers[0];

  const upcoming = orders
    .map((order): UpcomingPayment => ({
      order,
      supplierName: supplierById(order.supplierId).name,
      week: order.expectedPaymentWeek,
      amountMinor: order.outstandingMinor,
      contracted: supplierById(order.supplierId).contracted,
    }))
    .sort((a, b) => a.week - b.week);

  const reconciliation = reconcile(ctx, projects);

  const totalApprovedMinor = projects.reduce(
    (sum, row) => sum + row.project.approvedBudgetMinor,
    0,
  );
  const totalSpentMinor = projects.reduce((sum, row) => sum + row.project.spentToDateMinor, 0);
  const totalExpectedMinor = projects.reduce((sum, row) => sum + row.expectedTotalMinor, 0);
  const over = projects.filter((row) => row.verdict === 'over_budget');
  const concentrationShare = top?.share ?? 0;

  return {
    projects,
    totalApprovedMinor,
    totalSpentMinor,
    totalCommittedMinor,
    totalExpectedMinor,
    suppliers,
    leakageMinor,
    leakageShare: totalCommittedMinor === 0 ? 0 : leakageMinor / totalCommittedMinor,
    concentration: {
      share: concentrationShare,
      name: top?.name ?? '—',
      breach: concentrationShare > CONCENTRATION_THRESHOLD,
    },
    upcoming,
    reconciliation,
    statement:
      `${money(totalCommittedMinor)} is committed and not yet invoiced, which is cash the business has ` +
      `agreed to spend and which appears in no ledger. ` +
      (over.length === 0
        ? 'No project is forecast beyond its approval.'
        : `${over.length === 1 ? 'One project is' : `${over.length} projects are`} forecast beyond ` +
          `approval — ${over.map((row) => row.project.name).join(', ')}.`) +
      ` ${money(leakageMinor)} of the commitment sits with suppliers who have no contract behind them.`,
  };
}

/**
 * The register against the ledger.
 *
 * The comparison is over the **fiscal year to the reporting boundary** rather than over the selected
 * month, because a project register accumulates and a month's capital spend is a slice of it. Comparing
 * a cumulative register total to one month's ledger posting would produce a residual the size of the
 * register and a control finding every month, which is the same as having no control.
 */
function reconcile(ctx: MeasureContext, projects: readonly ProjectRow[]): Reconciliation {
  const yearStart = `${ctx.scope.endMonth.slice(0, 4)}-01` as FiscalMonth;
  const ledgerMinor =
    computeMeasure('capex', {
      ...ctx,
      scope: {
        type: 'YTD',
        startMonth: yearStart,
        endMonth: ctx.scope.endMonth,
        label: 'ytd',
      },
    }).value ?? 0;

  /* Only what the register says was spent inside this fiscal year. A project that started last October
     carries spend the current year's ledger never saw. */
  const registerMinor = projects
    .filter((row) => row.project.startMonth >= yearStart)
    .reduce((sum, row) => sum + row.project.spentToDateMinor, 0);
  const residualMinor = ledgerMinor - registerMinor;

  return {
    ledgerMinor,
    registerMinor,
    residualMinor,
    statement:
      Math.abs(residualMinor) < 1_000_00
        ? `The register accounts for the ledger's ${money(ledgerMinor)} of capital spend this year.`
        : residualMinor > 0
          ? `The ledger carries ${money(ledgerMinor)} of capital spend this year and the register ` +
            `accounts for ${money(registerMinor)} of it. ${money(residualMinor)} is capitalised ` +
            'against no project — which is how an asset ends up owned by nobody, and it is a ' +
            'controllership finding rather than a rounding difference.'
          : `The register claims ${money(registerMinor)} of spend this year against the ledger's ` +
            `${money(ledgerMinor)}. ${money(residualMinor)} has been recorded on a project and not ` +
            'posted, so either an invoice is missing or a project is reporting spend it has not made.',
  };
}
