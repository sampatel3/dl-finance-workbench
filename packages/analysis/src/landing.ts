/**
 * Where the approved forecast lands, on the six lines a board reads.
 *
 * The review's one gap on this surface: *"show the FINAL / approved forecast version prominently…
 * include Revenue, Cost of Sales, Gross Margin, Overheads, EBITDA and PAT. Add variance vs Budget and vs
 * prior forecast version. This lets users see both what changed and where the final forecast now lands."*
 *
 * Version control answers *what changed*. It cannot answer *where we end up*, and the two are different
 * questions: a reader can know that v6 moved the subcontract rate 4% and still not know whether v6 lands
 * ahead of budget. Both belong on this surface, and the landing goes first — a diff is only interesting
 * once you know which side of the line it lands you on.
 *
 * ## Read at the fiscal year, not the month
 *
 * "Where the forecast lands" is a full-year statement. Reading it at the selected month would answer a
 * different question and answer it in a way that looks the same, which is the worst kind of wrong figure.
 * The window is the fiscal year containing the selected month, so a reader stepping back through the
 * months sees the landing for that year rather than a moving target.
 *
 * ## Two comparators, and they are not interchangeable
 *
 * Against **budget** is the accountability question: is the year going to come in where it was committed?
 * Against the **prior forecast version** is the process question: has our own view moved since we last
 * looked, and by how much? A surface showing one of them lets a reader answer the wrong one — a forecast
 * that has quietly walked down three versions still beats a budget nobody believed.
 *
 * So both are computed, side by side, and the version being compared against is named rather than being
 * "prior": the immediately preceding *forecast* version, skipping budgets and actuals, because "the last
 * time we forecast this" is what a reader means.
 */

import type { PeriodScope } from '@kestrel/model';
import { CALENDAR_YEAR, fiscalYearOf, fiscalYearScope } from '@kestrel/model';
import type { MeasureContext, Unit } from '@kestrel/measures';
import { compareMeasure, computeMeasure, contextAtScope, measure } from '@kestrel/measures';

import { activeApprovedForecast, version, versionList } from './forecast.ts';

/**
 * The six lines the review names, in profit-and-loss order.
 *
 * PAT is `net_income`; overheads is `opex`. Named here in the review's own words because that is what a
 * reader is looking for on the page — the catalogue's labels are correct and are not what anybody asks
 * for out loud.
 */
export const LANDING_MEASURES = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'cost_of_sales', label: 'Cost of sales' },
  { id: 'gross_margin', label: 'Gross margin' },
  { id: 'opex', label: 'Overheads' },
  { id: 'ebitda', label: 'EBITDA' },
  { id: 'net_income', label: 'PAT' },
] as const;

export interface LandingLine {
  readonly measureId: string;
  readonly label: string;
  readonly unit: Unit;
  /** Where the approved forecast lands for the full year. */
  readonly landing: number | null;
  readonly budget: number | null;
  readonly priorVersion: number | null;
  /** Landing less budget, in the measure's own terms. */
  readonly vsBudget: number | null;
  readonly vsPrior: number | null;
  /** The unit those two differences are quoted in: bps for a ratio, otherwise the measure's own. */
  readonly varianceUnit: Unit;
  /** From polarity, so a cost landing higher is not painted as good news. */
  readonly budgetFavourable: boolean | null;
  readonly priorFavourable: boolean | null;
}

export interface Landing {
  readonly scope: PeriodScope;
  readonly fiscalYear: number;
  /** The version this landing is: id, label and approval state, so the panel can say what it is showing. */
  readonly versionId: string;
  readonly versionLabel: string;
  readonly status: string;
  /** The forecast version immediately before it. Absent where this is the first. */
  readonly priorVersionId?: string;
  readonly priorVersionLabel?: string;
  readonly budgetId: string;
  readonly lines: readonly LandingLine[];
}

/** Ratios are quoted in basis points; everything else in its own unit. */
function varianceUnitFor(unit: Unit): Unit {
  return unit === 'percent' ? 'bps' : unit;
}

/**
 * The forecast version immediately before the one given.
 *
 * Forecast versions only — a budget is a different kind of object and "prior version" meaning "the
 * budget" would silently make the two comparators the same one.
 */
export function priorForecast(versionId: string): string | undefined {
  const forecasts = versionList().filter((v) => v.scenario === 'FORECAST');
  const at = forecasts.findIndex((v) => v.id === versionId);
  return at <= 0 ? undefined : forecasts[at - 1]?.id;
}

export interface LandingRequest {
  readonly ctx: MeasureContext;
  /** Defaults to the approved forecast, which is what the panel is for. */
  readonly versionId?: string;
  readonly budgetId?: string;
}

export function buildLanding(request: LandingRequest): Landing {
  const approved = activeApprovedForecast();
  const versionId = request.versionId ?? approved.id;
  const spec = version(versionId);
  const budgetId = request.budgetId ?? 'budget-fy26';
  const priorId = priorForecast(versionId);

  const fiscalYear = fiscalYearOf(request.ctx.scope.endMonth, CALENDAR_YEAR);
  const scope = fiscalYearScope(fiscalYear, CALENDAR_YEAR);
  const yearCtx = contextAtScope(request.ctx, scope);

  const lines = LANDING_MEASURES.map((entry): LandingLine => {
    const definition = measure(entry.id);
    const ratio = definition.unit === 'percent';
    const scale = (value: number | null): number | null =>
      value === null ? null : ratio ? value * 10_000 : value;

    /* The landing itself, and each comparative, read at the same window through the same catalogue.
       `compareMeasure` is used for budget so the comparator's own label and polarity come from the
       measure layer rather than being decided here. */
    const versus = compareMeasure(entry.id, yearCtx, { id: 'budget', versionId: budgetId });
    const landing = computeMeasure(entry.id, {
      ...yearCtx,
      scenario: spec.scenario,
      versionId,
    }).value;
    const budget = versus.comparativeValue;
    const prior =
      priorId === undefined
        ? null
        : computeMeasure(entry.id, {
            ...yearCtx,
            scenario: version(priorId).scenario,
            versionId: priorId,
          }).value;

    const vsBudget = landing === null || budget === null ? null : scale(landing - budget);
    const vsPrior = landing === null || prior === null ? null : scale(landing - prior);
    const favourable = (delta: number | null): boolean | null =>
      delta === null || delta === 0 || definition.polarity === 'neutral'
        ? null
        : definition.polarity === 'higher_is_better'
          ? delta > 0
          : delta < 0;

    return {
      measureId: entry.id,
      label: entry.label,
      unit: definition.unit,
      landing,
      budget,
      priorVersion: prior,
      vsBudget,
      vsPrior,
      varianceUnit: varianceUnitFor(definition.unit),
      budgetFavourable: favourable(vsBudget),
      priorFavourable: favourable(vsPrior),
    };
  });

  return {
    scope,
    fiscalYear,
    versionId,
    versionLabel: spec.label,
    status: spec.status,
    ...(priorId === undefined
      ? {}
      : { priorVersionId: priorId, priorVersionLabel: version(priorId).label }),
    budgetId,
    lines,
  };
}
