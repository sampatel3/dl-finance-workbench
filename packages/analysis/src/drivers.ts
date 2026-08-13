/**
 * The driver graph.
 *
 * A driver is the thing somebody can actually change. The PRD's `Driver` is "an operational or
 * financial input", which is not enough to attribute anything to — attribution needs to know *which
 * measures a driver moves*, and that is what the `moves` edge is for. Without it, "driver analysis" is
 * a chart placed next to a variance and hoping the reader joins them up.
 *
 * Two properties on every driver, and both matter more than they look:
 *
 *   **kind** — `observed` came out of a system (utilisation, hours, headcount, pipeline); `assumed`
 *   was set by a person in a forecast version. A surface that does not distinguish them invites a
 *   reader to treat somebody's guess as a measurement, which is how a forecast becomes evidence.
 *
 *   **owner** — a driver nobody owns cannot be actioned, so a board item built on one is a
 *   conversation with no other end. Every driver here names a role.
 *
 * Drivers read through the measure catalogue rather than querying the store, so a driver and the
 * measure it explains cannot disagree. The two that are not measures — units dispatched and blended
 * price — are read from segment quantities here, because a quantity is not a financial measure and
 * putting it in the catalogue would make the catalogue something else.
 */

import type { SegmentCode } from '@kestrel/model';
import { SEGMENTS, entity, rateFor, translate, translateAtOf } from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { computeMeasure } from '@kestrel/measures';
import type { Unit } from '@kestrel/measures';

import type { BridgeBar, BridgeBarKind } from './bridge.ts';

export type DriverKind = 'observed' | 'assumed';

export interface DriverDefinition {
  readonly id: string;
  readonly label: string;
  readonly unit: Unit;
  readonly kind: DriverKind;
  readonly owner: string;
  /** The measures this driver moves. The edge that makes attribution possible. */
  readonly moves: readonly string[];
  /** Where the value comes from: a catalogue measure, or a quantity read from the segments. */
  readonly source:
    { readonly measureId: string } | { readonly quantity: 'units' | 'blended_price' };
  /** One line on why this driver is worth watching. */
  readonly note?: string;
}

export const DRIVERS: readonly DriverDefinition[] = [
  {
    id: 'units',
    label: 'Units dispatched',
    unit: 'count',
    kind: 'observed',
    owner: 'Operations Director',
    moves: ['revenue', 'cost_of_sales', 'gross_profit'],
    source: { quantity: 'units' },
    note: 'Unitised segments only. Project revenue has no units, which is why the bridge reports it separately.',
  },
  {
    id: 'blended_price',
    label: 'Blended price',
    unit: 'rate',
    kind: 'observed',
    owner: 'Commercial Director',
    moves: ['revenue', 'gross_profit', 'gross_margin'],
    source: { quantity: 'blended_price' },
  },
  {
    id: 'subcontract_rate',
    label: 'Subcontract rate',
    unit: 'rate',
    // Observed as an actual and assumed in a forecast — which is the whole reason bias is findable:
    // four consecutive versions assumed a rate below the one that arrived.
    kind: 'observed',
    owner: 'Operations Director',
    moves: ['cost_of_sales', 'gross_profit', 'gross_margin', 'ebitda'],
    source: { measureId: 'subcontract_rate' },
    note: 'The rate actually paid. Every forecast sets an assumption against it, so it is where forecast bias shows up first.',
  },
  {
    id: 'utilisation',
    label: 'Utilisation',
    unit: 'percent',
    kind: 'observed',
    owner: 'Operations Director',
    moves: ['gross_margin', 'ebitda'],
    source: { measureId: 'utilisation' },
    note: 'Own capacity only. Bought-in hours are the subcontract rate’s business.',
  },
  {
    id: 'dso',
    label: 'Days sales outstanding',
    unit: 'days',
    kind: 'observed',
    owner: 'Group Treasurer',
    moves: ['working_capital', 'cash'],
    source: { measureId: 'dso' },
    note: 'The link between the profit and loss and the cash. A scenario that changes revenue reaches cash through this.',
  },
  {
    id: 'dpo',
    label: 'Days payable outstanding',
    unit: 'days',
    kind: 'observed',
    owner: 'Group Treasurer',
    moves: ['working_capital', 'cash'],
    source: { measureId: 'dpo' },
  },
  {
    id: 'dio',
    label: 'Days inventory outstanding',
    unit: 'days',
    kind: 'observed',
    owner: 'Group Financial Controller',
    moves: ['working_capital', 'cash'],
    source: { measureId: 'dio' },
  },
  {
    id: 'headcount',
    label: 'Headcount',
    unit: 'count',
    kind: 'observed',
    owner: 'Group HR',
    moves: ['opex', 'ebitda'],
    source: { measureId: 'headcount' },
  },
  {
    id: 'pipeline_coverage',
    label: 'Pipeline coverage',
    unit: 'ratio',
    kind: 'observed',
    owner: 'Sales Director',
    moves: ['revenue'],
    source: { measureId: 'pipeline_coverage' },
    note: 'How much pipeline stands behind the revenue. Coverage, not conversion — a big pipeline converting badly and a small one converting well look identical here, which is why both are drivers.',
  },
  {
    id: 'pipeline_conversion',
    label: 'Pipeline conversion',
    unit: 'ratio',
    // Observed in the actual and assumed in every forecast, which is what makes the gap between them a
    // finding. The least reliable feed in the product, and the one behind the forward-looking opportunity.
    kind: 'observed',
    owner: 'Sales Director',
    moves: ['revenue'],
    source: { measureId: 'pipeline_conversion' },
  },
];

const BY_ID = new Map(DRIVERS.map((d) => [d.id, d]));

export function driver(id: string): DriverDefinition {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown driver: ${id}`);
  return found;
}

/** Every driver that moves a given measure — the panel beside a variance. */
export function driversFor(measureId: string): DriverDefinition[] {
  return DRIVERS.filter((d) => d.moves.includes(measureId));
}

// ---------------------------------------------------------------------------
// Reading a driver
// ---------------------------------------------------------------------------

/** Total units and blended price across the unitised segments, in presentation currency. */
function unitFigures(ctx: MeasureContext): { units: number | null; blendedPrice: number | null } {
  let units = 0;
  let value = 0;
  let anyUnquantified = false;

  for (const spec of SEGMENTS.filter(
    (candidate) => ctx.segmentId === undefined || candidate.code === ctx.segmentId,
  )) {
    for (const entityId of ctx.entityIds) {
      const e = entity(entityId);
      const result = ctx.store.query({
        entityId,
        accountId: 'revenue',
        scope: ctx.scope,
        scenario: ctx.scenario,
        versionId: ctx.versionId,
        segmentId: spec.code,
        costCentreId: null,
        ...(ctx.asOfVintage === undefined ? {} : { asOfVintage: ctx.asOfVintage }),
      });
      if (result.value === null) continue;
      if (result.quantity === null) {
        // A segment with no units contributes to neither figure. Including its revenue in the
        // numerator while excluding it from the denominator would inflate the blended price.
        anyUnquantified = true;
        continue;
      }
      const rate = rateFor(
        {
          lens: ctx.lens,
          rates: ctx.rates,
          scope: ctx.scope,
          ...(ctx.comparativeScope === undefined ? {} : { comparativeScope: ctx.comparativeScope }),
        },
        e.functional,
        translateAtOf('revenue'),
      );
      value += rate === null ? result.value : translate(result.value, e.functional, rate);
      units += result.quantity;
    }
  }

  return {
    units: units === 0 && !anyUnquantified ? null : units,
    blendedPrice: units === 0 ? null : value / units,
  };
}

export interface DriverValue {
  readonly driver: DriverDefinition;
  readonly value: number | null;
  readonly unit: Unit;
}

export function readDriver(id: string, ctx: MeasureContext): DriverValue {
  const definition = driver(id);
  if ('measureId' in definition.source) {
    return {
      driver: definition,
      value: computeMeasure(definition.source.measureId, ctx).value,
      unit: definition.unit,
    };
  }
  const figures = unitFigures(ctx);
  return {
    driver: definition,
    value: definition.source.quantity === 'units' ? figures.units : figures.blendedPrice,
    unit: definition.unit,
  };
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

/**
 * Which driver a bridge bar belongs to.
 *
 * This is the edge that turns "volume was worth £0.9m" into "the Operations Director's units were
 * worth £0.9m". A bar with no driver behind it is a bar nobody can act on, and both of the ones here
 * are honest about that: `fx` belongs to treasury policy rather than to an operational driver, and
 * `other` belongs to nobody by definition.
 */
const BAR_DRIVER: Partial<Record<BridgeBarKind, string>> = {
  volume: 'units',
  price: 'blended_price',
  // Mix is a shape change across segments; it is the commercial director's, through the same price
  // driver, because the alternative is a driver called "mix" that nobody can turn.
  mix: 'blended_price',
};

export interface Attribution {
  readonly bar: BridgeBar;
  readonly driver?: DriverDefinition;
  /** The driver's own movement, so the bar and the cause are shown in the same breath. */
  readonly driverFrom?: number | null;
  readonly driverTo?: number | null;
  /** Set where no driver owns the bar, saying why rather than leaving a blank. */
  readonly unattributed?: string;
}

export function attributeBar(
  bar: BridgeBar,
  ctx: MeasureContext,
  comparativeCtx: MeasureContext,
): Attribution {
  if (bar.kind === 'opening' || bar.kind === 'closing') {
    return { bar, unattributed: 'a terminal column, not a contribution' };
  }
  if (bar.kind === 'fx') {
    return { bar, unattributed: 'translation — treasury policy rather than an operational driver' };
  }
  if (bar.kind === 'other') {
    return { bar, unattributed: 'not attributed to any driver' };
  }
  if (bar.kind === 'rate') {
    return {
      bar,
      unattributed: 'segments with no natural unit, so no volume or price driver applies',
    };
  }

  const driverId = BAR_DRIVER[bar.kind];
  if (driverId === undefined) return { bar, unattributed: 'no driver edge for this bar' };

  return {
    bar,
    driver: driver(driverId),
    driverFrom: readDriver(driverId, comparativeCtx).value,
    driverTo: readDriver(driverId, ctx).value,
  };
}
