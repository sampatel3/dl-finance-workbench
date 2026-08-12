/**
 * The bridge — a variance decomposed into bars that sum to it.
 *
 * This is the file the whole product is for. The client's PRD asks the system to "identify material
 * variances", which is a subtraction; the client's own concept slide then captions a variance
 * *"driven mainly by volume"*, which is this. A delta says a number moved. A bridge says why, in
 * quantities somebody owns.
 *
 * **The summing constraint is the discipline.** Bars that do not add up to the total have explained
 * nothing, and the residual is exactly where an unstated convention hides. So `Bridge.sums` is part of
 * the result rather than a debug aid — it is the contract, asserted across every scope, comparator and
 * entity slice in `bridge.test.ts`, and the residual is a named `other` bar rather than a rounding
 * swept under the arithmetic.
 *
 * ## The convention, stated
 *
 * Price, volume and mix cannot be separated without choosing an order of attribution, and the choice
 * changes the answer. Ours, for a set of segments each with a quantity and a price:
 *
 *     volume = (Q₁ − Q₀) × P̄₀                     the whole book at last period's average price
 *     mix    = Σ (Q₁ˢ − Q₁ × w₀ˢ) × P₀ˢ            this period's volume, sold in a different shape
 *     price  = Σ Q₁ˢ × (P₁ˢ − P₀ˢ)                 this period's volume at the new prices
 *
 * where `w₀ˢ` is each segment's share of quantity last period and `P̄₀` is the blended price.
 * Those three sum to `R₁ − R₀` exactly, algebraically, not approximately — the proof is in the test.
 *
 * Two consequences worth naming because both are visible on screen:
 *
 *   **Price is valued at THIS period's volume.** So a price rise on a growing line is worth more
 *   than the same rise on a shrinking one, which is the behaviour a commercial director expects.
 *
 *   **Mix is measured in quantity share, not revenue share.** Revenue share moves when price moves,
 *   so a revenue-weighted mix bar double-counts the price effect and the two bars then fight.
 *
 * ## FX comes first, not last
 *
 * A group in four currencies cannot decompose a reported variance directly: some of the movement is
 * translation and belongs to nobody's commercial performance. So the total is split before anything
 * else, using the constant-currency lens already in the measure layer:
 *
 *     fx       = reported variance − constant-currency variance
 *     the rest = decomposed in constant currency
 *
 * Doing it the other way — decomposing reported figures and calling the leftover FX — puts the
 * translation effect inside the price bar, which is how a business gets told it raised prices in a
 * quarter when it did not.
 */

import type { AccountCode, FiscalMonth, PeriodScope, SegmentCode } from '@kestrel/model';
import {
  SEGMENTS,
  entity,
  rateFor,
  segment as segmentOf,
  translate,
  translateAtOf,
} from '@kestrel/model';
import type { ComparatorChoice, MeasureContext, ResolvedComparator } from '@kestrel/measures';
import { computeMeasure, resolveComparator } from '@kestrel/measures';

/**
 * What each bar of the waterfall means.
 *
 * `opening` and `closing` are the two terminal columns; everything between them is a contribution and
 * they are what must sum. Keeping the terminals in the same list is what lets a chart render straight
 * from a bridge without knowing the arithmetic.
 */
export type BridgeBarKind =
  | 'opening'
  | 'volume'
  | 'price'
  | 'mix'
  /** A segment with no natural unit: its movement cannot be split, so it is reported whole. */
  | 'rate'
  /**
   * The part of the measure that has no segment at all — intercompany trade on revenue, bought-in labour
   * and the intercompany purchase on cost.
   */
  | 'unsegmented'
  | 'fx'
  /** Named, small, and reported. Never absorbed. */
  | 'other'
  | 'closing';

export interface BridgeBar {
  readonly kind: BridgeBarKind;
  readonly label: string;
  /** Presentation currency, minor units. Signed: a negative bar is an adverse contribution. */
  readonly value: number;
  /** For a contribution bar, which segments made it up. */
  readonly bySegment?: ReadonlyMap<SegmentCode, number>;
  readonly note?: string;
}

export interface Bridge {
  readonly measureId: string;
  readonly label: string;
  readonly scope: PeriodScope;
  readonly comparator: ResolvedComparator;
  /** The comparative figure and the current one, in presentation currency, minor units. */
  readonly from: number;
  readonly to: number;
  readonly total: number;
  /** Opening, every contribution, then closing — in the order a waterfall draws them. */
  readonly bars: readonly BridgeBar[];
  /** The `other` bar's value, hoisted so a caller can judge the decomposition without scanning. */
  readonly residual: number;
  /** True where the contributions sum to the total to the penny. Always true, or the build failed. */
  readonly sums: boolean;
}

// ---------------------------------------------------------------------------
// Reading segments
// ---------------------------------------------------------------------------

interface SegmentFigure {
  readonly value: number;
  /** Null where the segment has no natural unit. */
  readonly quantity: number | null;
}

/**
 * One account's value and quantity per segment, in presentation currency.
 *
 * Read here rather than through the measure layer because a bridge needs the **quantity** beside the
 * value, and a measure is a single number by definition. The translation is the measure layer's own
 * rule applied to a narrower query, and the quantity is deliberately not translated: a unit is a unit
 * in every currency.
 */
function segmentFigures(
  ctx: MeasureContext,
  accountId: AccountCode,
  overrides: Partial<
    Pick<MeasureContext, 'scope' | 'scenario' | 'versionId' | 'lens' | 'comparativeScope'>
  > = {},
): Map<SegmentCode, SegmentFigure> {
  const scope = overrides.scope ?? ctx.scope;
  const scenario = overrides.scenario ?? ctx.scenario;
  const versionId = overrides.versionId ?? ctx.versionId;
  const lens = overrides.lens ?? ctx.lens;
  const comparativeScope = overrides.comparativeScope ?? ctx.comparativeScope;

  const out = new Map<SegmentCode, SegmentFigure>();

  for (const spec of SEGMENTS) {
    let value = 0;
    let quantity: number | null = 0;
    let present = false;

    for (const entityId of ctx.entityIds) {
      const e = entity(entityId);
      const result = ctx.store.query({
        entityId,
        accountId,
        scope,
        scenario,
        versionId,
        segmentId: spec.code,
        costCentreId: null,
        ...(ctx.asOfVintage === undefined ? {} : { asOfVintage: ctx.asOfVintage }),
      });
      if (result.value === null) continue;
      present = true;

      const rate = rateFor(
        {
          lens,
          rates: ctx.rates,
          scope,
          ...(comparativeScope === undefined ? {} : { comparativeScope }),
        },
        e.functional,
        translateAtOf(accountId),
      );
      value += rate === null ? result.value : translate(result.value, e.functional, rate);

      // One segment with no quantity anywhere makes the whole segment unquantified. A partial volume
      // yields a price nobody can defend.
      if (result.quantity === null || quantity === null) quantity = null;
      else quantity += result.quantity;
    }

    if (present) out.set(spec.code, { value, quantity });
  }

  return out;
}

// ---------------------------------------------------------------------------
// The decomposition
// ---------------------------------------------------------------------------

interface Decomposition {
  readonly volume: number;
  readonly price: number;
  readonly mix: number;
  readonly rate: number;
  readonly volumeBySegment: Map<SegmentCode, number>;
  readonly priceBySegment: Map<SegmentCode, number>;
  readonly mixBySegment: Map<SegmentCode, number>;
  readonly rateBySegment: Map<SegmentCode, number>;
}

/**
 * Price/volume/mix over two sets of segment figures, both in the same currency.
 *
 * Segments split in two before any arithmetic happens: those with a quantity in **both** periods can
 * be decomposed, and those without cannot. The second group is reported as a `rate` bar carrying its
 * whole movement — which is the honest answer for project revenue recognised over time, and is what a
 * product that assumes everything is unitised gets wrong by inventing a price for it.
 */
function decompose(
  before: Map<SegmentCode, SegmentFigure>,
  after: Map<SegmentCode, SegmentFigure>,
): Decomposition {
  const codes = new Set<SegmentCode>([...before.keys(), ...after.keys()]);

  const quantified: SegmentCode[] = [];
  const unquantified: SegmentCode[] = [];
  for (const code of codes) {
    const b = before.get(code);
    const a = after.get(code);
    if (b?.quantity != null && b.quantity > 0 && a?.quantity != null) quantified.push(code);
    else unquantified.push(code);
  }

  const rateBySegment = new Map<SegmentCode, number>();
  let rate = 0;
  for (const code of unquantified) {
    const movement = (after.get(code)?.value ?? 0) - (before.get(code)?.value ?? 0);
    if (movement !== 0) rateBySegment.set(code, movement);
    rate += movement;
  }

  const q0Total = quantified.reduce((sum, code) => sum + (before.get(code)?.quantity ?? 0), 0);
  const q1Total = quantified.reduce((sum, code) => sum + (after.get(code)?.quantity ?? 0), 0);
  const r0Total = quantified.reduce((sum, code) => sum + (before.get(code)?.value ?? 0), 0);

  const volumeBySegment = new Map<SegmentCode, number>();
  const priceBySegment = new Map<SegmentCode, number>();
  const mixBySegment = new Map<SegmentCode, number>();

  if (q0Total === 0 || quantified.length === 0) {
    return {
      volume: 0,
      price: 0,
      mix: 0,
      rate,
      volumeBySegment,
      priceBySegment,
      mixBySegment,
      rateBySegment,
    };
  }

  // The blended price last period: total value over total units, across the quantified segments only.
  const blended0 = r0Total / q0Total;

  // Volume — the whole book, at last period's blended price. Reported as one figure and attributed to
  // segments by their share of the quantity change, so the chart can open it without the attribution
  // pretending to be a separate calculation.
  const volume = (q1Total - q0Total) * blended0;
  const quantityChange = q1Total - q0Total;
  for (const code of quantified) {
    const change = (after.get(code)?.quantity ?? 0) - (before.get(code)?.quantity ?? 0);
    const share = quantityChange === 0 ? 0 : change / quantityChange;
    volumeBySegment.set(code, volume * share);
  }

  let price = 0;
  let mix = 0;
  for (const code of quantified) {
    const b = before.get(code);
    const a = after.get(code);
    const q0 = b?.quantity ?? 0;
    const q1 = a?.quantity ?? 0;
    const p0 = q0 === 0 ? 0 : (b?.value ?? 0) / q0;
    const p1 = q1 === 0 ? 0 : (a?.value ?? 0) / q1;

    // Price at THIS period's volume: a rise on a growing line is worth more than the same rise on a
    // shrinking one.
    const priceEffect = q1 * (p1 - p0);
    priceBySegment.set(code, priceEffect);
    price += priceEffect;

    // Mix in QUANTITY share. Revenue share moves when price moves, so a revenue-weighted mix bar
    // double-counts the price effect and the two bars then fight.
    const w0 = q0Total === 0 ? 0 : q0 / q0Total;
    const mixEffect = (q1 - q1Total * w0) * p0;
    mixBySegment.set(code, mixEffect);
    mix += mixEffect;
  }

  return { volume, price, mix, rate, volumeBySegment, priceBySegment, mixBySegment, rateBySegment };
}

// ---------------------------------------------------------------------------
// Building a bridge
// ---------------------------------------------------------------------------

/** The accounts a bridge can be built over: the ones held by segment, with a quantity. */
const BRIDGEABLE: Readonly<
  Record<string, { accountId: AccountCode; label: string; sign: 1 | -1 }>
> = {
  revenue: { accountId: 'revenue', label: 'Revenue', sign: 1 },
  cost_of_sales: { accountId: 'cost_of_sales', label: 'Cost of sales', sign: 1 },
};

export interface BridgeRequest {
  readonly measureId: 'revenue' | 'cost_of_sales';
  readonly ctx: MeasureContext;
  readonly comparator: ComparatorChoice;
}

export function buildBridge(request: BridgeRequest): Bridge {
  const { ctx, comparator: choice } = request;
  const spec = BRIDGEABLE[request.measureId];
  if (spec === undefined) throw new Error(`No bridge for ${request.measureId}`);

  const comparator = resolveComparator(choice, ctx);
  if (comparator.kind === 'fit') {
    throw new Error(
      'A trend cannot be bridged: there are no quantities behind a fitted line, so there is nothing ' +
        'to attribute. Use a comparator that names a version.',
    );
  }

  const comparativeCtx: MeasureContext = {
    ...ctx,
    scope: comparator.scope ?? ctx.scope,
    scenario: comparator.scenario ?? ctx.scenario,
    versionId: comparator.versionId ?? ctx.versionId,
  };

  // The two totals, reported. These are the terminals of the waterfall and they come from the measure
  // layer, so the bridge cannot disagree with the figure on the card above it.
  const from = computeMeasure(request.measureId, comparativeCtx).value ?? 0;
  const to = computeMeasure(request.measureId, ctx).value ?? 0;
  const total = to - from;

  // FX first. The current period restated at the comparative period's rates is what "constant
  // currency" means, and the difference between that and the reported figure is translation.
  const toConstant =
    computeMeasure(request.measureId, {
      ...ctx,
      lens: 'constant',
      comparativeScope: comparator.scope ?? ctx.scope,
    }).value ?? 0;
  const fx = to - toConstant;

  // Everything else is decomposed in constant currency, so no commercial bar carries a translation
  // effect.
  const before = segmentFigures(comparativeCtx, spec.accountId, { lens: 'reported' });
  const after = segmentFigures(ctx, spec.accountId, {
    lens: 'constant',
    comparativeScope: comparator.scope ?? ctx.scope,
  });
  const d = decompose(before, after);

  // A measure is not only its segmented account. Group revenue carries intercompany trade, and cost of
  // sales carries bought-in labour and the intercompany purchase — none of which has a segment, so none
  // of which can be split into price and volume. That movement is real and it has to go somewhere.
  //
  // It was going into the residual, and the residual was zero only because the difference happened to be
  // the same in both periods. A change to the cost-to-serve assumption moved intercompany trade by £50k
  // and the residual immediately became larger than the mix bar — a decomposition quietly explaining less
  // than it claimed to, which is exactly what `sums` and the residual bar exist to prevent and exactly
  // what an unnamed residual lets through. Named, the residual returns to rounding.
  //
  // Both sides are measured against their own lens: the comparative in reported terms, the current in
  // constant currency, so the translation stays in the FX bar and is not counted twice.
  const sumOf = (figures: Map<SegmentCode, SegmentFigure>): number =>
    [...figures.values()].reduce((running, figure) => running + figure.value, 0);
  const unsegmented = toConstant - sumOf(after) - (from - sumOf(before));

  const explained = d.volume + d.price + d.mix + d.rate + fx + unsegmented;
  const residual = total - explained;

  // Annotated before the filter, not after it: an array literal infers `kind: string`, and the
  // filter would then hand back an array that is not a BridgeBar[].
  const candidates: BridgeBar[] = [
    { kind: 'opening', label: comparator.label, value: from },
    {
      kind: 'volume',
      label: 'Volume',
      value: d.volume,
      bySegment: d.volumeBySegment,
      note: 'the change in units, at the comparative period’s blended price',
    },
    {
      kind: 'price',
      label: 'Price',
      value: d.price,
      bySegment: d.priceBySegment,
      note: 'the change in price per unit, valued at this period’s volume',
    },
    {
      kind: 'mix',
      label: 'Mix',
      value: d.mix,
      bySegment: d.mixBySegment,
      note: 'this period’s volume sold in a different shape, weighted by unit share',
    },
    {
      kind: 'rate',
      label: 'Unmeasured units',
      value: d.rate,
      bySegment: d.rateBySegment,
      note: 'segments with no natural unit — reported whole rather than split into price and volume',
    },
    {
      kind: 'unsegmented',
      label: request.measureId === 'revenue' ? 'Intercompany' : 'Bought-in and intercompany',
      value: unsegmented,
      note: 'the part of the measure held without a segment, so it has no units to split',
    },
    {
      kind: 'fx',
      label: 'FX translation',
      value: fx,
      note: 'the effect of moving the same trading at this period’s rates rather than the comparative’s',
    },
    { kind: 'other', label: 'Other', value: residual, note: 'not attributed to any of the above' },
    { kind: 'closing', label: 'Actual', value: to },
  ];

  const bars = candidates.filter(
    (bar) => bar.kind === 'opening' || bar.kind === 'closing' || bar.value !== 0,
  );

  const contributions = bars
    .filter((bar) => bar.kind !== 'opening' && bar.kind !== 'closing')
    .reduce((sum, bar) => sum + bar.value, 0);

  return {
    measureId: request.measureId,
    label: spec.label,
    scope: ctx.scope,
    comparator,
    from,
    to,
    total,
    bars,
    residual,
    // Rounded to the penny on both sides: the contributions are real arithmetic on floats, and the
    // claim is that they sum to the total as money, not as IEEE-754.
    sums: Math.round(contributions) === Math.round(total),
  };
}

/**
 * The gross-profit bridge: the revenue bridge with the cost bridge subtracted from it.
 *
 * Composed rather than computed from scratch, and it stays exact because subtraction is linear —
 * gross profit's variance is revenue's less cost's, so its bars are revenue's bars less cost's bars
 * and they sum for the same reason. Building a third decomposition instead would produce a margin
 * bridge that does not agree with the two above it, which is the disagreement a reader finds first.
 */
export function grossProfitBridge(request: Omit<BridgeRequest, 'measureId'>): Bridge {
  const revenue = buildBridge({ ...request, measureId: 'revenue' });
  const cost = buildBridge({ ...request, measureId: 'cost_of_sales' });

  const costByKind = new Map(cost.bars.map((bar) => [bar.kind, bar]));
  const from = revenue.from - cost.from;
  const to = revenue.to - cost.to;

  const bars: BridgeBar[] = [];
  bars.push({ kind: 'opening', label: revenue.comparator.label, value: from });
  for (const bar of revenue.bars) {
    if (bar.kind === 'opening' || bar.kind === 'closing') continue;
    const costBar = costByKind.get(bar.kind);
    const value = bar.value - (costBar?.value ?? 0);
    if (value === 0) continue;
    bars.push({
      ...bar,
      value,
      note: `${bar.note ?? ''} — revenue less cost`.trim(),
    });
  }
  // A kind the cost bridge has and the revenue bridge does not still belongs in the result.
  for (const bar of cost.bars) {
    if (bar.kind === 'opening' || bar.kind === 'closing') continue;
    if (revenue.bars.some((r) => r.kind === bar.kind)) continue;
    bars.push({ ...bar, value: -bar.value, note: `${bar.note ?? ''} — cost only`.trim() });
  }
  bars.push({ kind: 'closing', label: 'Actual', value: to });

  const total = to - from;
  const contributions = bars
    .filter((bar) => bar.kind !== 'opening' && bar.kind !== 'closing')
    .reduce((sum, bar) => sum + bar.value, 0);

  return {
    measureId: 'gross_profit',
    label: 'Gross profit',
    scope: request.ctx.scope,
    comparator: revenue.comparator,
    from,
    to,
    total,
    bars,
    residual: (revenue.residual ?? 0) - (cost.residual ?? 0),
    sums: Math.round(contributions) === Math.round(total),
  };
}

/**
 * The largest contribution, favourable or adverse — what a board item's caption is written from.
 *
 * The caption on the client's concept slide is *"↓ Product A volume"*, which is this function's
 * output rendered. Returning the bar rather than a sentence keeps the phrasing where phrasing belongs
 * and the attribution where arithmetic belongs.
 */
export function principalDriver(bridge: Bridge): BridgeBar | undefined {
  return bridge.bars
    .filter((bar) => bar.kind !== 'opening' && bar.kind !== 'closing' && bar.kind !== 'other')
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
}

/** The segment that contributed most to a bar. The second half of that caption. */
export function principalSegment(
  bar: BridgeBar,
): { segment: SegmentCode; label: string; value: number } | undefined {
  if (bar.bySegment === undefined) return undefined;
  const top = [...bar.bySegment.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  if (top === undefined) return undefined;
  return { segment: top[0], label: segmentOf(top[0]).label, value: top[1] };
}

/** Every month in the window, so a caller can show the bridge's own trend. */
export function bridgeMonths(scope: PeriodScope): FiscalMonth[] {
  const out: FiscalMonth[] = [];
  const [sy, sm] = scope.startMonth.split('-').map(Number);
  const [ey, em] = scope.endMonth.split('-').map(Number);
  let cursor = (sy ?? 0) * 12 + (sm ?? 1) - 1;
  const end = (ey ?? 0) * 12 + (em ?? 1) - 1;
  while (cursor <= end) {
    out.push(`${Math.floor(cursor / 12)}-${String((cursor % 12) + 1).padStart(2, '0')}`);
    cursor += 1;
  }
  return out;
}
