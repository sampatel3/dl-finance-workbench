import { describe, expect, it } from 'vitest';

import { controlsFor } from './controls';
import { NARRATION } from './narration.generated';
import { viewOf } from './world';

describe('the controls projection', () => {
  it('proves the seeded July close, reconciliation, mapping and publication controls', () => {
    const controls = controlsFor(viewOf());

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
    expect(
      controls.sourceStatuses.find((status) => status.source.id === 'fusion-gulf')?.latestStatus,
    ).toBe('accepted');
    expect(controls.totalLoads).toBeGreaterThan(0);
    expect(controls.requestedRefusal).toMatch(/cannot read group figures/i);
  });
});
