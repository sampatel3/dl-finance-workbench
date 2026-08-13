import { describe, expect, it } from 'vitest';
import { seedCommentaryQueue } from '@kestrel/model';

import {
  COMMENTARY_STATES,
  carriedCommentary,
  commentaryAffordances,
  commentaryEvidence,
  commentaryFilterHref,
  commentaryForView,
} from './commentary';
import { principalById } from './permissions';
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
