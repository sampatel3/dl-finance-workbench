/**
 * Named reconciliation checks and close readiness.
 *
 * A check is an explanation of arithmetic the model already performed. It does not carry a seeded
 * pass/fail flag: rerun it against the healthy twin and the outcome changes because the underlying
 * facts change. Both sides are retained so a failed row can name what did not agree rather than
 * offering a red icon with no next question.
 */

import { balanceSheetTotals, consolidate } from './consolidate.ts';
import { entity } from './entities.ts';
import { monthScope } from './period.ts';
import type { FiscalMonth } from './period.ts';
import {
  ACTUAL_VERSION,
  IC_MATERIALITY_MINOR,
  type World,
} from './seed.ts';
import { mappingControlFor } from './mappings.ts';
import type { ClosePosition } from './vintages.ts';
import { closeCompleteness, closePositionsFor } from './vintages.ts';

export type ReconciliationCheckId =
  | 'balance_sheet_identity'
  | 'mapping_to_trial_balance'
  | 'intercompany_trading';

export type ReconciliationStatus = 'passed' | 'failed' | 'not_run';
export type ReconciliationSeverity = 'blocking' | 'warning';

export interface ReconciliationSide {
  readonly id: 'left' | 'right';
  readonly label: string;
  readonly amountMinor: number;
  readonly entityIds: readonly string[];
  readonly entityNames: readonly string[];
}

export interface ReconciliationCheck {
  readonly id: ReconciliationCheckId;
  readonly name: string;
  readonly rule: string;
  readonly month: FiscalMonth;
  readonly severity: ReconciliationSeverity;
  readonly status: ReconciliationStatus;
  readonly differenceMinor: number | null;
  readonly thresholdMinor: number;
  /** A stated load timestamp, never a reading of the wall clock. */
  readonly lastRunAt: string;
  readonly sides: readonly [ReconciliationSide, ReconciliationSide];
}

function names(ids: readonly string[]): string[] {
  return ids.map((id) => entity(id).name);
}

function side(
  id: 'left' | 'right',
  label: string,
  amountMinor: number,
  entityIds: readonly string[] = [],
): ReconciliationSide {
  return { id, label, amountMinor, entityIds, entityNames: names(entityIds) };
}

function statusOf(differenceMinor: number, thresholdMinor = 0): ReconciliationStatus {
  return Math.abs(differenceMinor) <= thresholdMinor ? 'passed' : 'failed';
}

/**
 * The controls that can be proved from the model's current grain.
 *
 * There is intentionally no fabricated subledger check here. The demo has general-ledger facts and
 * source metadata, but no independent receivables or payables subledger total; asserting that such a
 * control passed would compare a number with itself. A pilot adds that check when the independent
 * source arrives.
 */
export function reconciliationChecks(world: World, month: FiscalMonth): ReconciliationCheck[] {
  const consolidation = consolidate({
    store: world.store,
    rates: world.rates,
    scope: monthScope(month),
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
    lens: 'reported',
  });
  const totals = balanceSheetTotals(consolidation);
  const lastRunAt = world.register.currentFor(month)?.loadedAt ?? `${month}-01T00:00:00Z`;
  const allEntities = consolidation.entityIds;

  const balanceSheet: ReconciliationCheck = {
    id: 'balance_sheet_identity',
    name: 'Assets equal liabilities plus equity',
    rule: 'Consolidated assets − consolidated liabilities − consolidated equity = £0.00',
    month,
    severity: 'blocking',
    status: statusOf(totals.difference),
    differenceMinor: totals.difference,
    thresholdMinor: 0,
    lastRunAt,
    sides: [
      side('left', 'Consolidated assets', totals.assets, allEntities),
      side(
        'right',
        'Consolidated liabilities plus equity',
        totals.liabilities + totals.equity,
        allEntities,
      ),
    ],
  };

  const mapping = mappingControlFor(world.mappingSets, month);
  const trialBalanceGap = consolidation.lines.get('unmapped_opex')?.group ?? 0;
  const mappingExposure = mapping?.amountAtStakeMinor ?? 0;
  const mappingDifference = mapping === undefined ? null : trialBalanceGap - mappingExposure;
  const mappingCheck: ReconciliationCheck = {
    id: 'mapping_to_trial_balance',
    name: 'Mapped P&L reconciles to the trial balance',
    rule: 'The trial-balance gap equals the mapping set’s explicit unmapped-account register',
    month,
    severity: 'blocking',
    status: mappingDifference === null ? 'not_run' : statusOf(mappingDifference),
    differenceMinor: mappingDifference,
    thresholdMinor: 0,
    lastRunAt,
    sides: [
      side(
        'left',
        'Trial-balance rows held on the unmapped P&L line',
        trialBalanceGap,
        [...(consolidation.lines.get('unmapped_opex')?.byEntity.keys() ?? [])],
      ),
      side(
        'right',
        mapping === undefined
          ? 'No effective mapping set'
          : `Mapping exceptions in ${mapping.mappingSet.id}`,
        mappingExposure,
        mapping?.unmapped.map((row) => row.entityId) ?? [],
      ),
    ],
  };

  const sellerLine = consolidation.lines.get('revenue_ic');
  const buyerLine = consolidation.lines.get('cost_of_sales_ic');
  const sellerAmount = sellerLine?.combined ?? 0;
  const buyerAmount = buyerLine?.combined ?? 0;
  const intercompanyDifference = sellerAmount - buyerAmount;
  const sellerIds = [...(sellerLine?.byEntity.keys() ?? [])];
  const buyerIds = [...(buyerLine?.byEntity.keys() ?? [])];
  const intercompany: ReconciliationCheck = {
    id: 'intercompany_trading',
    name: 'Intercompany trading nets across the group',
    rule:
      'Intercompany revenue recorded by seller ledgers equals intercompany purchases recorded by buyer ledgers',
    month,
    severity: 'blocking',
    status: statusOf(intercompanyDifference, IC_MATERIALITY_MINOR),
    differenceMinor: intercompanyDifference,
    thresholdMinor: IC_MATERIALITY_MINOR,
    lastRunAt,
    sides: [
      side('left', 'Seller ledgers — intercompany revenue', sellerAmount, sellerIds),
      side('right', 'Buyer ledgers — intercompany purchases', buyerAmount, buyerIds),
    ],
  };

  return [balanceSheet, mappingCheck, intercompany];
}

export interface CloseReadinessPosition extends ClosePosition {
  readonly entityName: string;
}

export interface CloseReadiness {
  readonly month: FiscalMonth;
  readonly ready: boolean;
  readonly closed: number;
  readonly total: number;
  readonly positions: readonly CloseReadinessPosition[];
  readonly open: readonly CloseReadinessPosition[];
}

/** Close status enriched with legal-entity names, in the seed's entity order. */
export function closeReadinessFor(
  positions: readonly ClosePosition[],
  month: FiscalMonth,
): CloseReadiness {
  const completeness = closeCompleteness(positions, month);
  const projected = closePositionsFor(positions, month).map((position) => ({
    ...position,
    entityName: entity(position.entityId).name,
  }));
  const open = projected.filter((position) => position.state !== 'closed');
  return {
    month,
    ready: completeness.total > 0 && completeness.closed === completeness.total,
    closed: completeness.closed,
    total: completeness.total,
    positions: projected,
    open,
  };
}
