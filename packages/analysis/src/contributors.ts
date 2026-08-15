/**
 * Where a movement came from: the same measure, computed at every slice of one dimension.
 *
 * The review's central ask is that the headline figures stop being figures. *"Numbers alone do not tell
 * the CFO the underlying story"* — so beside every material movement the product has to be able to say
 * which entity, segment or cost centre produced it, how much of it, and who answers for that.
 *
 * ## Each row is a measurement, never an apportionment
 *
 * A contribution here is the measure recomputed with the dimension pinned, on both sides of the
 * comparison, and the difference between those two figures. It is never the group movement multiplied by
 * a share. That distinction is the difference between a number and a division dressed as a number, and it
 * is what lets a reader drill into a row and find the same figure waiting for them.
 *
 * The cost of doing it honestly is that **the rows do not add up to the total**, and this file reports
 * that rather than hiding it:
 *
 *   - Intercompany trade is eliminated at the group, so entity rows overstate the group by the matched
 *     amount. £855k of it in the closing month.
 *   - Not every fact carries a segment or a cost centre. Group overheads have no segment; intercompany
 *     revenue has no units. Those rows exist as an `unattributed` remainder rather than being silently
 *     spread across the named slices.
 *
 * So a caller gets `attributed`, `residual` and `sums`. Any surface printing the rows without printing
 * the residual is making a claim this module did not.
 *
 * ## Ratios do not decompose, and are not made to
 *
 * Gross margin at three segments does not sum to gross margin at the group in any arithmetic — it is a
 * ratio, and the group's is a weighted outcome. For a non-currency measure the rows are still real
 * measurements and still rank by how far each moved, but `sums` is false, `residual` is null, and the
 * note says the shares are not additive. The alternative — printing a percentage-point "contribution"
 * computed by weighting — is a number that looks like arithmetic and is an opinion about weights.
 *
 * ## Which dimension
 *
 * `best` picks the dimension whose largest single contributor explains the most of the movement, which is
 * the question an executive is actually asking: *where did this come from.* It is a stated heuristic, not
 * a truth, so the chosen dimension is returned and every surface names it — a reader who wants a different
 * cut can ask for one, and `explains` says how much the winner accounted for.
 */

import type { CostCentreCode, SegmentCode } from '@kestrel/model';
import { COST_CENTRES, SEGMENTS, entity, subtree } from '@kestrel/model';
import type { ComparatorChoice, MeasureContext, Unit } from '@kestrel/measures';
import { compareMeasure, computeMeasure, measure } from '@kestrel/measures';

/** The dimensions a movement can be attributed to. */
export const CONTRIBUTOR_DIMENSIONS = ['entity', 'segment', 'cost_centre'] as const;
export type ContributorDimension = (typeof CONTRIBUTOR_DIMENSIONS)[number];

export const CONTRIBUTOR_DIMENSION_LABELS: Readonly<Record<ContributorDimension, string>> = {
  entity: 'entity',
  segment: 'segment',
  cost_centre: 'cost centre',
};

export interface Contribution {
  readonly key: string;
  readonly label: string;
  /** Who answers for this slice. Carried from the dimension, never invented here. */
  readonly owner: string;
  readonly current: number | null;
  readonly comparative: number | null;
  /** Current less comparative, in the measure's own unit. Null where either side is absent. */
  readonly movement: number | null;
  /**
   * Signed share of the total movement this row accounts for.
   *
   * Null for a non-currency measure, where the rows are not additive and a share would be fiction.
   */
  readonly share: number | null;
  /** From the measure's polarity, so a cost that rose is not painted as an improvement. */
  readonly favourable: boolean | null;
}

/**
 * The unit an **absolute** difference between two values of this measure is expressed in.
 *
 * Not `deltaUnitFor`, which answers a different question: that one gives the unit of a *relative*
 * movement, so currency becomes a percentage. Here the movement is `current − comparative` in the
 * measure's own terms, and the only unit that changes is percent — a two-point margin fall is
 * conventionally 200bps, not 2%.
 *
 * It matters because the two were mixed on screen: a headline read "gross margin −194bps" while the rows
 * under it read "−4.1%". Both were correct and they looked like different quantities, which is exactly
 * the confusion a decomposition exists to remove.
 */
export function absoluteDeltaUnit(unit: Unit): Unit {
  return unit === 'percent' ? 'bps' : unit;
}

export interface Contributors {
  readonly measureId: string;
  readonly label: string;
  readonly unit: Unit;
  /** What a row's `movement` is measured in. See `absoluteDeltaUnit`. */
  readonly movementUnit: Unit;
  readonly dimension: ContributorDimension;
  /** The group-level movement these rows are trying to explain. */
  readonly total: number | null;
  readonly rows: readonly Contribution[];
  /**
   * What the named rows did not account for: eliminations, and facts carrying no member of this
   * dimension. Null where the measure is not additive, because there is nothing to reconcile.
   */
  readonly residual: number | null;
  /** True where the rows plus the residual reproduce the total exactly. */
  readonly sums: boolean;
  /** One sentence a surface can print beside the rows, stating what they are and are not. */
  readonly note: string;
}

/** The members of a dimension, with their labels and owners. */
function membersOf(
  dimension: ContributorDimension,
  ctx: MeasureContext,
): readonly { key: string; label: string; owner: string }[] {
  switch (dimension) {
    case 'entity':
      /* The context's own entity list, so a scoped session decomposes into what it can read and a
         single-entity session gets one row rather than a group breakdown it may not see. */
      return ctx.entityIds.map((id) => ({
        key: id,
        label: entity(id).name,
        owner: entity(id).owner,
      }));
    case 'segment':
      return SEGMENTS.map((s) => ({ key: s.code, label: s.label, owner: s.owner }));
    case 'cost_centre':
      return COST_CENTRES.map((c) => ({ key: c.code, label: c.label, owner: c.owner }));
  }
}

/** The context for one slice of one dimension. */
function sliceContext(
  ctx: MeasureContext,
  dimension: ContributorDimension,
  key: string,
): MeasureContext {
  switch (dimension) {
    case 'entity':
      return { ...ctx, entityIds: subtree(key) };
    case 'segment':
      return { ...ctx, segmentId: key as SegmentCode };
    case 'cost_centre':
      return { ...ctx, costCentreId: key as CostCentreCode };
  }
}

export interface ContributorRequest {
  readonly measureId: string;
  readonly ctx: MeasureContext;
  readonly comparator: ComparatorChoice;
  /** Omit to let `best` choose. */
  readonly dimension?: ContributorDimension;
  /** How many rows a surface wants. The rest fold into the residual, which is stated. */
  readonly limit?: number;
}

export function contributorsFor(request: ContributorRequest): Contributors {
  const dimension = request.dimension ?? bestDimension(request);
  const definition = measure(request.measureId);
  const additive = definition.unit === 'currency';

  const group = compareMeasure(request.measureId, request.ctx, request.comparator);
  const rawTotal =
    group.current.value === null || group.comparativeValue === null
      ? null
      : group.current.value - group.comparativeValue;
  /* In the same unit as the rows, so `share` and `residual` are ratios and differences of like with
     like. Mixing a percentage-point total with basis-point rows would produce a share out by 10,000. */
  const total =
    rawTotal === null ? null : definition.unit === 'percent' ? rawTotal * 10_000 : rawTotal;

  const all = membersOf(dimension, request.ctx).map((member): Contribution => {
    const sliced = sliceContext(request.ctx, dimension, member.key);
    const comparison = compareMeasure(request.measureId, sliced, request.comparator);
    const current = comparison.current.value;
    const comparative = comparison.comparativeValue;
    /* Scaled into the movement unit: a percent measure's difference is quoted in basis points, and
       0.02 is 200bps. Scaling here rather than at the formatter keeps every reader of `movement` —
       the sentence, the table, a future export — reading one number in one unit. */
    const raw = current === null || comparative === null ? null : current - comparative;
    const move = raw === null ? null : definition.unit === 'percent' ? raw * 10_000 : raw;
    return {
      key: member.key,
      label: member.label,
      owner: member.owner,
      current,
      comparative,
      movement: move,
      share: !additive || move === null || total === null || total === 0 ? null : move / total,
      favourable:
        move === null || move === 0 || definition.polarity === 'neutral'
          ? null
          : definition.polarity === 'higher_is_better'
            ? move > 0
            : move < 0,
    };
  });

  /* Ranked by how far each slice moved, not by how large it is. A £5m division that did exactly what it
     was asked to do is not the answer to "why did this change". */
  const ranked = [...all].sort((a, b) => Math.abs(b.movement ?? 0) - Math.abs(a.movement ?? 0));
  const rows = request.limit === undefined ? ranked : ranked.slice(0, request.limit);

  /* The residual is measured against EVERY member, not just the printed ones, and then the dropped rows
     are added back — otherwise a `limit` would quietly turn a truncation into a reconciling difference
     and the note would claim the top three explain a gap they do not. */
  const attributed = all.reduce((sum, row) => sum + (row.movement ?? 0), 0);
  const dropped = ranked.slice(rows.length).reduce((sum, row) => sum + (row.movement ?? 0), 0);
  const residual = !additive || total === null ? null : total - attributed + dropped;

  return {
    measureId: request.measureId,
    label: definition.label,
    unit: definition.unit,
    movementUnit: absoluteDeltaUnit(definition.unit),
    dimension,
    total,
    rows,
    residual,
    sums: residual !== null && Math.abs(residual) < 1,
    note: noteFor(dimension, additive, residual, rows.length, all.length),
  };
}

function noteFor(
  dimension: ContributorDimension,
  additive: boolean,
  residual: number | null,
  shown: number,
  available: number,
): string {
  const where = CONTRIBUTOR_DIMENSION_LABELS[dimension];
  if (!additive) {
    return (
      `Each row is this measure computed at that ${where}, not a share of the group's. A ratio is a ` +
      `weighted outcome, so these do not add up to the total and no share is shown.`
    );
  }
  const truncation =
    shown < available ? ` The other ${available - shown} are in the remainder.` : '';
  if (residual === null) return `Computed at each ${where} independently.${truncation}`;
  if (Math.abs(residual) < 1) {
    return `Each row is computed at that ${where}; together they account for the movement exactly.${truncation}`;
  }
  return (
    `Each row is computed at that ${where} independently, never apportioned from the total. They do ` +
    `not sum to it: intercompany trade is eliminated on consolidation, and not every posting carries ` +
    `a ${where}. The remainder is shown rather than spread across the rows.${truncation}`
  );
}

/**
 * The dimension whose single largest contributor explains the most of the movement.
 *
 * A heuristic, and named as one wherever it is printed. The competing rule — always show entity — is
 * worse in the case that matters most: when one segment moved and every entity moved a little, an entity
 * breakdown says "everywhere", which is the answer that ends an investigation rather than starting one.
 */
export function bestDimension(
  request: Omit<ContributorRequest, 'dimension'>,
): ContributorDimension {
  let winner: ContributorDimension = 'entity';
  let best = -1;

  for (const dimension of CONTRIBUTOR_DIMENSIONS) {
    const result = contributorsFor({ ...request, dimension });
    if (result.total === null || result.total === 0) continue;
    const top = result.rows[0];
    if (top?.movement == null) continue;
    /* Capped at 1: a slice that moved further than the total — one segment up while another falls — is
       a real and interesting answer, but it should not beat a dimension that explains the whole thing. */
    const explains = Math.min(Math.abs(top.movement / result.total), 1);
    if (explains > best) {
      best = explains;
      winner = dimension;
    }
  }
  return winner;
}

/**
 * The sentence the review asked for: *"use concise 'because of…' commentary under each material
 * movement."*
 *
 * Code writes it, from the contribution rows. No model is involved, which is what makes it safe to print
 * under a figure — the wording is a rendering of the arithmetic rather than an account of it. It names the
 * top slice, its money, and its owner, because those are the three things that turn a movement into a
 * conversation with somebody.
 */
export function becauseOf(
  contributors: Contributors,
  format: (value: number, unit: Unit) => string,
): string {
  const top = contributors.rows[0];
  if (top === undefined || top.movement === null || contributors.total === null) {
    return `No single ${CONTRIBUTOR_DIMENSION_LABELS[contributors.dimension]} accounts for this movement.`;
  }

  const direction = top.movement < 0 ? 'down' : 'up';
  const where = CONTRIBUTOR_DIMENSION_LABELS[contributors.dimension];
  const magnitude = format(Math.abs(top.movement), contributors.movementUnit);

  if (top.share === null) {
    return (
      `Largest single ${where}: ${top.label}, ${direction} ${magnitude}. ` +
      `Owned by ${top.owner}. Ratios are not additive, so this is the biggest mover rather than a share.`
    );
  }

  const second = contributors.rows[1];
  const secondClause =
    second === undefined || second.movement === null || second.movement === 0
      ? ''
      : ` Next is ${second.label} at ${format(Math.abs(second.movement), contributors.movementUnit)} ` +
        `${second.movement < 0 ? 'down' : 'up'}.`;

  return (
    `Because of ${top.label}, ${direction} ${magnitude} — ` +
    `${format(Math.abs(top.share), 'percent')} of the movement, owned by ${top.owner}.${secondClause}`
  );
}
