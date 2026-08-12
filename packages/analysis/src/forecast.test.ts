/**
 * Drivers, and the version diff.
 *
 * The diff is the object that answers the client's own third illustrative question — *"which drivers
 * changed since forecast v6?"* — which the PRD asks for and has nothing to answer with. The property
 * that matters is completeness: if applying every recorded change to the earlier assumption set does
 * not reproduce the later one exactly, the surface is telling a reader nothing else moved when
 * something did.
 */

import { describe, expect, it } from 'vitest';

import { ACTUAL_VERSION, SEED_END, buildWorld, monthScope, subtree } from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { allEntityIds, computeMeasure } from '@kestrel/measures';

import { buildBridge } from './bridge.ts';
import { DRIVERS, attributeBar, driver, driversFor, readDriver } from './drivers.ts';
import {
  ASSUMPTIONS,
  DIFF_MEASURES,
  activeApprovedForecast,
  applyChanges,
  version,
  versionDiff,
  versionList,
} from './forecast.ts';

const world = buildWorld({ seed: 'kestrel-industrial-group' });

function ctx(overrides: Partial<MeasureContext> = {}): MeasureContext {
  return {
    store: world.store,
    rates: world.rates,
    scope: monthScope(SEED_END),
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
    lens: 'reported',
    entityIds: allEntityIds(),
    ...overrides,
  };
}

describe('a driver is a thing somebody can change', () => {
  it('so every one of them names an owner and the measures it moves', () => {
    for (const d of DRIVERS) {
      expect(d.owner).toBeTruthy();
      // A driver that moves nothing cannot explain anything, and a board item built on one is a
      // conversation with no other end.
      expect(d.moves.length).toBeGreaterThan(0);
      expect(['observed', 'assumed']).toContain(d.kind);
    }
  });

  it('and the graph can be walked from a measure back to its drivers', () => {
    const marginDrivers = driversFor('gross_margin').map((d) => d.id);
    expect(marginDrivers).toContain('subcontract_rate');
    expect(marginDrivers).toContain('utilisation');
    // Collection days do not move a margin. A graph where everything moves everything is not a graph.
    expect(marginDrivers).not.toContain('dso');
  });

  it('reads through the measure catalogue, so a driver cannot disagree with what it explains', () => {
    const rate = readDriver('subcontract_rate', ctx({ entityIds: subtree('gulf') }));
    expect(rate.value).toBe(
      computeMeasure('subcontract_rate', ctx({ entityIds: subtree('gulf') })).value,
    );
    expect(rate.value ?? 0).toBeGreaterThan(0);
  });

  it('and the two that are not measures are read from the segment quantities', () => {
    const units = readDriver('units', ctx());
    const price = readDriver('blended_price', ctx());
    expect(units.value ?? 0).toBeGreaterThan(0);
    expect(price.value ?? 0).toBeGreaterThan(0);
    // Units are whole things and are never translated.
    expect(Number.isInteger(units.value)).toBe(true);
  });

  it('throws on a driver that does not exist', () => {
    expect(() => driver('vibes')).toThrow(/Unknown driver/);
  });
});

describe('attribution joins a bar to the driver behind it', () => {
  const comparator = { id: 'forecast' as const, versionId: 'v6' };
  const bridge = buildBridge({ measureId: 'revenue', ctx: ctx(), comparator });
  const comparativeCtx = ctx({ scenario: 'FORECAST', versionId: 'v6' });

  it('names the driver, and its own movement, in the same breath', () => {
    const volume = bridge.bars.find((bar) => bar.kind === 'volume');
    const attribution = attributeBar(volume!, ctx(), comparativeCtx);
    expect(attribution.driver?.id).toBe('units');
    expect(attribution.driverFrom).not.toBeNull();
    expect(attribution.driverTo).not.toBeNull();
    // The bar is favourable and the driver moved the same way, which is the coherence a reader checks.
    expect((attribution.driverTo ?? 0) > (attribution.driverFrom ?? 0)).toBe(true);
  });

  it('and says why, rather than leaving a blank, where no driver owns the bar', () => {
    const fx = bridge.bars.find((bar) => bar.kind === 'fx');
    if (fx !== undefined) {
      const attribution = attributeBar(fx, ctx(), comparativeCtx);
      expect(attribution.driver).toBeUndefined();
      expect(attribution.unattributed).toMatch(/treasury/);
    }
    const opening = bridge.bars.find((bar) => bar.kind === 'opening');
    expect(attributeBar(opening!, ctx(), comparativeCtx).unattributed).toMatch(/terminal/);
  });
});

describe('the version diff', () => {
  const diff = versionDiff('v6', 'v7', ctx());

  it('answers "which drivers changed since v6" with the ones that did, and every one is real', () => {
    expect(diff.changes.length).toBeGreaterThan(0);
    for (const change of diff.changes) {
      expect(change.from).not.toBe(change.to);
      expect(change.owner).toBeTruthy();
      expect(['up', 'down']).toContain(change.direction);
    }
  });

  it('and discriminates: v5 to v6 moved some assumptions and left others alone', () => {
    // v6 to v7 happens to move all seven, because v7 re-based every driver on July actuals. That is
    // a real answer and not a discriminating one, so the test that the diff can say "this one did
    // not move" has to use a pair where something genuinely held still.
    const earlier = versionDiff('v5', 'v6', ctx());
    expect(earlier.changes.length).toBeGreaterThan(0);
    expect(earlier.changes.length).toBeLessThan(ASSUMPTIONS.length);
    const moved = earlier.changes.map((change) => change.key);
    expect(moved).toContain('subcontractRate');
    expect(moved).not.toContain('dsoDays');
  });

  it('names the subcontract rate going up, which is the story v7 exists to tell', () => {
    const rate = diff.changes.find((change) => change.key === 'subcontractRate');
    expect(rate?.direction).toBe('up');
    // And through the graph, what that assumption moves.
    expect(rate?.moves).toContain('gross_margin');
    expect(rate?.moves).toContain('ebitda');
  });

  it('round-trips: applying the changes to v6 reproduces v7 exactly', () => {
    // The completeness test. A diff that misses a change tells a reader nothing else moved.
    expect(applyChanges(version('v6').assumptions, diff.changes)).toEqual(
      version('v7').assumptions,
    );
  });

  it('reports the total impact on the four measures a CFO asks about', () => {
    expect(diff.impact.map((i) => i.measureId)).toEqual([...DIFF_MEASURES]);
    for (const impact of diff.impact) {
      expect(impact.from).not.toBeNull();
      expect(impact.to).not.toBeNull();
    }
    // v7 assumes a higher subcontract rate and more collection days than v6, so margin is worse.
    const margin = diff.impact.find((i) => i.measureId === 'gross_margin');
    expect((margin?.movement ?? 0) < 0).toBe(true);
  });

  it('and refuses to split that impact between assumptions, saying so on the object', () => {
    // An attribution that looks precise and is really a proportional guess is worse than an honest
    // total, because a reader acts on it. The caveat travels with the diff so a surface cannot render
    // one without the other.
    expect(diff.attributionNote).toMatch(/marginal run/);
    for (const change of diff.changes) {
      expect(change).not.toHaveProperty('impact');
    }
  });

  it('is empty between a version and itself', () => {
    expect(versionDiff('v6', 'v6', ctx()).changes).toEqual([]);
  });
});

describe('the version list', () => {
  it('is chronological rather than sorted by id, so the budget is not between v4 and v5', () => {
    expect(versionList().map((v) => v.id)).toEqual(['budget-fy26', 'v4', 'v5', 'v6', 'v7']);
  });

  it('and the version in force is the approved forecast, not the draft on top of it', () => {
    expect(activeApprovedForecast().id).toBe('v6');
    expect(version('v7').status).toBe('draft');
  });
});
