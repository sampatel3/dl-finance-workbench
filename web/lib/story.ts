/**
 * The monthly executive story, and the balance-sheet movement behind it.
 *
 * The review's ask: *"use 6–7 structured paragraphs: Revenue, Cost of Sales, Gross Margin, Overheads,
 * EBITDA, PAT, Cash & CAPEX. Each paragraph should cover performance vs Forecast/Budget, vs Prior Month
 * and YoY where relevant. Explain what is driving growth or decline, not just the movement."* And below
 * it: *"replace scattered final-account comments with a Balance Sheet and P&L movement page."*
 *
 * ## Code writes these, and that is the point
 *
 * A model could write seven fluent paragraphs about this month and one of them would eventually contain
 * a cause nobody could evidence. Every sentence here is composed from three comparisons and the
 * contribution rows underneath them — so the prose is a *rendering of the arithmetic* rather than an
 * account of it, and a reader who checks will always find it consistent.
 *
 * What that costs is voice. These paragraphs read like a controller rather than like a writer, and that
 * is the right trade for a board pack: the sentence a reader has to be able to trust is the one with the
 * number in it. Where a model has a job here it is polishing a paragraph whose figures are already
 * fixed, which is what the existing commentary queue does and why this does not duplicate it.
 *
 * ## Three comparisons, because one is a trap
 *
 * Against forecast alone, a business that re-forecast downwards last month looks on plan. Against prior
 * month alone, seasonality reads as performance. Against last year alone, a re-shaped business reads as
 * a decline. Each paragraph carries all three where they exist, and says which one it is quoting.
 */

import type { FiscalMonth } from '@kestrel/model';
import { addMonths, monthScope, priorYearScope } from '@kestrel/model';
import type { MeasureContext, Unit } from '@kestrel/measures';
import { compareMeasure, computeMeasure, formatValue, measure } from '@kestrel/measures';
import type { Contributors } from '@kestrel/analysis';
import { becauseOf, contributorsFor } from '@kestrel/analysis';

import type { View } from './world';
import { contextOf, monthLabel } from './world';

/** The seven paragraphs, in the order the review lists them — which is profit-and-loss order. */
export const STORY_LINES = [
  { id: 'revenue', heading: 'Revenue' },
  { id: 'cost_of_sales', heading: 'Cost of sales' },
  { id: 'gross_margin', heading: 'Gross margin' },
  { id: 'opex', heading: 'Overheads' },
  { id: 'ebitda', heading: 'EBITDA' },
  { id: 'net_income', heading: 'Profit after tax' },
  { id: 'cash', heading: 'Cash and capital spend' },
] as const;

export interface StoryComparison {
  readonly label: string;
  readonly comparativeValue: number | null;
  readonly movement: number | null;
  readonly unit: Unit;
  readonly favourable: boolean | null;
}

export interface StoryParagraph {
  readonly measureId: string;
  readonly heading: string;
  readonly value: number | null;
  readonly unit: Unit;
  /** Against forecast, prior month and prior year — each present only where it exists. */
  readonly comparisons: readonly StoryComparison[];
  /** The decomposition behind the movement, or absent where the movement is immaterial. */
  readonly contributors?: Contributors;
  /** The paragraph itself. Composed by code from the two above. */
  readonly text: string;
  /** True where the movement cleared the materiality policy against the selected comparator. */
  readonly material: boolean;
}

/** `-0.041` → `4.1 points lower`; `£618k` → `£618k higher`. Direction as a word, never a sign. */
function said(movement: number | null, unit: Unit): string {
  if (movement === null) return 'is not comparable';
  if (movement === 0) return 'is unchanged';
  const magnitude = formatValue(Math.abs(movement), unit);
  return `${magnitude} ${movement > 0 ? 'higher' : 'lower'}`;
}

function comparisonsFor(measureId: string, ctx: MeasureContext, view: View): StoryComparison[] {
  const out: StoryComparison[] = [];
  const definition = measure(measureId);
  const unit = definition.unit === 'percent' ? ('bps' as Unit) : definition.unit;
  const scale = (value: number | null): number | null =>
    value === null ? null : definition.unit === 'percent' ? value * 10_000 : value;

  const push = (label: string, comparativeValue: number | null, current: number | null) => {
    const movement =
      current === null || comparativeValue === null ? null : scale(current - comparativeValue);
    out.push({
      label,
      comparativeValue,
      movement,
      unit,
      favourable:
        movement === null || movement === 0 || definition.polarity === 'neutral'
          ? null
          : definition.polarity === 'higher_is_better'
            ? movement > 0
            : movement < 0,
    });
  };

  const current = computeMeasure(measureId, ctx).value;

  /* Against the selected comparator first, because that is what the rest of the surface is showing and a
     paragraph quoting a different basis from the figure above it is how a pack contradicts itself. */
  const selected = compareMeasure(measureId, ctx, view.comparator);
  push(selected.comparator.label, selected.comparativeValue, current);

  const priorMonth = addMonths(view.scope.endMonth, -1);
  push(
    monthLabel(priorMonth),
    computeMeasure(measureId, { ...ctx, scope: monthScope(priorMonth) }).value,
    current,
  );

  push(
    `${monthLabel(addMonths(view.scope.endMonth, -12))} (a year earlier)`,
    computeMeasure(measureId, { ...ctx, scope: priorYearScope(view.scope) }).value,
    current,
  );

  return out;
}

/**
 * Compose one paragraph.
 *
 * The shape is fixed: what it is, how it compares on three bases, and what drove the movement. Fixed
 * because a board pack is read the same way every month and a paragraph that reorganises itself is one a
 * reader has to parse rather than scan.
 */
function paragraphFor(
  measureId: string,
  heading: string,
  ctx: MeasureContext,
  view: View,
): StoryParagraph {
  const definition = measure(measureId);
  const value = computeMeasure(measureId, ctx).value;
  const comparisons = comparisonsFor(measureId, ctx, view);
  const selected = compareMeasure(measureId, ctx, view.comparator);
  const material = selected.movement !== null && Math.abs(selected.movement) > 0;

  const contributors =
    value === null
      ? undefined
      : contributorsFor({ measureId, ctx, comparator: view.comparator, limit: 3 });

  const [against, priorMonth, priorYear] = comparisons;

  const sentences: string[] = [
    `${definition.label} for ${monthLabel(view.scope.endMonth)} is ${formatValue(value, definition.unit)}.`,
  ];

  if (against !== undefined) {
    sentences.push(
      `Against ${against.label} it ${said(against.movement, against.unit)}` +
        (against.favourable === null
          ? '.'
          : `, which is ${against.favourable ? 'ahead of' : 'behind'} where it was expected to be.`),
    );
  }

  /* Prior month and prior year in one sentence rather than two: they answer the same question — is this
     a trend or a month — and splitting them makes a reader hold the first while reading the second. */
  const trend: string[] = [];
  if (priorMonth?.movement !== null && priorMonth !== undefined) {
    trend.push(`${said(priorMonth.movement, priorMonth.unit)} than ${priorMonth.label}`);
  }
  if (priorYear?.movement !== null && priorYear !== undefined) {
    trend.push(`${said(priorYear.movement, priorYear.unit)} than the same month a year earlier`);
  }
  if (trend.length > 0) sentences.push(`It is ${trend.join(', and ')}.`);

  if (contributors !== undefined && contributors.rows.length > 0) {
    sentences.push(becauseOf(contributors, formatValue));
  }

  return {
    measureId,
    heading,
    value,
    unit: definition.unit,
    comparisons,
    ...(contributors === undefined ? {} : { contributors }),
    text: sentences.join(' '),
    material,
  };
}

export function buildStory(view: View): StoryParagraph[] {
  const ctx = contextOf(view);
  return STORY_LINES.map((line) => paragraphFor(line.id, line.heading, ctx, view));
}

// ---------------------------------------------------------------------------
// The balance sheet, moved
// ---------------------------------------------------------------------------

/**
 * The lines the review names, grouped as a balance sheet is read.
 *
 * `capex` is a flow rather than a balance and sits with fixed assets on purpose: the review asks for
 * *"major CAPEX spend where relevant because it affects both assets and cash"*, and a reader looking at
 * a £1.2m rise in fixed assets wants the spend that caused it on the same row, not on another page.
 */
export const MOVEMENT_LINES = [
  { id: 'fixed_assets', heading: 'Fixed assets', group: 'Assets' },
  { id: 'capex', heading: 'Capital spend in the month', group: 'Assets', flow: true },
  { id: 'inventory', heading: 'Inventory', group: 'Assets' },
  { id: 'receivables', heading: 'Trade receivables', group: 'Assets' },
  { id: 'cash', heading: 'Cash', group: 'Assets' },
  { id: 'payables', heading: 'Trade payables and accruals', group: 'Liabilities' },
  { id: 'borrowings', heading: 'Borrowings', group: 'Liabilities' },
  { id: 'working_capital', heading: 'Working capital', group: 'Derived' },
] as const;

export interface MovementLine {
  readonly measureId: string;
  readonly heading: string;
  readonly group: string;
  readonly closing: number | null;
  readonly opening: number | null;
  readonly movement: number | null;
  readonly unit: Unit;
  readonly favourable: boolean | null;
  /** What moved it, in one sentence, from the same decomposition the story above uses. */
  readonly because?: string;
}

/**
 * Every balance-sheet line with its movement since last month, and what moved it.
 *
 * Against **prior month**, not against forecast: a balance sheet is read as a movement from where it was,
 * and "receivables are £600k above forecast" answers a question nobody asked about the balance sheet.
 * The profit-and-loss story above is where the plan comparison lives.
 */
export function buildMovements(view: View): MovementLine[] {
  const ctx = contextOf(view);
  const priorMonth: FiscalMonth = addMonths(view.scope.endMonth, -1);

  return MOVEMENT_LINES.map((line): MovementLine => {
    const definition = measure(line.id);
    const closing = computeMeasure(line.id, ctx).value;
    const opening = computeMeasure(line.id, { ...ctx, scope: monthScope(priorMonth) }).value;
    const movement = closing === null || opening === null ? null : closing - opening;

    /* Only where the line moved enough to be worth a sentence. A "because of…" under a £3k movement on a
       £40m balance sheet is the kind of line that trains a reader to stop reading them. */
    const worthExplaining =
      movement !== null && opening !== null && opening !== 0
        ? Math.abs(movement / opening) > 0.02
        : false;

    const contributors = worthExplaining
      ? contributorsFor({ measureId: line.id, ctx, comparator: { id: 'prior_period' }, limit: 2 })
      : undefined;

    return {
      measureId: line.id,
      heading: line.heading,
      group: line.group,
      closing,
      opening,
      movement,
      unit: definition.unit,
      favourable:
        movement === null || movement === 0 || definition.polarity === 'neutral'
          ? null
          : definition.polarity === 'higher_is_better'
            ? movement > 0
            : movement < 0,
      ...(contributors === undefined ? {} : { because: becauseOf(contributors, formatValue) }),
    };
  });
}
