import { describe, expect, it } from 'vitest';
import { monthCount, seedCommentaryQueue } from '@kestrel/model';

import {
  COMMENTARY_STATES,
  carriedCommentary,
  commentaryAffordances,
  commentaryEvidence,
  commentaryFilterHref,
  commentaryForView,
  commentaryPeriodLabel,
  commentarySelectionForView,
  selectedCommentaryForView,
} from './commentary';
import { principalById, resolvePermissionScope } from './permissions';
import { viewOf, world } from './world';

describe('the governed commentary queue', () => {
  it('contains every approval state and carries the prior published margin item forward', () => {
    const queue = seedCommentaryQueue(world());
    expect(new Set(queue.map((item) => item.state))).toEqual(new Set(COMMENTARY_STATES));

    const currentMargin = queue.find(
      (item) => item.anchor.measureId === 'gross_margin' && item.state === 'in_review',
    );
    expect(currentMargin).toBeDefined();
    const prior = carriedCommentary(queue, currentMargin!);
    expect(prior?.period.endMonth).toBe('2026-06');
    expect(prior?.dataVintageId).toBeDefined();
  });

  it('names every seeded reporting grain without collapsing it to the closing month', () => {
    const queue = seedCommentaryQueue(world());
    const labels = new Map(queue.map((item) => [item.period.type, commentaryPeriodLabel(item.period)]));

    expect(labels.get('MONTH')).toMatch(/Jul 2026/);
    expect(labels.get('QUARTER')).toMatch(/^Q2 2026$/);
    expect(labels.get('HALF_YEAR')).toMatch(/^H1 2026$/);
    expect(labels.get('FISCAL_YEAR')).toMatch(/^FY2025$/);
  });

  it('treats the anchor as a row-level read and does not leak group commentary to Gulf', () => {
    const queue = seedCommentaryQueue(world());
    expect(commentaryForView(queue, viewOf())).toHaveLength(queue.length);
    expect(commentaryForView(queue, viewOf({ as: 'gulf-controller' }))).toEqual([]);
    expect(
      commentaryForView(queue, viewOf({ as: 'gulf-controller', entity: 'group' })),
    ).toEqual([]);
  });

  it('exposes only the state transitions the current role may take', () => {
    const queue = seedCommentaryQueue(world());
    const review = queue.find((item) => item.state === 'in_review');
    const approved = queue.find((item) => item.state === 'approved');
    expect(review).toBeDefined();
    expect(approved).toBeDefined();

    expect(
      commentaryAffordances(review!, principalById('group-controller')).map((entry) => entry.action),
    ).toEqual(['approve', 'reject']);
    expect(commentaryAffordances(review!, principalById('group-executive'))).toEqual([]);
    expect(
      commentaryAffordances(approved!, principalById('group-executive')).map(
        (entry) => entry.action,
      ),
    ).toEqual(['publish']);
    expect(commentaryAffordances(approved!, principalById('group-fpa'))).toEqual([]);
  });

  it('projects the selected period and comparator into a new unapproved draft', () => {
    const selectedView = viewOf({
      period: 'quarter',
      month: '2026-06',
      comparator: 'prior_year',
    });
    const item = selectedCommentaryForView(world(), selectedView);
    const evidence = commentaryEvidence(item, selectedView, world());

    expect(item.state).toBe('draft');
    expect(item.period).toEqual(selectedView.scope);
    expect(item.comparatorId).toBe('prior_year');
    expect(item.headline).toMatch(/Q2 FY26.*prior year/i);
    expect(evidence.comparison.comparator.scope).toMatchObject({
      startMonth: '2025-04',
      endMonth: '2025-06',
    });
    expect(monthCount(evidence.comparison.comparator.scope!)).toBe(monthCount(item.period));
  });

  it('recomputes selected commentary when period or comparator changes', () => {
    const quarter = viewOf({ period: 'quarter', month: '2026-06', comparator: 'prior_period' });
    const halfYear = viewOf({ period: 'half_year', month: '2026-06', comparator: 'budget' });
    const quarterItem = selectedCommentaryForView(world(), quarter);
    const halfYearItem = selectedCommentaryForView(world(), halfYear);

    expect(quarterItem.id).not.toBe(halfYearItem.id);
    expect(commentaryPeriodLabel(quarterItem.period)).toBe('Q2 2026');
    expect(commentaryPeriodLabel(halfYearItem.period)).toBe('H1 2026');
    expect(quarterItem.comparatorId).toBe('prior_period');
    expect(halfYearItem.comparatorId).toBe('budget');
    expect(commentaryEvidence(quarterItem, quarter, world()).comparison.comparator.id).toBe(
      'prior_period',
    );
    expect(commentaryEvidence(halfYearItem, halfYear, world()).comparison.comparator.id).toBe(
      'budget',
    );
  });

  it('carries a performance segment row through commentary to only that segment’s source rows', () => {
    const view = viewOf({ comparator: 'forecast' });
    const item = selectedCommentaryForView(world(), view, {
      measureId: 'gross_margin',
      segmentId: 'contracts',
    });
    const evidence = commentaryEvidence(item, view, world());

    expect(item.anchor).toMatchObject({ measureId: 'gross_margin', segmentId: 'contracts' });
    expect(item.headline).toMatch(/gross margin commentary/i);
    expect(evidence.sourceRows.length).toBeGreaterThan(0);
    expect(new Set(evidence.sourceRows.map((row) => row.segmentLabel))).toEqual(
      new Set(['Service contracts']),
    );
  });

  it('cannot replace a principal’s mandatory segment with a commentary deep link', () => {
    const basePrincipal = principalById('group-fpa');
    const principal = {
      ...basePrincipal,
      grant: {
        ...basePrincipal.grant,
        dimensionFilters: { segmentId: 'contracts' as const },
      },
    };
    const resolved = resolvePermissionScope(principal);
    expect(resolved.allowed).toBe(true);
    if (!resolved.allowed) return;
    const view = { ...viewOf({ as: 'group-fpa' }), principal, permission: resolved.scope };

    const selection = commentarySelectionForView(world(), view, {
        measureId: 'gross_margin',
        segmentId: 'equipment',
      });
    expect(selection.refusal).toMatch(/restricted to the contracts segment/i);
    expect(selection.item.anchor.segmentId).toBe('contracts');

    const item = selectedCommentaryForView(world(), view, { measureId: 'gross_margin' });
    const evidence = commentaryEvidence(item, view, world());
    expect(item.anchor.segmentId).toBe('contracts');
    expect(new Set(evidence.sourceRows.map((row) => row.segmentLabel))).toEqual(
      new Set(['Service contracts']),
    );
  });
});

describe('commentary evidence', () => {
  it('makes every detailed driver amount add back to the movement it quotes', () => {
    const queue = seedCommentaryQueue(world());
    const visible = commentaryForView(queue, viewOf());
    for (const item of visible) {
      const evidence = commentaryEvidence(item, viewOf(), world());
      expect(evidence.drivers.length).toBeGreaterThan(0);
      expect(evidence.driversSum, item.id).toBe(true);
    }
  });

  it('reconciles constant-currency gross-margin drivers across every reporting grain and time comparator', () => {
    const periods = ['month', 'quarter', 'half_year', 'year', 'ytd'] as const;
    const comparators = ['prior_period', 'prior_year'] as const;

    for (const period of periods) {
      for (const comparator of comparators) {
        const selectedView = viewOf({
          period,
          month: '2026-07',
          comparator,
          lens: 'constant',
        });
        const item = selectedCommentaryForView(world(), selectedView, {
          measureId: 'gross_margin',
        });
        const evidence = commentaryEvidence(item, selectedView, world());

        expect(evidence.driversSum, `${period}/${comparator}`).toBe(true);
        expect(evidence.driverTotal, `${period}/${comparator}`).toBeCloseTo(
          evidence.movement ?? Number.NaN,
          8,
        );
      }
    }
  });

  it('reads a publication through its pinned vintage even after a restatement is current', () => {
    const queue = seedCommentaryQueue(world());
    const published = queue.find((item) => item.state === 'published');
    expect(published?.publishedSnapshot).toBeDefined();

    const evidence = commentaryEvidence(published!, viewOf(), world());
    expect(evidence.pinned).toBe(true);
    expect(evidence.dataVintageId).toBe(published!.publishedSnapshot!.dataVintageId);
    expect(world().register.currentFor(published!.period.endMonth)?.id).not.toBe(
      evidence.dataVintageId,
    );
  });

  it('keeps approved cash wording aligned to the monthly comparison it evidences', () => {
    const queue = seedCommentaryQueue(world());
    const cash = queue.find(
      (item) => item.anchor.measureId === 'cash' && item.state === 'approved',
    );
    expect(cash).toBeDefined();
    if (cash === undefined) return;
    const evidence = commentaryEvidence(cash, viewOf(), world());
    expect(cash.headline).toMatch(/closing cash.*below.*forecast/i);
    expect(evidence.comparison.current.value ?? 0).toBeLessThan(
      evidence.comparison.comparativeValue ?? 0,
    );
  });

  it('keeps period, version and comparator parameters when filtering the queue', () => {
    const href = commentaryFilterHref(
      {
        period: 'quarter',
        month: '2026-06',
        version: 'v6',
        comparator: 'prior_year',
        entity: 'group',
        state: 'draft',
      },
      'published',
    );
    const url = new URL(href, 'https://demo.invalid');
    expect(url.searchParams.get('period')).toBe('quarter');
    expect(url.searchParams.get('month')).toBe('2026-06');
    expect(url.searchParams.get('version')).toBe('v6');
    expect(url.searchParams.get('comparator')).toBe('prior_year');
    expect(url.searchParams.get('state')).toBe('published');
  });
});
