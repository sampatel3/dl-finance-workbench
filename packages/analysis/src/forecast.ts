/**
 * Forecast versions, and the diff between two of them.
 *
 * *"Which drivers changed since forecast v6?"* is one of the four illustrative CFO questions in the
 * client's PRD, and the spec has no object that answers it. `FW-MODEL-003` distinguishes versions;
 * nothing in it **compares** two. A version diff is that object, and it is only possible because a
 * forecast here is held as a set of assumptions applied to a generator rather than as its own output:
 * two versions can be subtracted because both are the same world believed differently.
 *
 * A forecast stored as its numbers instead can be compared only figure by figure, which tells a
 * reader what changed and never why — and "revenue is £0.4m lower in v7" is the question, not the
 * answer.
 *
 * ## What this deliberately does not do
 *
 * It does not attribute the total impact to individual assumptions. Doing that properly means
 * re-running the generator once per changed assumption, holding the others still — a marginal run —
 * and the demo does not do it. So the diff reports each assumption's own movement exactly, and the
 * **total** measure impact exactly, and does not invent a split between them. An attribution that
 * looks precise and is really a proportional guess is worse than an honest total, because a reader
 * will act on it. The limitation is stated on the surface, not buried here.
 */

import type { AssumptionSet, PeriodScope, VersionSpec } from '@kestrel/model';
import { VERSIONS } from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { computeMeasure, delta as measureDelta } from '@kestrel/measures';
import type { Unit } from '@kestrel/measures';

import { DRIVERS } from './drivers.ts';

/** The assumptions a version carries, described so a diff can be read by a person. */
interface AssumptionMeta {
  readonly key: keyof AssumptionSet;
  readonly label: string;
  readonly unit: Unit;
  readonly owner: string;
  /** The driver this assumption sets, where one exists. */
  readonly driverId?: string;
  /** How the value should be read: a multiplier on a driver, or an absolute in the unit. */
  readonly form: 'multiplier' | 'absolute';
  readonly note?: string;
}

/**
 * The assumption set, annotated.
 *
 * Held here rather than in the model because these are presentation facts — what an assumption is
 * called, who owns it, which driver it sets. The model owns the numbers; this owns how to talk about
 * them.
 */
export const ASSUMPTIONS: readonly AssumptionMeta[] = [
  {
    key: 'volume',
    label: 'Volume',
    unit: 'percent',
    owner: 'Operations Director',
    driverId: 'units',
    form: 'multiplier',
    note: 'Applied to units in every unitised segment, and to project revenue.',
  },
  {
    key: 'price',
    label: 'Price',
    unit: 'percent',
    owner: 'Commercial Director',
    driverId: 'blended_price',
    form: 'multiplier',
  },
  {
    key: 'unitCost',
    label: 'Unit cost',
    unit: 'percent',
    owner: 'Operations Director',
    form: 'multiplier',
  },
  {
    key: 'subcontractRate',
    label: 'Subcontract rate',
    unit: 'percent',
    owner: 'Operations Director',
    driverId: 'subcontract_rate',
    form: 'multiplier',
    note: 'The assumption every version has under-called. See the forecast-quality surface.',
  },
  {
    key: 'subcontractHours',
    label: 'Subcontract hours',
    unit: 'percent',
    owner: 'Operations Director',
    form: 'multiplier',
  },
  {
    key: 'dsoDays',
    label: 'Collection days',
    unit: 'days',
    owner: 'Group Treasurer',
    driverId: 'dso',
    form: 'absolute',
    note: 'Added to every entity’s days sales outstanding. The path a revenue assumption takes to cash.',
  },
  {
    key: 'pipelineConversion',
    label: 'Pipeline conversion',
    unit: 'percent',
    owner: 'Sales Director',
    driverId: 'pipeline_coverage',
    form: 'absolute',
  },
];

export interface AssumptionChange {
  readonly key: keyof AssumptionSet;
  readonly label: string
  readonly unit: Unit;
  readonly owner: string;
  readonly from: number;
  readonly to: number;
  /** Which way it moved, in the assumption's own terms. */
  readonly direction: 'up' | 'down';
  /** The driver it sets, and through the graph, the measures that driver moves. */
  readonly driverId?: string;
  readonly moves: readonly string[];
  readonly note?: string;
}

export interface MeasureImpact {
  readonly measureId: string;
  readonly label: string;
  readonly unit: Unit;
  readonly from: number | null;
  readonly to: number | null;
  readonly movement: number | null;
  readonly movementUnit: Unit;
}

export interface VersionDiff {
  readonly from: VersionSpec;
  readonly to: VersionSpec;
  readonly scope: PeriodScope;
  /** Only the assumptions that actually moved. An empty list is a real answer. */
  readonly changes: readonly AssumptionChange[];
  /** The total effect on the measures a reader cares about. Exact, and not split by assumption. */
  readonly impact: readonly MeasureImpact[];
  /**
   * Why the impact is not attributed per assumption. Carried on the object so the surface cannot
   * render the diff without the caveat that belongs to it.
   */
  readonly attributionNote: string;
}

export function version(id: string): VersionSpec {
  const found = VERSIONS.find((v) => v.id === id);
  if (!found) throw new Error(`Unknown version: ${id}`);
  return found;
}

/** The measures a version diff reports on. The four a CFO asks about, in the order they ask. */
export const DIFF_MEASURES = ['revenue', 'gross_margin', 'ebitda', 'cash'] as const;

/**
 * Diff two versions over a window.
 *
 * The changes come from the assumption sets, which is why they are exact and cheap. The impact comes
 * from computing each measure twice, once per version, which is why it is also exact — and why it is
 * a total rather than a decomposition.
 */
export function versionDiff(
  fromId: string,
  toId: string,
  ctx: MeasureContext,
): VersionDiff {
  const from = version(fromId);
  const to = version(toId);

  const changes: AssumptionChange[] = [];
  for (const meta of ASSUMPTIONS) {
    const before = from.assumptions[meta.key];
    const after = to.assumptions[meta.key];
    if (before === after) continue;
    changes.push({
      key: meta.key,
      label: meta.label,
      unit: meta.unit,
      owner: meta.owner,
      from: before,
      to: after,
      direction: after > before ? 'up' : 'down',
      ...(meta.driverId === undefined ? {} : { driverId: meta.driverId }),
      moves:
        meta.driverId === undefined
          ? []
          : (DRIVERS.find((d) => d.id === meta.driverId)?.moves ?? []),
      ...(meta.note === undefined ? {} : { note: meta.note }),
    });
  }

  const impact: MeasureImpact[] = DIFF_MEASURES.map((measureId) => {
    const before = computeMeasure(measureId, {
      ...ctx,
      scenario: from.scenario,
      versionId: from.id,
    });
    const after = computeMeasure(measureId, { ...ctx, scenario: to.scenario, versionId: to.id });
    const movement = measureDelta(after.value, before.value, after.unit);
    return {
      measureId,
      label: after.label,
      unit: after.unit,
      from: before.value,
      to: after.value,
      movement: movement.value,
      movementUnit: movement.unit,
    };
  });

  return {
    from,
    to,
    scope: ctx.scope,
    changes,
    impact,
    attributionNote:
      'The movement in each measure is the total effect of every assumption change together. ' +
      'Splitting it between them needs a marginal run per assumption, which this build does not do — ' +
      'so no per-assumption figure is shown rather than a proportional guess that would read as one.',
  };
}

/**
 * Apply a diff to a version's assumptions and get back the other version's.
 *
 * The round-trip is the test that the diff is complete: if applying every recorded change to the
 * earlier assumption set does not reproduce the later one exactly, then the diff is missing a change
 * and the surface is telling a reader that nothing else moved when something did.
 */
export function applyChanges(
  base: AssumptionSet,
  changes: readonly AssumptionChange[],
): AssumptionSet {
  const out: Record<string, number> = { ...base };
  for (const change of changes) out[change.key] = change.to;
  return out as unknown as AssumptionSet;
}

/**
 * Every version, with its status and what it is for — the version selector's own data.
 *
 * Ordered as the seed declares them, which is chronological, because a version list sorted by id puts
 * the budget between v4 and v5.
 */
export function versionList(): readonly VersionSpec[] {
  return VERSIONS;
}

/** The version in force: the approved forecast, not the draft on top of it. */
export function activeApprovedForecast(): VersionSpec {
  const approved = VERSIONS.filter((v) => v.scenario === 'FORECAST' && v.status === 'approved');
  const last = approved[approved.length - 1];
  if (last === undefined) throw new Error('no approved forecast version');
  return last;
}
