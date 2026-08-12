/**
 * The detector, proved both ways.
 *
 * Firing on the demo's own world is the easy half. The half that matters is staying quiet on
 * the healthy fixture: a false positive in front of a reader destroys trust in everything
 * else on the screen, so a detector that fires on a healthy book is worse than no detector
 * at all.
 */

import { describe, expect, test } from 'vitest';
import { RUN_LENGTH, findings } from './findings';
import { healthyWorld, world } from './world';

describe('the declining-volume detector', () => {
  test('finds the condition planted in the demo world', () => {
    const found = findings(world());
    expect(found).toHaveLength(1);
    expect(found[0]?.site).toBe('East');
    expect(found[0]?.months).toEqual(['2026-04', '2026-05', '2026-06']);
    expect(found[0]?.change).toBeLessThan(0);
  });

  test('reports exactly the run length it claims', () => {
    expect(findings(world())[0]?.months).toHaveLength(RUN_LENGTH);
  });

  test('stays quiet on the healthy fixture', () => {
    expect(findings(healthyWorld())).toEqual([]);
  });
});
