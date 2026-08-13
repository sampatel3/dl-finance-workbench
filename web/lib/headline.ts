/**
 * The headline row: four measures, the selected comparator applied, polarity honoured.
 *
 * Four rather than eight, and they are the four the client's own concept slide leads with — revenue,
 * gross margin, EBITDA, cash. A header of eight figures is a header nobody reads; a header of four is
 * a claim about what matters, and being wrong about that claim is a conversation worth having with a
 * client. Eight would avoid the conversation and lose the argument.
 *
 * Every one of them is computed through the measure catalogue against the view's comparator, so the
 * figure in the header and the figure a drill lands on are the same computation with the same inputs
 * recorded. Nothing here reads the store.
 */

import type { ComparatorChoice, MaterialityClass, MeasureContext } from '@kestrel/measures';
import type { MeasureWithComparison, Priority, Unit } from '@kestrel/measures';
import { assessMateriality, compareMeasure, priorityOf } from '@kestrel/measures';

/** The measures the executive header carries, in the order a reader scans them. */
export const HEADLINE_MEASURES = [
  { id: 'revenue', classOf: 'pl' },
  { id: 'gross_margin', classOf: 'pl' },
  { id: 'ebitda', classOf: 'pl' },
  { id: 'cash', classOf: 'cf' },
] as const satisfies readonly { id: string; classOf: MaterialityClass }[];

export interface Headline {
  readonly measureId: string;
  readonly label: string;
  readonly value: number | null;
  readonly unit: Unit;
  readonly comparativeValue: number | null;
  readonly movement: number | null;
  readonly movementUnit: Unit;
  /** From the measure's polarity, never from the arithmetic sign. */
  readonly favourable: boolean | null;
  readonly priority: Priority;
  /** True where the movement clears the materiality policy. A header can mark the ones that do. */
  readonly material: boolean;
  /** The policy's own words, for the tooltip. "Why is this flagged?" has to have an answer. */
  readonly materialityReason: string;
  /** What the figure is being compared against, in words. A header without this is a header to guess at. */
  readonly basis: string;
  readonly formula: string;
  readonly owner: string;
  /** True for the one draft measure family. Disclosed where it is shown, not in a footnote. */
  readonly draft: boolean;
  readonly comparison: MeasureWithComparison;
}

export function headlinesFor(ctx: MeasureContext, comparator: ComparatorChoice): Headline[] {
  return HEADLINE_MEASURES.map(({ id, classOf }) => {
    const comparison = compareMeasure(id, ctx, comparator);
    const verdict = assessMateriality(comparison, classOf);
    const { current } = comparison;
    return {
      measureId: id,
      label: current.label,
      value: current.value,
      unit: current.unit,
      comparativeValue: comparison.comparativeValue,
      movement: comparison.movement,
      movementUnit: comparison.movementUnit,
      favourable: comparison.favourable,
      priority: priorityOf(comparison, classOf),
      material: verdict.material,
      materialityReason: verdict.reason,
      basis: comparison.comparator.basis,
      formula: current.formula,
      owner: current.owner,
      draft: current.status === 'draft',
      comparison,
    };
  });
}
