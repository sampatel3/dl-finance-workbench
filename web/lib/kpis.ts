/** Governed KPI projection for the dedicated KPI domain. */

import { ACTUAL_VERSION, VERSIONS } from '@kestrel/model';
import type { MeasureContext, Unit } from '@kestrel/measures';
import { compareMeasure, computeMeasure, measure } from '@kestrel/measures';
import { activeApprovedForecast } from '@kestrel/analysis';

/**
 * The KPI groups, and whether each one leads or lags the financial result.
 *
 * `horizon` is the field the review's argument rests on: *"non-financial indicators often explain future
 * financial performance earlier."* A page that mixes leading and lagging indicators without saying which
 * is which invites a reader to treat them alike, and they are not alike — a lagging measure tells you what
 * happened, a leading one tells you what is about to.
 *
 * It is a stated property rather than a computed one. Whether churn leads revenue is a claim about this
 * business, not arithmetic, and pretending to derive it would be pretending to have measured it. What the
 * product does instead is say the claim out loud, on the group, so a reader can disagree with it.
 */
export const KPI_GROUPS = [
  {
    id: 'financial',
    label: 'Financial',
    description: 'Growth, profitability and liquidity at the finance headline level.',
    horizon: 'lagging',
    horizonNote: 'The result. By the time these move, the quarter that produced them is closed.',
    measureIds: ['revenue', 'gross_margin', 'ebitda', 'net_income', 'cash'],
  },
  {
    id: 'working_capital',
    label: 'Working capital',
    description: 'Cash held in the operating cycle and the days that drive it.',
    horizon: 'concurrent',
    horizonNote:
      'Moves with trading rather than before or after it, which is why a collections slip shows here ' +
      'in the same month it happens and in cash a quarter later.',
    measureIds: ['working_capital', 'dso', 'dpo', 'dio', 'cash_conversion_cycle'],
  },
  {
    id: 'operational',
    label: 'Operational',
    description: 'Capacity, productivity and commercial indicators that move the financial result.',
    horizon: 'leading',
    horizonNote:
      'Capacity and pipeline set what next quarter can be. Utilisation falling is a revenue ' +
      'problem that has not arrived yet.',
    measureIds: [
      'utilisation',
      'revenue_per_head',
      'headcount',
      'pipeline_coverage',
      'pipeline_conversion',
    ],
  },
  {
    id: 'customer',
    label: 'Customer',
    description: 'Whether customers stay, and whether they get what was promised.',
    horizon: 'leading',
    horizonNote:
      'A customer who is failed this quarter churns next one and does not appear in revenue until ' +
      'the one after. This is the earliest place that shows.',
    measureIds: ['nps', 'customer_churn', 'sla_performance', 'complaints', 'complaint_resolution'],
  },
  {
    id: 'people',
    label: 'People and operations',
    description: 'The workforce behind the delivery, and whether delivery is holding.',
    horizon: 'leading',
    horizonNote:
      'Turnover and absence move before the cost of covering them does. Regretted attrition is the ' +
      'half of turnover the business did not choose, and total turnover hides it.',
    measureIds: [
      'staff_turnover',
      'regretted_attrition',
      'absence_rate',
      'engagement',
      'project_delivery',
    ],
  },
  {
    id: 'quality',
    label: 'Commercial and quality',
    description: 'Whether the work is repeatable, and whether it has to be done twice.',
    horizon: 'leading',
    horizonNote:
      'Rework is margin already spent, and a defect rate rising is a cost-to-serve problem before ' +
      'it is a margin variance.',
    measureIds: ['repeat_business', 'defect_rate', 'safety_incidents', 'uptime'],
  },
] as const;

export type KpiHorizon = (typeof KPI_GROUPS)[number]['horizon'];

export const HORIZON_LABELS: Readonly<Record<string, string>> = {
  leading: 'Leads the financials',
  concurrent: 'Moves with the financials',
  lagging: 'The financial result',
};

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
  /** Whether this group leads, lags or moves with the financial result. */
  readonly horizon: KpiHorizon;
  /** Why it does, in one sentence. A claim about this business, stated so it can be argued with. */
  readonly horizonNote: string;
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
    horizon: group.horizon,
    horizonNote: group.horizonNote,
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
