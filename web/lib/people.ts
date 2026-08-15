/**
 * Headcount and people cost — the section the review adds, and the loop it exists to show.
 *
 * Slide 14's argument: *"payroll is often one of the largest controllable cost lines"*, *"low morale or
 * high attrition can affect service quality and revenue"*, and *"headcount changes explain overhead
 * movement and margin pressure"*. It asks for headcount by department and entity, staff cost against
 * budget, forecast and prior month, cost per FTE, open roles, the contractor mix, and the non-financial
 * half beside it.
 *
 * ## Why this is one page rather than a table of HR metrics
 *
 * Because the numbers on it form a loop, and the loop is the finding:
 *
 *   pressure raises attrition → attrition opens vacancies → vacancies are covered with bought-in
 *   labour → bought-in labour is what compressed the margin in the first place
 *
 * Every figure here is seeded from the same `strain` term the financial result is, so the loop is real
 * in the data rather than asserted in prose. A people page whose numbers float beside the profit and
 * loss is a page a chief financial officer reads once.
 *
 * ## What is not here, and why
 *
 * The review names *"diversity / inclusion metrics where appropriate"*. There is no defensible way to
 * seed those: fabricating demographic data about fictional employees, then rendering it as though a
 * system had measured it, is not a demo of a capability — it is a page that would have to be deleted
 * before anyone senior saw it. The surface says so rather than quietly omitting the line.
 *
 * The hiring *pipeline* is the same kind of thing at lower stakes: a pipeline of named candidates lives
 * in an applicant system, not a ledger. Open roles is the half a finance system genuinely holds, and it
 * is the half that costs money.
 */

import type { CostCentreCode, FiscalMonth } from '@kestrel/model';
import {
  COST_CENTRES,
  addMonths,
  entity,
  formatMonthLong,
  subtree,
  tradingEntities,
} from '@kestrel/model';
import type { MeasureContext, Unit } from '@kestrel/measures';
import { compareMeasure, computeMeasure, formatValue, measure } from '@kestrel/measures';

import type { View } from './world';
import { contextOf } from './world';

/**
 * The financial half, in the order the review lists it.
 *
 * `staff_cost` first because it is the line a chief financial officer arrives looking for, and the two
 * beneath it are the two ways it can move: more people, or dearer people. Separating them is the whole
 * value of the section — a staff cost 6% over budget means something different at flat headcount.
 */
export const PEOPLE_MEASURES = [
  'staff_cost',
  'headcount',
  'cost_per_fte',
  'subcontract_cost',
  'contractor_share',
  'open_roles',
  'vacancy_rate',
  'revenue_per_head',
] as const;

/**
 * The non-financial half. Every one of these moves before the cost line does.
 *
 * Read over the **fiscal year to date**, not over the selected month, and that is a correctness fix
 * rather than a presentational preference. A monthly attrition rate on a 31-person entity is one
 * rounded leaver: Kestrel Inc reported 3.2% turnover — the highest in the group — because a single
 * departure rounded up, while the entity actually under pressure sat at 1.7%. Attrition, absence and
 * training completion are annual rates everywhere they are quoted seriously, and over the year to date
 * the figures rank the way the underlying strain does.
 */
export const WORKFORCE_MEASURES = [
  'staff_turnover',
  'regretted_attrition',
  'absence_rate',
  'engagement',
  'training_completion',
  'utilisation',
] as const;

/**
 * The smallest relative movement this page's prose will call a movement.
 *
 * Half a point, because that is where the rendered figure stops reading as flat. Prose and table have
 * to agree about what moved or a reader trusts neither.
 */
const VISIBLE_MOVEMENT = 0.005;

export interface PeopleLine {
  readonly measureId: string;
  readonly label: string;
  readonly unit: Unit;
  readonly value: number | null;
  /** Against the view's selected comparator — budget, forecast or prior period. */
  readonly comparatorLabel: string;
  readonly comparative: number | null;
  readonly movement: number | null;
  readonly movementUnit: Unit;
  readonly favourable: boolean | null;
  /** Against last month, always, because a people number is read as a movement. */
  readonly priorMonth: number | null;
  readonly owner: string;
  readonly status: 'approved' | 'draft';
  readonly note?: string;
}

export interface DepartmentRow {
  readonly code: CostCentreCode;
  readonly label: string;
  readonly owner: string;
  readonly headcount: number | null;
  readonly staffCost: number | null;
  readonly costPerFte: number | null;
  readonly openRoles: number | null;
  /** Share of the readable group's headcount. Null where the group total is unavailable. */
  readonly share: number | null;
}

export interface EntityRow {
  readonly entityId: string;
  readonly name: string;
  readonly headcount: number | null;
  readonly contractorShare: number | null;
  readonly staffCost: number | null;
  readonly turnover: number | null;
  readonly openRoles: number | null;
}

export interface People {
  readonly lines: readonly PeopleLine[];
  readonly workforce: readonly PeopleLine[];
  /** What window the workforce rates are measured over, so the table can say it. */
  readonly workforceWindow: string;
  readonly departments: readonly DepartmentRow[];
  readonly entities: readonly EntityRow[];
  /** The loop, stated from the figures rather than asserted. */
  readonly story: string;
}

function lineFor(measureId: string, ctx: MeasureContext, view: View, priorCtx: MeasureContext): PeopleLine {
  const definition = measure(measureId);
  const current = computeMeasure(measureId, ctx);
  const compared = compareMeasure(measureId, ctx, view.comparator);
  return {
    measureId,
    label: definition.label,
    unit: definition.unit,
    value: current.value,
    comparatorLabel: compared.comparator.label,
    comparative: compared.comparativeValue,
    movement: compared.movement,
    movementUnit: compared.movementUnit,
    favourable: compared.favourable,
    priorMonth: computeMeasure(measureId, priorCtx).value,
    owner: definition.owner,
    status: definition.status,
    ...(definition.note === undefined ? {} : { note: definition.note }),
  };
}

/**
 * Headcount and cost by department, scoped to what this principal may read.
 *
 * By cost centre, which is what a department is in a ledger. The share column is against the readable
 * group rather than against the whole business: a business-unit controller's page adding to 100% of
 * their own entity is correct, and one adding to 34% of a group they cannot see would be a leak dressed
 * as a percentage.
 */
function departmentsFor(ctx: MeasureContext): DepartmentRow[] {
  const groupHeadcount = computeMeasure('headcount', ctx).value;

  return COST_CENTRES.map((centre): DepartmentRow => {
    const scoped: MeasureContext = { ...ctx, costCentreId: centre.code };
    const headcount = computeMeasure('headcount', scoped).value;
    return {
      code: centre.code,
      label: centre.label,
      owner: centre.owner,
      headcount,
      staffCost: computeMeasure('staff_cost', scoped).value,
      costPerFte: computeMeasure('cost_per_fte', scoped).value,
      openRoles: computeMeasure('open_roles', scoped).value,
      share:
        headcount === null || groupHeadcount === null || groupHeadcount === 0
          ? null
          : headcount / groupHeadcount,
    };
  })
    .filter((row) => row.headcount !== null && row.headcount !== 0)
    .sort((a, b) => (b.headcount ?? 0) - (a.headcount ?? 0));
}

/**
 * The same figures by legal entity, for the entities this principal may read.
 *
 * Turnover comes from the year-to-date context for the reason above: a month's leaver count at a small
 * entity is a rounding artefact, and this table's whole job is to rank entities against each other.
 */
function entitiesFor(ctx: MeasureContext, yearToDate: MeasureContext): EntityRow[] {
  const readable = new Set(ctx.entityIds);
  return tradingEntities()
    .filter((candidate) => readable.has(candidate.id))
    .map((candidate): EntityRow => {
      const scoped: MeasureContext = { ...ctx, entityIds: subtree(candidate.id) };
      return {
        entityId: candidate.id,
        name: entity(candidate.id).name,
        headcount: computeMeasure('headcount', scoped).value,
        contractorShare: computeMeasure('contractor_share', scoped).value,
        staffCost: computeMeasure('staff_cost', scoped).value,
        turnover: computeMeasure('staff_turnover', {
          ...yearToDate,
          entityIds: subtree(candidate.id),
        }).value,
        openRoles: computeMeasure('open_roles', scoped).value,
      };
    })
    .sort((a, b) => (b.headcount ?? 0) - (a.headcount ?? 0));
}

/**
 * The loop, in one paragraph composed from the figures above it.
 *
 * Written by code for the same reason the executive story is: a model asked to explain a people page
 * would eventually assert a cause nobody could evidence, and the causes here are the entire point.
 */
function storyFor(lines: readonly PeopleLine[], workforce: readonly PeopleLine[], entities: readonly EntityRow[]): string {
  const find = (id: string) => [...lines, ...workforce].find((line) => line.measureId === id);
  const format = (line: PeopleLine | undefined): string =>
    line === undefined ? '—' : formatValue(line.value, line.unit);

  const cost = find('staff_cost');
  const heads = find('headcount');
  const perFte = find('cost_per_fte');
  const contractors = find('contractor_share');
  const turnover = find('staff_turnover');
  const vacancy = find('vacancy_rate');

  /* Which of the two ways staff cost moved: more people, or dearer people. A page that reports the cost
     movement without separating them has told a reader that something happened and not what.

     Tested against the threshold a reader can actually see rather than against exact zero. A cost per
     FTE movement of 0.0004 is not zero and renders as "+0.0%", so a sentence keyed on `!== 0` announced
     a move in a figure the table beside it showed as flat — the two disagreeing in one eyeline. */
  const moved = (line: PeopleLine | undefined): boolean =>
    Math.abs(line?.movement ?? 0) >= VISIBLE_MOVEMENT;
  const driver =
    !moved(heads) && !moved(perFte)
      ? 'neither headcount nor cost per head has moved against plan'
      : moved(perFte) && !moved(heads)
        ? 'entirely from cost per head rather than from headcount'
        : moved(heads) && !moved(perFte)
          ? 'entirely from headcount rather than from cost per head'
          : 'from both headcount and cost per head';

  const worst = [...entities].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))[0];

  return (
    `Staff cost is ${format(cost)} against ${cost?.comparatorLabel ?? 'plan'}, ${driver}. ` +
    `Cost per FTE is ${format(perFte)} annualised across ${format(heads)} people, with ` +
    `${format(contractors)} of the workforce bought in rather than employed. ` +
    `Turnover is running at ${format(turnover)}${
      worst === undefined ? '' : `, highest at ${worst.name}`
    }, and ${format(vacancy)} of the establishment is unfilled — which is the loop this page exists to ` +
    'show: pressure raises attrition, attrition opens vacancies, vacancies are covered with bought-in ' +
    'labour, and bought-in labour is what compressed the margin.'
  );
}

/** The same context, widened to the fiscal year so far. */
function yearToDateCtx(ctx: MeasureContext): MeasureContext {
  const start = `${ctx.scope.endMonth.slice(0, 4)}-01` as FiscalMonth;
  return {
    ...ctx,
    scope: {
      type: 'YTD',
      startMonth: start,
      endMonth: ctx.scope.endMonth,
      label: `Year to date to ${formatMonthLong(ctx.scope.endMonth)}`,
    },
  };
}

export function buildPeople(view: View): People {
  const ctx = contextOf(view);
  /* The prior-month column keeps the selected window's shape and shifts it back one month, so a
     year-to-date view compares against the year to date a month ago rather than against one month. */
  const priorCtx: MeasureContext = {
    ...ctx,
    scope: {
      ...ctx.scope,
      startMonth: addMonths(ctx.scope.startMonth, -1) as FiscalMonth,
      endMonth: addMonths(ctx.scope.endMonth, -1) as FiscalMonth,
    },
  };

  const yearToDate = yearToDateCtx(ctx);
  const priorYearToDate = yearToDateCtx(priorCtx);

  const lines = PEOPLE_MEASURES.map((id) => lineFor(id, ctx, view, priorCtx));
  const workforce = WORKFORCE_MEASURES.map((id) =>
    lineFor(id, yearToDate, view, priorYearToDate),
  );
  const departments = departmentsFor(ctx);
  const entities = entitiesFor(ctx, yearToDate);

  return {
    lines,
    workforce,
    workforceWindow: yearToDate.scope.label,
    departments,
    entities,
    story: storyFor(lines, workforce, entities),
  };
}

