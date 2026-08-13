/**
 * The governance domain is a projection over the world, not a second fixture beside it.
 *
 * These tests deliberately start from `buildWorld`: a Controls surface that says £212k while the
 * fact store contains some other amount is worse than no control at all. Sources, mappings, checks,
 * close readiness, commentary approvals and the AI log therefore all have to point back to the
 * same vintages and rows the finance model already uses.
 */

import { describe, expect, it } from 'vitest';

import {
  ACTUAL_VERSION,
  SEED_END,
  aiUsageLogForCommentary,
  appendAiUsage,
  buildHealthyWorld,
  buildWorld,
  carryForwardCommentary,
  closeReadinessFor,
  mappingControlFor,
  monthScope,
  reconciliationChecks,
  recordAiReview,
  seedCommentaryQueue,
  sourceLoads,
  sourceStatuses,
  transitionCommentary,
} from './index.ts';
import type { AiUsageEntry } from './index.ts';

const world = buildWorld({ seed: 'kestrel-industrial-group' });

describe('source and load controls', () => {
  it('joins every vintage to the source definition that owns it', () => {
    const loads = sourceLoads(world.register);
    expect(loads).toHaveLength(world.register.vintages().length);
    expect(loads).toHaveLength(world.months.length * world.register.sources().length + 1);

    const july = loads.find((load) => load.vintage.id === `v-${SEED_END}-core`);
    expect(july?.source.name).toBe('SAP S/4HANA — UK ledgers');
    expect(july?.validation).toBe('exceptions');
    expect(july?.vintage.rowCount).toBeGreaterThan(40_000);
  });

  it('keeps every configured source and its modelled load history visible', () => {
    const statuses = sourceStatuses(world.register);
    expect(statuses).toHaveLength(9);
    expect(statuses.find((status) => status.source.id === 'sap-uk')?.loads).toHaveLength(44);
    expect(statuses.find((status) => status.source.id === 'netsuite-us')?.loads).toHaveLength(
      world.months.length,
    );
    expect(statuses.every((status) => status.latestStatus !== 'not_loaded')).toBe(true);
  });

  it('binds facts to the feed that supplied them instead of the UK ledger by default', () => {
    const sourceOf = (
      entityId: string,
      accountId: 'revenue' | 'cash' | 'headcount',
      scenario: 'ACTUAL' | 'FORECAST' = 'ACTUAL',
      versionId = scenario === 'ACTUAL' ? ACTUAL_VERSION : 'v6',
    ): string | undefined => {
      const result = world.store.query({
        entityId,
        accountId,
        scope: monthScope(SEED_END),
        scenario,
        versionId,
        costCentreId: null,
        ...(accountId === 'revenue' ? {} : { segmentId: null }),
      });
      const vintage = result.vintageIds[0];
      return vintage === undefined ? undefined : world.register.vintage(vintage).sourceId;
    };

    expect(sourceOf('gulf', 'revenue')).toBe('fusion-gulf');
    expect(sourceOf('inc', 'revenue')).toBe('netsuite-us');
    expect(sourceOf('gulf', 'cash')).toBe('bank');
    expect(sourceOf('gulf', 'headcount')).toBe('payroll');
    expect(sourceOf('gulf', 'revenue', 'FORECAST', 'v6')).toBe('plan-anaplan');
  });
});

describe('mapping controls', () => {
  it('derives the two July exceptions and their £212k exposure from the mapping set', () => {
    const control = mappingControlFor(world.mappingSets, SEED_END);
    expect(control?.mappingSet.id).toBe('map-2026-07');
    expect(control?.unmapped).toHaveLength(2);
    expect(control?.amountAtStakeMinor).toBe(212_000 * 100);
    expect(control?.unmapped.map((row) => row.entityName)).toEqual([
      'Kestrel Services Ltd',
      'Kestrel Manufacturing Ltd',
    ]);
  });

  it('switches mapping versions at the effective-date boundary', () => {
    expect(mappingControlFor(world.mappingSets, '2026-06')?.mappingSet.version).toBe(1);
    expect(mappingControlFor(world.mappingSets, '2026-07')?.mappingSet.version).toBe(2);
  });
});

describe('named reconciliation checks', () => {
  const checks = reconciliationChecks(world, SEED_END);

  it('reports the balance sheet and mapping-to-trial-balance controls by name', () => {
    const balance = checks.find((check) => check.id === 'balance_sheet_identity');
    expect(balance?.status).toBe('passed');
    expect(balance?.differenceMinor).toBe(0);

    const mapping = checks.find((check) => check.id === 'mapping_to_trial_balance');
    expect(mapping?.status).toBe('passed');
    expect(mapping?.sides.map((side) => side.amountMinor)).toEqual([
      212_000 * 100,
      212_000 * 100,
    ]);
  });

  it('fails intercompany at exactly £48k and names the seller and buyer sides', () => {
    const intercompany = checks.find((check) => check.id === 'intercompany_trading');
    expect(intercompany?.status).toBe('failed');
    expect(intercompany?.differenceMinor).toBe(48_000 * 100);
    expect(intercompany?.sides[0]?.entityNames).toContain('Kestrel Manufacturing Ltd');
    expect(intercompany?.sides[1]?.entityNames).toContain(
      'Kestrel Gulf Technical Services FZ-LLC',
    );
  });

  it('passes the same checks in the healthy twin', () => {
    const healthy = reconciliationChecks(buildHealthyWorld(), SEED_END);
    expect(healthy.every((check) => check.status === 'passed')).toBe(true);
  });
});

describe('close readiness', () => {
  it('shows Kestrel Inc as submitted but not closed in July', () => {
    const readiness = closeReadinessFor(world.closePositions, SEED_END);
    expect(readiness.ready).toBe(false);
    expect(readiness.closed).toBe(4);
    expect(readiness.total).toBe(5);
    expect(readiness.open).toHaveLength(1);
    expect(readiness.open[0]).toMatchObject({
      entityId: 'inc',
      entityName: 'Kestrel Inc',
      state: 'submitted',
    });
  });

  it('is fully ready in the healthy twin', () => {
    expect(closeReadinessFor(buildHealthyWorld().closePositions, SEED_END)).toMatchObject({
      ready: true,
      closed: 5,
      total: 5,
      open: [],
    });
  });
});

describe('commentary approval', () => {
  const queue = seedCommentaryQueue(world);

  it('seeds the queue across every visible state, with a reason on rejection', () => {
    expect(queue.map((item) => item.state)).toEqual([
      'draft',
      'in_review',
      'approved',
      'published',
      'rejected',
    ]);
    const rejected = queue.find((item) => item.state === 'rejected');
    expect(rejected?.approvalHistory.at(-1)).toMatchObject({
      action: 'reject',
      actor: 'Group Financial Controller',
    });
    expect(rejected?.approvalHistory.at(-1)?.reason).toMatch(/entity-level/i);
  });

  it('enforces draft → review → approved → published and pins the approved vintage', () => {
    const draft = queue.find((item) => item.state === 'draft');
    expect(draft).toBeDefined();
    if (draft === undefined) return;

    const review = transitionCommentary(draft, {
      action: 'submit',
      actor: 'FP&A Manager',
      at: '2026-08-05T09:00:00Z',
    });
    const approved = transitionCommentary(review, {
      action: 'approve',
      actor: 'Group Financial Controller',
      at: '2026-08-05T10:00:00Z',
    });
    const published = transitionCommentary(approved, {
      action: 'publish',
      actor: 'Chief Financial Officer',
      at: '2026-08-05T11:00:00Z',
    });

    expect(published.state).toBe('published');
    expect(published.publishedSnapshot?.dataVintageId).toBe(draft.provenance.dataVintageId);
    expect(published.publishedSnapshot?.headline).toBe(draft.headline);
    expect(() =>
      transitionCommentary(draft, {
        action: 'publish',
        actor: 'Chief Financial Officer',
        at: '2026-08-05T11:00:00Z',
      }),
    ).toThrow(/cannot publish/i);
  });

  it('carries the latest published item onto the next period for the same anchor', () => {
    const current = queue.find(
      (item) => item.anchor.measureId === 'gross_margin' && item.period.endMonth === SEED_END,
    );
    expect(current).toBeDefined();
    if (current === undefined) return;

    const carried = carryForwardCommentary(queue, current);
    expect(carried?.period.endMonth).toBe('2026-06');
    expect(carried?.anchor).toEqual(current.anchor);
    expect(carried?.dataVintageId).toBe('v-2026-06-core');
  });
});

describe('the AI usage log', () => {
  it('has one immutable audit row per model-authored commentary item', () => {
    const queue = seedCommentaryQueue(world);
    const log = aiUsageLogForCommentary(queue);
    expect(log).toHaveLength(queue.length);
    expect(log.every((row) => row.modelId && row.promptVersion && row.dataVintageId)).toBe(true);
    expect(log.find((row) => row.review.outcome === 'rejected')?.review).toMatchObject({
      outcome: 'rejected',
      actor: 'Group Financial Controller',
    });
  });

  it('appends without rewriting history and records a human disposition once', () => {
    const entry: AiUsageEntry = {
      id: 'ai:question:2026-07:1',
      occurredAt: '2026-08-05T12:00:00Z',
      purpose: 'question_answer',
      modelId: 'claude-sonnet-5',
      promptVersion: 'ask-v1',
      dataVintageId: `v-${SEED_END}-core`,
      figureRefs: ['revenue:group:2026-07'],
      output: 'The governed answer.',
      review: { outcome: 'pending' },
    };
    const before: readonly AiUsageEntry[] = [];
    const appended = appendAiUsage(before, entry);
    const reviewed = recordAiReview(appended, entry.id, {
      outcome: 'edited',
      actor: 'FP&A Manager',
      at: '2026-08-05T12:05:00Z',
      finalOutput: 'The governed answer, edited.',
    });

    expect(before).toEqual([]);
    expect(appended[0]?.review.outcome).toBe('pending');
    expect(reviewed[0]?.review.outcome).toBe('edited');
    expect(() => appendAiUsage(appended, entry)).toThrow(/already exists/i);
    expect(() =>
      recordAiReview(reviewed, entry.id, {
        outcome: 'accepted',
        actor: 'FP&A Manager',
        at: '2026-08-05T12:06:00Z',
      }),
    ).toThrow(/already reviewed/i);
  });
});
