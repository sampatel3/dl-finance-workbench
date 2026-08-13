/**
 * Permission-aware projections for the Controls surface.
 *
 * Governance metadata is still data. In particular, a mapping exception, a close position and an
 * AI prompt's figure references can all disclose a group result without rendering a headline card.
 * This module applies the current view's resolved entity grant before the page receives any of those
 * records. Group reconciliations are withheld altogether at a narrower scope because their two sides
 * are consolidated group figures; presenting a sliced substitute under the same check name would be
 * more misleading than saying the control is unavailable.
 */

import type {
  AiUsageEntry,
  CommentaryItem,
  GovernedUnmappedAccount,
  MappingControl,
  PublishedCommentarySnapshot,
  ReconciliationCheck,
  SourceLoad,
  SourceStatus,
} from '@kestrel/model';
import {
  VERSIONS,
  aiUsageLogForCommentary,
  closeReadinessFor,
  mappingControlFor,
  mappingControls,
  reconciliationChecks,
  seedCommentaryQueue,
  sourceLoads,
  sourceStatuses,
  tradingEntities,
} from '@kestrel/model';
import type { MeasureValue } from '@kestrel/measures';
import { MEASURES, computeMeasure } from '@kestrel/measures';

import { resolvePermissionScope } from './permissions';
import { NARRATION_PROMPT_VERSION } from './narration';
import { NARRATION } from './narration.generated';
import type { View } from './world';
import { contextOf, world } from './world';

export interface ScopedMappingControl {
  readonly mappingSet: MappingControl['mappingSet'];
  /** Global catalogue counts are withheld when the selected view is narrower than the group. */
  readonly totalCodes: number | null;
  readonly coverage: number | null;
  readonly unmappedCount: number;
  readonly amountAtStakeMinor: number;
  readonly unmapped: readonly GovernedUnmappedAccount[];
}

export interface PublishedLineage {
  readonly item: CommentaryItem;
  readonly snapshot: PublishedCommentarySnapshot;
  readonly pinnedFigure: MeasureValue;
  readonly currentFigure: MeasureValue;
  readonly load: SourceLoad;
  readonly laterRestatements: readonly SourceLoad[];
}

export interface ControlsViewModel {
  readonly groupReadable: boolean;
  readonly sourceStatuses: readonly SourceStatus[];
  readonly recentLoads: readonly SourceLoad[];
  readonly totalLoads: number;
  readonly close: ReturnType<typeof closeReadinessFor>;
  readonly checks: readonly ReconciliationCheck[] | null;
  readonly mapping: ScopedMappingControl | null;
  readonly mappingVersions: readonly ScopedMappingControl[];
  readonly measures: typeof MEASURES;
  readonly versions: typeof VERSIONS;
  readonly commentary: readonly CommentaryItem[];
  readonly aiLog: readonly AiUsageEntry[];
  readonly lineage: PublishedLineage | null;
  readonly groupRefusal: string | null;
  readonly requestedRefusal: string | null;
}

function scopeMapping(
  control: MappingControl,
  visibleEntityIds: ReadonlySet<string>,
  groupReadable: boolean,
): ScopedMappingControl {
  const unmapped = control.unmapped.filter((row) => visibleEntityIds.has(row.entityId));
  return {
    mappingSet: control.mappingSet,
    totalCodes: groupReadable ? control.totalCodes : null,
    coverage: groupReadable ? control.coverage : null,
    unmappedCount: unmapped.length,
    amountAtStakeMinor: unmapped.reduce((sum, row) => sum + row.amountMinor, 0),
    unmapped,
  };
}

function refusalFor(view: View, requestedEntityId: string): string | null {
  const resolution = resolvePermissionScope(view.principal, requestedEntityId);
  return resolution.allowed ? null : resolution.refusal;
}

/**
 * Audit the committed overview briefs as well as the workflow queue.
 *
 * A keyless build uses a deterministic template and therefore makes no model call. It still gets an
 * audit row because it is material narrated output rendered on the executive surface; the explicit
 * `no-model` id prevents that fallback from being misrepresented as AI usage.
 */
function committedNarrationLog(
  model: ReturnType<typeof world>,
  groupReadable: boolean,
): AiUsageEntry[] {
  if (!groupReadable) return [];
  return Object.entries(NARRATION).map(([key, record]) => {
    const vintage = model.register.currentFor(record.month);
    if (vintage === undefined) {
      throw new Error(`Narrated brief ${key} has no accepted vintage for ${record.month}`);
    }
    return {
      id: `ai:brief:${key}`,
      occurredAt: record.narration.generatedAt,
      purpose: 'commentary_headline',
      modelId: record.narration.modelId ?? 'no-model:deterministic-template',
      promptVersion: NARRATION_PROMPT_VERSION,
      dataVintageId: vintage.id,
      figureRefs: Object.keys(record.figures).map(
        (figure) => `${figure}:group:${record.month}:${record.month}`,
      ),
      output: `${record.narration.headline}\n${record.narration.body}`,
      outputObjectId: `brief:${key}`,
      review: { outcome: 'pending' },
    };
  });
}

/** Build the complete controller view from one already-resolved URL view. */
export function controlsFor(view: View): ControlsViewModel {
  const model = world();
  const visibleEntityIds = new Set(view.permission.entityIds);
  const groupReadable =
    view.entityId === 'group' &&
    tradingEntities().every((entity) => visibleEntityIds.has(entity.id));

  const visibleSources = sourceStatuses(model.register).filter((status) =>
    status.source.entityIds.some((entityId) => visibleEntityIds.has(entityId)),
  );
  const visibleSourceIds = new Set(visibleSources.map((status) => status.source.id));
  const visibleLoads = sourceLoads(model.register).filter((load) =>
    visibleSourceIds.has(load.source.id),
  );

  const close = closeReadinessFor(
    model.closePositions.filter((position) => visibleEntityIds.has(position.entityId)),
    view.through,
  );

  const rawMapping = mappingControlFor(model.mappingSets, view.through);
  const mapping =
    rawMapping === undefined
      ? null
      : scopeMapping(rawMapping, visibleEntityIds, groupReadable);
  const mappingVersions = mappingControls(model.mappingSets).map((control) =>
    scopeMapping(control, visibleEntityIds, groupReadable),
  );

  const commentary = seedCommentaryQueue(model).filter((item) =>
    item.anchor.entityId === 'group'
      ? groupReadable
      : visibleEntityIds.has(item.anchor.entityId),
  );
  const aiLog = [
    ...committedNarrationLog(model, groupReadable),
    ...aiUsageLogForCommentary(commentary),
  ];
  const published = commentary.find(
    (item): item is CommentaryItem & { readonly publishedSnapshot: PublishedCommentarySnapshot } =>
      item.publishedSnapshot !== undefined,
  );
  const allLoads = sourceLoads(model.register);
  const pinnedLoad =
    published === undefined
      ? undefined
      : allLoads.find(
          (load) => load.vintage.id === published.publishedSnapshot.dataVintageId,
        );
  const lineage =
    published === undefined || pinnedLoad === undefined
      ? null
      : {
          item: published,
          snapshot: published.publishedSnapshot,
          pinnedFigure: computeMeasure(published.anchor.measureId, {
            ...contextOf(view),
            scope: published.publishedSnapshot.period,
            asOfVintage: published.publishedSnapshot.dataVintageId,
          }),
          currentFigure: computeMeasure(published.anchor.measureId, {
            ...contextOf(view),
            scope: published.publishedSnapshot.period,
          }),
          load: pinnedLoad,
          laterRestatements: allLoads.filter(
            (load) =>
              load.vintage.restatesVintageId === published.publishedSnapshot.dataVintageId,
          ),
        };

  return {
    groupReadable,
    sourceStatuses: visibleSources,
    recentLoads: [...visibleLoads]
      .sort((a, b) => b.vintage.loadedAt.localeCompare(a.vintage.loadedAt))
      .slice(0, 12),
    totalLoads: visibleLoads.length,
    close,
    checks: groupReadable ? reconciliationChecks(model, view.through) : null,
    mapping,
    mappingVersions,
    measures: MEASURES,
    versions: VERSIONS,
    commentary,
    aiLog,
    lineage,
    groupRefusal: refusalFor(view, 'group'),
    requestedRefusal:
      view.deniedEntityId === undefined ? null : refusalFor(view, view.deniedEntityId),
  };
}
