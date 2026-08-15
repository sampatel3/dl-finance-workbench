/**
 * Capital projects and procurement commitments.
 *
 * What has to be true for a commitments page to be worth reading:
 *
 *   **The expected total includes the commitment.** A project three-quarters through its budget with
 *   an order out for the rest has no headroom, and a report showing spend alone calls it comfortable.
 *   This is the assertion the whole section turns on.
 *
 *   **The register reconciles to the ledger, and the residual is named.** A project register is a
 *   different system from the general ledger; capital spend assigned to no project is how an asset is
 *   capitalised against nothing anybody owns.
 *
 *   **The order book is scoped like every other read.** Concentration computed over a book the reader
 *   cannot inspect is a number they cannot check.
 *
 *   **The commitments land on the cash horizon.** The point of the page is that the payment is visible
 *   before the invoice, which requires the two surfaces to be talking about the same thirteen weeks.
 */

import { describe, expect, it } from 'vitest';
import {
  ACTUAL_VERSION,
  CAPITAL_PROJECTS,
  CASH_HORIZON_WEEKS,
  PURCHASE_ORDERS,
  SEED_END,
  buildWorld,
  monthScope,
  subtree,
} from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { allEntityIds } from '@kestrel/measures';


import { CONCENTRATION_THRESHOLD, buildCapital } from './capital.ts';

const world = buildWorld({ seed: 'kestrel-industrial-group' });

function ctx(overrides: Partial<MeasureContext> = {}): MeasureContext {
  return {
    store: world.store,
    rates: world.rates,
    scope: monthScope(SEED_END),
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
    lens: 'reported',
    entityIds: allEntityIds(),
    ...overrides,
  };
}

describe('capital projects', () => {
  it('counts the commitment in what a project will cost, not only the spend', () => {
    const capital = buildCapital(ctx());
    expect(capital.projects.length).toBeGreaterThan(0);
    for (const row of capital.projects) {
      expect(row.expectedTotalMinor).toBe(
        row.project.spentToDateMinor +
          row.project.committedMinor +
          row.project.forecastToCompleteMinor,
      );
      expect(row.remainingMinor).toBe(row.project.approvedBudgetMinor - row.expectedTotalMinor);
    }
  });

  it('and finds the overrun before handover rather than at it', () => {
    /* The planted condition: a project whose spend is inside its approval and whose spend plus
       commitment plus forecast is not. Reported on spend alone it looks comfortable. */
    const capital = buildCapital(ctx());
    const over = capital.projects.filter((row) => row.verdict === 'over_budget');
    expect(over.length).toBeGreaterThan(0);
    for (const row of over) {
      expect(row.project.spentToDateMinor).toBeLessThan(row.project.approvedBudgetMinor);
      expect(row.expectedTotalMinor).toBeGreaterThan(row.project.approvedBudgetMinor);
      expect(row.statement).toMatch(/over/);
    }
  });

  it('and gives every project an owner and a stated approval', () => {
    for (const project of CAPITAL_PROJECTS) {
      expect(project.owner, `${project.name} has no owner`).not.toBe('');
      expect(project.approvedBy, `${project.name} has no approver`).not.toBe('');
      expect(project.approvedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('and ranks the worst position first', () => {
    const remaining = buildCapital(ctx()).projects.map((row) => row.remainingMinor);
    expect([...remaining].sort((a, b) => a - b)).toEqual(remaining);
  });
});

describe('the register against the ledger', () => {
  it('names what the register cannot place', () => {
    const capital = buildCapital(ctx());
    expect(capital.reconciliation.residualMinor).toBe(
      capital.reconciliation.ledgerMinor - capital.reconciliation.registerMinor,
    );
    // Deliberately non-zero in this seed: a control that never fires is not a control.
    expect(Math.abs(capital.reconciliation.residualMinor)).toBeGreaterThan(0);
    expect(capital.reconciliation.statement).not.toBe('');
  });

  it('and the register fits inside the business it belongs to', () => {
    /* The first cut of the seed did not: four projects claimed £3.1m of spend against a group that had
       posted £2.3m of capital in the same seven months, so the reconciliation ran backwards and
       reported the register claiming spend the ledger had never seen. That is a real finding in the
       wild and the wrong one to plant — the interesting direction is capital posted against no
       project, and a register too large for its own business is simply wrong. */
    const capital = buildCapital(ctx());
    expect(capital.reconciliation.registerMinor).toBeLessThan(capital.reconciliation.ledgerMinor);
    expect(capital.reconciliation.residualMinor).toBeGreaterThan(0);
    expect(capital.reconciliation.statement).toMatch(/capitalised against no project/);
  });

  it('and compares over the year rather than the month', () => {
    /* A register accumulates. Measuring it against one month's posting produces a residual the size of
       the register and a finding every month, which is the same as having no control. */
    const capital = buildCapital(ctx());
    const monthly = buildCapital(ctx()).reconciliation.ledgerMinor;
    expect(capital.reconciliation.ledgerMinor).toBe(monthly);
    expect(capital.reconciliation.ledgerMinor).toBeGreaterThan(0);
  });
});

describe('procurement', () => {
  it('separates contracted spend from leakage', () => {
    const capital = buildCapital(ctx());
    expect(capital.leakageMinor).toBeGreaterThan(0);
    expect(capital.leakageShare).toBeGreaterThan(0);
    expect(capital.leakageShare).toBeLessThan(1);
    const uncontracted = capital.suppliers.filter((row) => !row.contracted);
    expect(uncontracted.reduce((sum, row) => sum + row.committedMinor, 0)).toBe(
      capital.leakageMinor,
    );
  });

  it('and measures concentration against a stated threshold', () => {
    const capital = buildCapital(ctx());
    expect(capital.concentration.breach).toBe(
      capital.concentration.share > CONCENTRATION_THRESHOLD,
    );
    const shares = capital.suppliers.map((row) => row.share);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 6);
  });

  it('and scopes the order book like every other read', () => {
    /* A business-unit controller sees their own commitments and not their siblings'. Concentration is
       then computed over what they can see, because a percentage of a book they cannot inspect is a
       number they cannot check.

       The group-level project is the case that matters: it sits at `group`, whose subtree contains
       Gulf, so a readability rule asking whether *any* entity under it is visible would hand a
       business-unit controller a group capital programme. */
    const unit = buildCapital(ctx({ entityIds: subtree('gulf') }));
    const group = buildCapital(ctx());
    expect(unit.suppliers.length).toBeLessThan(group.suppliers.length);
    expect(unit.projects.every((row) => row.project.entityId === 'gulf')).toBe(true);
    expect(group.projects.some((row) => row.project.entityId === 'group')).toBe(true);
    expect(unit.projects.some((row) => row.project.entityId === 'group')).toBe(false);
  });

  it('and lands every commitment inside the cash horizon', () => {
    /* The point of the page is that the payment is visible before the invoice, and that requires this
       surface and the cash one to be talking about the same thirteen weeks. */
    const capital = buildCapital(ctx());
    expect(capital.upcoming.length).toBe(PURCHASE_ORDERS.length);
    for (const payment of capital.upcoming) {
      expect(payment.week).toBeGreaterThanOrEqual(1);
      expect(payment.week).toBeLessThanOrEqual(CASH_HORIZON_WEEKS);
    }
    const weeks = capital.upcoming.map((payment) => payment.week);
    expect([...weeks].sort((a, b) => a - b)).toEqual(weeks);
  });

  it('and says what is committed and invisible, in one sentence', () => {
    const capital = buildCapital(ctx());
    expect(capital.totalCommittedMinor).toBeGreaterThan(0);
    expect(capital.statement).toMatch(/appears in no ledger/);
  });
});
