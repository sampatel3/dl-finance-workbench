/** Governed KPI projection for the dedicated KPI domain. */

import { ACTUAL_VERSION, VERSIONS } from '@kestrel/model';
import type { MeasureContext, Unit } from '@kestrel/measures';
import { compareMeasure, computeMeasure, measure } from '@kestrel/measures';
import { activeApprovedForecast } from '@kestrel/analysis';

export const KPI_GROUPS = [
  {
    id: 'financial',
    label: 'Financial',
    description: 'Growth, profitability and liquidity at the finance headline level.',
    measureIds: ['revenue', 'gross_margin', 'ebitda', 'ebitda_margin', 'cash'],
  },
  {
    id: 'working_capital',
    label: 'Working capital',
    description: 'Cash held in the operating cycle and the days that drive it.',
    measureIds: ['working_capital', 'dso', 'dpo', 'dio', 'cash_conversion_cycle'],
  },
  {
    id: 'operational',
    label: 'Operational',
    description: 'Capacity, productivity and commercial indicators that move the financial result.',
    measureIds: [
      'utilisation',
      'revenue_per_head',
      'headcount',
      'pipeline_coverage',
      'pipeline_conversion',
    ],
  },
] as const;

export type KpiGroupId = (typeof KPI_GROUPS)[number]['id'];
export type PriorPeriodDirection = 'up' | 'flat' | 'down' | 'unavailable';

export interface KpiRow {
  readonly measureId: string;
  readonly label: string;
  readonly unit: Unit;
  readonly actual: number | null;
  readonly budgetTarget: number | null;
  readonly approvedForecast: number | null;
  readonly priorYear: number | null;
  readonly priorPeriodMovement: number | null;
  readonly priorPeriodUnit: Unit;
  readonly priorPeriodDirection: PriorPeriodDirection;
  readonly priorPeriodFavourable: boolean | null;
  readonly definitionOwner: string;
  readonly status: 'approved' | 'draft';
  readonly formula: string;
  readonly note?: string;
}

export interface KpiGroup {
  readonly id: KpiGroupId;
  readonly label: string;
  readonly description: string;
  readonly rows: readonly KpiRow[];
}

export interface KpiDashboard {
  readonly groups: readonly KpiGroup[];
  readonly budget: (typeof VERSIONS)[number];
  readonly forecast: (typeof VERSIONS)[number];
  readonly movementBasis: 'prior period';
}

function activeApprovedBudget(): (typeof VERSIONS)[number] {
  const budget = [...VERSIONS]
    .filter((candidate) => candidate.scenario === 'BUDGET' && candidate.status === 'approved')
    .pop();
  if (budget === undefined) throw new Error('no approved budget version');
  return budget;
}

function priorPeriodDirection(
  current: number | null,
  comparative: number | null,
): PriorPeriodDirection {
  if (current === null || comparative === null) return 'unavailable';
  if (current === comparative) return 'flat';
  return current > comparative ? 'up' : 'down';
}

/**
 * Project the catalogue into a small, explicit KPI set.
 *
 * Budget is the target because it is the governed target already present in the demo. No bespoke KPI
 * threshold, benchmark or ownership is invented here: each row retains the catalogue's owner and
 * approval state, including the two draft CRM measures.
 */
export function kpisFor(ctx: MeasureContext): KpiDashboard {
  const budget = activeApprovedBudget();
  const forecast = activeApprovedForecast();
  const actualCtx: MeasureContext = {
    ...ctx,
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
  };

  const groups = KPI_GROUPS.map((group): KpiGroup => ({
    id: group.id,
    label: group.label,
    description: group.description,
    rows: group.measureIds.map((measureId): KpiRow => {
      const definition = measure(measureId);
      const actual = computeMeasure(measureId, actualCtx);
      const againstBudget = compareMeasure(measureId, actualCtx, {
        id: 'budget',
        versionId: budget.id,
      });
      const againstForecast = compareMeasure(measureId, actualCtx, {
        id: 'forecast',
        versionId: forecast.id,
      });
      const againstPriorYear = compareMeasure(measureId, actualCtx, { id: 'prior_year' });
      const againstPriorPeriod = compareMeasure(measureId, actualCtx, { id: 'prior_period' });

      return {
        measureId,
        label: actual.label,
        unit: actual.unit,
        actual: actual.value,
        budgetTarget: againstBudget.comparativeValue,
        approvedForecast: againstForecast.comparativeValue,
        priorYear: againstPriorYear.comparativeValue,
        priorPeriodMovement: againstPriorPeriod.movement,
        priorPeriodUnit: againstPriorPeriod.movementUnit,
        priorPeriodDirection: priorPeriodDirection(
          actual.value,
          againstPriorPeriod.comparativeValue,
        ),
        priorPeriodFavourable: againstPriorPeriod.favourable,
        definitionOwner: definition.owner,
        status: definition.status,
        formula: definition.formula,
        ...(definition.note === undefined ? {} : { note: definition.note }),
      };
    }),
  }));

  return { groups, budget, forecast, movementBasis: 'prior period' };
}
