/**
 * The world is a pure function of its seed, twice over.
 *
 * Two constructions in one process cannot catch a value that depends on the host — a locale,
 * a clock, a machine — so the deep-equality check is paired with figures pinned as literals.
 * A hard-coded expectation is the only thing that fails when the seed function starts
 * quietly reading something outside its seed.
 */

import { describe, expect, test } from 'vitest';
import { DEMO_SEED } from './demo';
import {
  HEALTHY_SEED,
  HEALTHY_SITES,
  LATEST_MONTH,
  MONTHS,
  SITES,
  buildWorld,
  healthyWorld,
  networkVolume,
  siteByName,
  world,
} from './world';

const spec = { seed: DEMO_SEED, sites: SITES, noiseScale: 0.022 };

/**
 * The pinned figures below are pinned against this literal, not against DEMO_SEED.
 *
 * DEMO_SEED is the one constant `demo new` rewrites, so a literal expectation measured
 * through it holds only in the template and fails in every generated demo — which says
 * nothing about the world builder and everything about the seed having changed. Held
 * fixed here, the expectation still does its real job: it is what fails if `buildWorld`
 * starts reading a locale, a clock or a machine rather than only its spec.
 */
const PINNED_SPEC = { seed: 'demo-kit-template', sites: SITES, noiseScale: 0.022 };

describe('the seeded world', () => {
  test('the same seed builds the same world', () => {
    expect(buildWorld(spec)).toEqual(buildWorld(spec));
  });

  test('a different seed builds a different world', () => {
    // Two seeds producing the same world are two seeds ignoring their seed.
    const other = buildWorld({ ...spec, seed: 'some-other-seed' });
    expect(other).not.toEqual(buildWorld(spec));
  });

  test('the memoised world is the world', () => {
    expect(world()).toEqual(buildWorld(spec));
  });

  test('figures are pinned, not merely reproducible', () => {
    const pinned = buildWorld(PINNED_SPEC);
    const east = siteByName(pinned, 'East');
    expect(east?.months.map((m) => m.volume)).toEqual([
      1078, 1094, 1119, 1099, 1127, 1150, 1120, 1137, 1089, 1071, 1009, 953,
    ]);
    expect(networkVolume(pinned, LATEST_MONTH.id)).toBe(4947);
  });

  test('ids are UUID-shaped and stable', () => {
    const ids = world().sites.map((s) => s.id);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(buildWorld(spec).sites.map((s) => s.id)).toEqual(ids);
  });

  test('the months are written down, not counted back from today', () => {
    // If this list were derived from the clock it would slide, and every screenshot,
    // pinned figure and tour sentence naming a month would go stale with it.
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]?.id).toBe('2025-07');
    expect(LATEST_MONTH.id).toBe('2026-06');
  });
});

describe('the healthy fixture', () => {
  test('is a different world from a different seed', () => {
    expect(HEALTHY_SEED).not.toBe(DEMO_SEED);
    expect(healthyWorld()).not.toEqual(world());
  });

  test('has nothing planted in it', () => {
    expect(HEALTHY_SITES.some((s) => s.declineFrom !== undefined)).toBe(false);
  });

  test('every site grows in every month', () => {
    // The claim the fixture rests on. If growth ever stops clearing the noise band, a site
    // could stumble by accident and the quiet-detector test below would be proving nothing.
    for (const site of healthyWorld().sites) {
      for (let i = 1; i < site.months.length; i++) {
        const now = site.months[i];
        const before = site.months[i - 1];
        expect(now === undefined || before === undefined || now.volume > before.volume).toBe(true);
      }
    }
  });
});
