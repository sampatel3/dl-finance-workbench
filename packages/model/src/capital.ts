/**
 * Capital projects, purchase orders and suppliers — a register beside the ledger, not inside it.
 *
 * The review adds this section with a specific argument: *"CAPEX can distort cash and Balance Sheet
 * movements"*, and *"procurement commitments often create future cash pressure before invoices
 * arrive"*. The second half is the reason this file exists at all.
 *
 * ## A commitment is not a posting, and modelling it as one loses the point
 *
 * Everything else in this product is a fact: a posted amount at a slice, summing across dimensions.
 * A purchase order is not. It is a promise to pay that has produced **no accounting entry** — that is
 * precisely what makes it worth a page, because the cash it will consume is invisible in the ledger
 * until an invoice arrives and by then the decision has been taken. Forcing commitments into the fact
 * table would either overstate the profit and loss or require an offsetting fiction.
 *
 * So they live here, in a register, with the same shape as the vintage and close-position registers:
 * modelled, stated, owned, and dated.
 *
 * ## The register has to reconcile, and the surface shows it
 *
 * A project register in a real business is a different system from the general ledger, and the number
 * one control a capital accountant runs is the reconciliation between them. So the projects here carry
 * their own spend to date, and the analysis layer compares the register's total against the ledger's
 * `capex` for the same window and **names the residual** rather than hiding it. Capital spend that has
 * not been assigned to a project is a real finding — it is how an asset gets capitalised against
 * nothing anybody owns.
 *
 * The residual is deliberately non-zero in this seed, for the same reason the unmapped accounts are.
 */

import type { FiscalMonth } from './period.ts';

export type ProjectStatus =
  /** Approved and spending. */
  | 'in_flight'
  /** Spending stopped pending a decision. The budget is still committed. */
  | 'on_hold'
  /** Delivered and closed to fixed assets. */
  | 'complete';

export interface CapitalProject {
  readonly id: string;
  readonly name: string;
  readonly entityId: string;
  /** Named, because a capital project without an owner is a budget line. */
  readonly owner: string;
  readonly status: ProjectStatus;
  readonly approvedBudgetMinor: number;
  /** Board or delegated-authority approval, stated. */
  readonly approvedBy: string;
  readonly approvedAt: string;
  /** Spent and posted to date, per the register. */
  readonly spentToDateMinor: number;
  /**
   * Ordered and not yet invoiced.
   *
   * The number that makes this page worth reading: it is cash the business has agreed to spend and
   * which appears nowhere in the profit and loss, the balance sheet or the cash ledger.
   */
  readonly committedMinor: number;
  /** What finishing it is expected to take from here, per the project manager. */
  readonly forecastToCompleteMinor: number;
  readonly startMonth: FiscalMonth;
  readonly expectedCompleteMonth: FiscalMonth;
  /** One line a reader can act on, where there is one. */
  readonly note?: string;
}

/**
 * The projects the demo holds.
 *
 * **The register is sized to the business.** The first cut was not: the four 2026 projects claimed
 * £3.1m of spend against a group that had posted £2.3m of capital in the same seven months, so the
 * reconciliation ran backwards and reported the register claiming spend the ledger had never seen.
 * That is a real finding in the wild and the wrong one to plant here — the interesting failure is the
 * other direction, and a register that cannot fit inside its own business is just wrong.
 *
 * Three conditions are planted, and each is a thing a capital review actually finds:
 *
 *   **A project that will overrun.** Spend plus forecast-to-complete exceeds the approved budget, and
 *   it is visible now rather than at completion.
 *
 *   **A project on hold still holding its budget.** The commitment has not been released, so the money
 *   is unavailable to anything else and nobody has decided anything.
 *
 *   **Spend the register cannot place.** The ledger's capital spend exceeds the sum of the projects,
 *   which is the reconciliation the surface names rather than hides.
 */
export const CAPITAL_PROJECTS: readonly CapitalProject[] = [
  {
    id: 'line-4',
    name: 'Production line 4 — automation',
    entityId: 'manufacturing',
    owner: 'Operations Director',
    status: 'in_flight',
    approvedBudgetMinor: 1_500_000_00,
    approvedBy: 'Board, capital paper CP-24-03',
    approvedAt: '2025-11-18',
    spentToDateMinor: 900_000_00,
    committedMinor: 486_000_00,
    // 900 + 486 + 200 = 1,586 against 1,500. The overrun is visible now, not at handover.
    forecastToCompleteMinor: 200_000_00,
    startMonth: '2026-01',
    expectedCompleteMonth: '2026-11',
    note: 'Commissioning slipped a quarter after the controls package was re-specified.',
  },
  {
    id: 'gulf-depot',
    name: 'Gulf service depot fit-out',
    entityId: 'gulf',
    owner: 'Business-unit Controller, Kestrel Gulf',
    status: 'in_flight',
    approvedBudgetMinor: 800_000_00,
    approvedBy: 'Chief Financial Officer, delegated authority',
    approvedAt: '2026-02-04',
    spentToDateMinor: 380_000_00,
    committedMinor: 295_000_00,
    forecastToCompleteMinor: 90_000_00,
    startMonth: '2026-03',
    expectedCompleteMonth: '2026-10',
  },
  {
    id: 'erp-phase2',
    name: 'Finance systems — phase 2',
    entityId: 'group',
    owner: 'Group Financial Controller',
    status: 'on_hold',
    approvedBudgetMinor: 560_000_00,
    approvedBy: 'Board, capital paper CP-25-11',
    approvedAt: '2026-01-27',
    spentToDateMinor: 130_000_00,
    committedMinor: 180_000_00,
    forecastToCompleteMinor: 240_000_00,
    startMonth: '2026-02',
    expectedCompleteMonth: '2027-03',
    note: 'Paused pending the operating-model review. The commitment has not been released, so the budget is unavailable to anything else.',
  },
  {
    id: 'fleet-26',
    name: 'Field service fleet replacement',
    entityId: 'services',
    owner: 'Services Director',
    status: 'in_flight',
    approvedBudgetMinor: 500_000_00,
    approvedBy: 'Chief Financial Officer, delegated authority',
    approvedAt: '2025-12-09',
    spentToDateMinor: 250_000_00,
    committedMinor: 96_000_00,
    forecastToCompleteMinor: 120_000_00,
    startMonth: '2026-01',
    expectedCompleteMonth: '2026-09',
  },
  {
    id: 'europe-tooling',
    name: 'Europe tooling refresh',
    entityId: 'europe',
    owner: 'Engineering Director',
    status: 'complete',
    approvedBudgetMinor: 320_000_00,
    approvedBy: 'Chief Financial Officer, delegated authority',
    approvedAt: '2025-09-15',
    spentToDateMinor: 308_000_00,
    committedMinor: 0,
    forecastToCompleteMinor: 0,
    startMonth: '2025-10',
    expectedCompleteMonth: '2026-04',
  },
];

// ---------------------------------------------------------------------------
// Procurement
// ---------------------------------------------------------------------------

export interface Supplier {
  readonly id: string;
  readonly name: string;
  /** Whether spend with them runs under a negotiated contract or off it. */
  readonly contracted: boolean;
  /** Where a contract exists, when it lapses — because a contract nobody renewed is leakage next month. */
  readonly contractEnds?: FiscalMonth;
  readonly category: string;
}

export const SUPPLIERS: readonly Supplier[] = [
  { id: 'axeon', name: 'Axeon Automation GmbH', contracted: true, contractEnds: '2027-03', category: 'Capital equipment' },
  { id: 'meridian', name: 'Meridian Fit-Out LLC', contracted: true, contractEnds: '2026-09', category: 'Construction' },
  { id: 'northgate', name: 'Northgate Fleet Services', contracted: true, contractEnds: '2028-01', category: 'Fleet' },
  { id: 'talos', name: 'Talos Consulting', contracted: false, category: 'Professional services' },
  { id: 'brightpath', name: 'Brightpath Software Ltd', contracted: true, contractEnds: '2026-08', category: 'Software' },
  { id: 'kestrel-misc', name: 'Various, below threshold', contracted: false, category: 'Sundry' },
];

export type PoStatus = 'open' | 'part_received' | 'received_not_invoiced';

export interface PurchaseOrder {
  readonly id: string;
  readonly supplierId: string;
  /** Absent where the order is operating spend rather than capital. */
  readonly projectId?: string;
  readonly entityId: string;
  readonly raisedAt: string;
  readonly raisedBy: string;
  readonly valueMinor: number;
  /** Of the value, what is still to be paid. */
  readonly outstandingMinor: number;
  readonly status: PoStatus;
  /** The week of the thirteen-week horizon the payment is expected to land in, 1-indexed. */
  readonly expectedPaymentWeek: number;
  readonly description: string;
}

/**
 * The open order book.
 *
 * Weighted towards two suppliers on purpose. Concentration is one of the six things the review asks
 * this section to show, and a register spread evenly across six vendors demonstrates the column
 * without ever exercising it.
 */
export const PURCHASE_ORDERS: readonly PurchaseOrder[] = [
  {
    id: 'PO-26-0412',
    supplierId: 'axeon',
    projectId: 'line-4',
    entityId: 'manufacturing',
    raisedAt: '2026-05-12',
    raisedBy: 'Operations Director',
    valueMinor: 486_000_00,
    outstandingMinor: 486_000_00,
    status: 'open',
    expectedPaymentWeek: 6,
    description: 'Controls package and commissioning',
  },
  {
    id: 'PO-26-0455',
    supplierId: 'meridian',
    projectId: 'gulf-depot',
    entityId: 'gulf',
    raisedAt: '2026-06-02',
    raisedBy: 'Business-unit Controller, Kestrel Gulf',
    valueMinor: 295_000_00,
    outstandingMinor: 295_000_00,
    status: 'part_received',
    expectedPaymentWeek: 4,
    description: 'Depot mechanical and electrical fit-out',
  },
  {
    id: 'PO-26-0470',
    supplierId: 'brightpath',
    projectId: 'erp-phase2',
    entityId: 'group',
    raisedAt: '2026-03-19',
    raisedBy: 'Group Financial Controller',
    valueMinor: 180_000_00,
    outstandingMinor: 180_000_00,
    status: 'open',
    expectedPaymentWeek: 11,
    description: 'Licences and implementation, phase 2 — order not cancelled while the project is on hold',
  },
  {
    id: 'PO-26-0488',
    supplierId: 'northgate',
    projectId: 'fleet-26',
    entityId: 'services',
    raisedAt: '2026-06-24',
    raisedBy: 'Services Director',
    valueMinor: 96_000_00,
    outstandingMinor: 96_000_00,
    status: 'received_not_invoiced',
    expectedPaymentWeek: 2,
    description: 'Final tranche of eight vehicles — delivered, not yet invoiced',
  },
  {
    id: 'PO-26-0491',
    supplierId: 'talos',
    entityId: 'group',
    raisedAt: '2026-07-01',
    raisedBy: 'Group Financial Controller',
    valueMinor: 142_000_00,
    outstandingMinor: 142_000_00,
    status: 'open',
    expectedPaymentWeek: 5,
    description: 'Operating-model review — no framework agreement in place',
  },
  {
    id: 'PO-26-0494',
    supplierId: 'kestrel-misc',
    entityId: 'services',
    raisedAt: '2026-07-08',
    raisedBy: 'Various',
    valueMinor: 61_000_00,
    outstandingMinor: 61_000_00,
    status: 'open',
    expectedPaymentWeek: 3,
    description: 'Sundry orders below the single-supplier threshold',
  },
];

export function project(id: string): CapitalProject {
  const found = CAPITAL_PROJECTS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`Unknown capital project: ${id}`);
  return found;
}

export function supplier(id: string): Supplier {
  const found = SUPPLIERS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`Unknown supplier: ${id}`);
  return found;
}
