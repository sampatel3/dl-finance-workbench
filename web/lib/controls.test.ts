import { describe, expect, it } from 'vitest';

import { controlsFor } from './controls';
import { NARRATION } from './narration.generated';
import { viewOf } from './world';

describe('the controls projection', () => {
  it('proves the seeded July close, reconciliation, mapping and publication controls', () => {
    const controls = controlsFor(viewOf());

    expect(controls.sharedSourceMetadataWithheld).toBe(false);
    expect(controls.close).toMatchObject({ closed: 4, total: 5, ready: false });
    expect(controls.close.open[0]).toMatchObject({
      entityName: 'Kestrel Inc',
      state: 'submitted',
    });

    const intercompany = controls.checks?.find(
      (check) => check.id === 'intercompany_trading',
    );
    expect(intercompany).toMatchObject({ status: 'failed', differenceMinor: 48_000 * 100 });
    expect(intercompany?.sides[0].entityNames).toContain('Kestrel Manufacturing Ltd');
    expect(intercompany?.sides[1].entityNames).toContain(
      'Kestrel Gulf Technical Services FZ-LLC',
    );

    expect(controls.mapping).toMatchObject({
      unmappedCount: 2,
      amountAtStakeMinor: 212_000 * 100,
    });
    expect(controls.lineage?.snapshot.dataVintageId).toBe('v-2026-06-core');
    expect(controls.lineage?.pinnedFigure.value).not.toBeNull();
    expect(controls.lineage?.pinnedFigure.value).not.toBe(
      controls.lineage?.currentFigure.value,
    );
    expect(controls.lineage?.laterRestatements.map((load) => load.vintage.id)).toContain(
      'v-2026-07-restate-2026-06',
    );
    expect(controls.aiLog).toHaveLength(
      controls.commentary.length + Object.keys(NARRATION).length,
    );
    for (const key of Object.keys(NARRATION)) {
      expect(controls.aiLog).toContainEqual(
        expect.objectContaining({ outputObjectId: `brief:${key}` }),
      );
    }
    expect(controls.aiLog.find((entry) => entry.outputObjectId?.startsWith('brief:'))).toMatchObject({
      modelId: 'no-model:deterministic-template',
      promptVersion: 'overview-commentary-v1',
    });
  });

  it('does not project group controls or group audit rows to the Gulf controller', () => {
    const controls = controlsFor(viewOf({ as: 'gulf-controller', entity: 'group' }));

    expect(controls.groupReadable).toBe(false);
    expect(controls.checks).toBeNull();
    expect(controls.close).toMatchObject({ closed: 1, total: 1, ready: true });
    expect(controls.mapping?.unmapped).toEqual([]);
    expect(controls.mapping?.totalCodes).toBeNull();
    expect(controls.commentary).toEqual([]);
    expect(controls.aiLog).toEqual([]);
    expect(controls.lineage).toBeNull();
    expect(controls.sharedSourceMetadataWithheld).toBe(true);
    expect(controls.sourceStatuses.map((status) => status.source.id)).toEqual(['fusion-gulf']);
    expect(controls.sourceStatuses[0]?.latestStatus).toBe('accepted');
    expect(new Set(controls.recentLoads.map((load) => load.source.id))).toEqual(
      new Set(['fusion-gulf']),
    );
    expect(controls.totalLoads).toBe(controls.sourceStatuses[0]?.loads.length);
    expect(controls.totalLoads).toBeGreaterThan(0);
    expect(controls.requestedRefusal).toMatch(/cannot read group figures/i);
  });

  it('withholds every shared source history instead of exposing source-wide counts as Gulf data', () => {
    const view = viewOf({ as: 'group-controller', entity: 'gulf' });
    const controls = controlsFor(view);
    const granted = new Set(view.permission.entityIds);
    const forbiddenSharedSources = new Set([
      'plan-anaplan',
      'psa',
      'crm',
      'payroll',
      'bank',
    ]);

    for (const status of controls.sourceStatuses) {
      expect(status.source.entityIds.every((entityId) => granted.has(entityId))).toBe(true);
      expect(forbiddenSharedSources.has(status.source.id)).toBe(false);
    }
    for (const load of controls.recentLoads) {
      expect(load.source.entityIds.every((entityId) => granted.has(entityId))).toBe(true);
      expect(forbiddenSharedSources.has(load.source.id)).toBe(false);
    }
    if (controls.lineage !== null) {
      expect(controls.lineage.load.source.entityIds.every((entityId) => granted.has(entityId))).toBe(
        true,
      );
    }
  });

  it('withholds a partially intersecting ledger even from a broadly privileged principal narrowed to one entity', () => {
    const controls = controlsFor(
      viewOf({ as: 'group-controller', entity: 'manufacturing' }),
    );

    // SAP UK also serves Services; every other Manufacturing feed is shared group-wide. None of
    // their aggregate histories can truthfully be presented as Manufacturing-only metadata.
    expect(controls.sharedSourceMetadataWithheld).toBe(true);
    expect(controls.sourceStatuses).toEqual([]);
    expect(controls.recentLoads).toEqual([]);
    expect(controls.totalLoads).toBe(0);
    expect(controls.lineage).toBeNull();
  });
});
