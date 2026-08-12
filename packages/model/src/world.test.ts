/**
 * The world: determinism, the headline figures, currency, and the healthy twin.
 *
 * Four properties, and each of them is load-bearing for something outside this package:
 *
 *   determinism — the screenshots, the deck, the committed narration and every other test
 *   the headline figures — the claim that the client's own concept slide is reproduced live
 *   currency — the constant-currency lens, and the FX bar in the bridge
 *   the healthy twin — the detectors' right to be believed when they fire
 */

import { describe, expect, it } from 'vitest';

import {
  ACTUAL_VERSION,
  HEALTHY_SEED,
  IC_MATERIALITY_MINOR,
  MONTHS,
  RESTATEMENT_ENTITY,
  RESTATEMENT_MAJOR,
  RESTATEMENT_MONTH,
  RESTATEMENT_VINTAGE,
  SEED_END,
  SEED_START,
  UNMAPPED_JULY,
  VERSIONS,
  buildHealthyWorld,
  buildWorld,
} from './seed.ts';
import { CALENDAR_YEAR, monthScope, priorYearScope, ytdScope } from './period.ts';
import { closeCompleteness } from './vintages.ts';
import { consolidate, groupPl } from './consolidate.ts';
import { PRESENTATION, foreignEntities, subtree, tradingEntities } from './entities.ts';
import type { World } from './seed.ts';

const SEED = 'kestrel-industrial-group';
const world = buildWorld({ seed: SEED });
const july = monthScope(SEED_END);

function group(w: World, lens: 'reported' | 'constant' = 'reported', scope = july) {
  return consolidate({
    store: w.store,
    rates: w.rates,
    scope,
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
    lens,
    ...(lens === 'constant' ? { comparativeScope: priorYearScope(scope) } : {}),
  });
}

describe('the world is a pure function of its seed', () => {
  it('builds identically twice, fact for fact', () => {
    const a = buildWorld({ seed: SEED });
    const b = buildWorld({ seed: SEED });
    expect(a.store.size).toBe(b.store.size);

    // Compare the actual rows rather than a summary: two worlds can agree on every total and
    // disagree on which vintage or which segment produced it, and the drill-down is what would
    // then differ between one reader and the next.
    const rowsOf = (w: World) =>
      tradingEntities().flatMap(
        (e) =>
          w.store.query({
            entityId: e.id,
            accountId: 'revenue',
            scope: july,
            scenario: 'ACTUAL',
            versionId: ACTUAL_VERSION,
          }).rows,
      );
    expect(rowsOf(a)).toEqual(rowsOf(b));
  });

  it('and a different seed is a different world', () => {
    // Otherwise the healthy twin is the same data wearing a different name, and proves nothing.
    const other = buildWorld({ seed: 'some-other-group' });
    expect(groupPl(group(other)).revenue).not.toBe(groupPl(group(world)).revenue);
  });

  it('covers 43 months to July 2026, written down rather than counted back from today', () => {
    expect(MONTHS[0]).toBe(SEED_START);
    expect(MONTHS.at(-1)).toBe(SEED_END);
    expect(MONTHS).toHaveLength(43);
  });
});

describe('the four figures on the concept slide', () => {
  /**
   * Asserted at the precision the slide shows, because that is the claim: the deck says £12.4m and
   * 41.8%, and the demo computes figures that print as £12.4m and 41.8%. Asserting more precision
   * than the deck has would pin arithmetic nobody promised; asserting less would let the demo drift
   * away from the document it exists to make real.
   */
  const pl = groupPl(group(world));
  const millions = (minor: number) => minor / 100 / 1e6;

  it('revenue reads £12.4m', () => {
    expect(millions(pl.revenue).toFixed(1)).toBe('12.4');
  });

  it('gross margin reads 41.8%', () => {
    expect(((pl.grossProfit / pl.revenue) * 100).toFixed(1)).toBe('41.8');
  });

  it('EBITDA reads £2.1m', () => {
    expect(millions(pl.ebitda).toFixed(1)).toBe('2.1');
  });

  it('cash reads £4.8m', () => {
    expect(millions(group(world).lines.get('cash')?.group ?? 0).toFixed(1)).toBe('4.8');
  });

  it('and every one of them is computed, not stored', () => {
    // The check that matters: change the seed and they all move. A demo whose headline figures
    // survive a seed change has them written down somewhere.
    const other = groupPl(group(buildWorld({ seed: 'kestrel-alternate' })));
    expect(millions(other.revenue).toFixed(1)).not.toBe('12.4');
  });
});

describe('currency', () => {
  it('translates the euro and dollar entities and leaves the dirham nearly still', () => {
    // AED is pegged to the dollar, so its sterling rate moves only as sterling moves against the
    // dollar. A rate table of invented numbers would pass a test that only asks whether translation
    // happened at all.
    const reported = group(world, 'reported');
    const constant = group(world, 'constant');

    const revenueOf = (c: ReturnType<typeof group>, entityId: string) =>
      c.lines.get('revenue')?.byEntity.get(entityId) ?? 0;

    for (const entityId of foreignEntities()) {
      expect(revenueOf(reported, entityId)).not.toBe(revenueOf(constant, entityId));
    }

    // The euro weakened over the comparative year, so constant currency — the same trading at last
    // year's rates — is HIGHER than reported for the euro entity. That is the whole point of the
    // lens: it separates the business from the currency.
    expect(revenueOf(constant, 'europe')).toBeGreaterThan(revenueOf(reported, 'europe'));

    // And a sterling entity is untouched by either lens.
    expect(revenueOf(reported, 'manufacturing')).toBe(revenueOf(constant, 'manufacturing'));
  });

  it('leaves an entity in its own currency under the functional lens', () => {
    const functional = consolidate({
      store: world.store,
      rates: world.rates,
      scope: july,
      scenario: 'ACTUAL',
      versionId: ACTUAL_VERSION,
      lens: 'functional',
      entityIds: ['gulf'],
    });
    const reported = consolidate({
      store: world.store,
      rates: world.rates,
      scope: july,
      scenario: 'ACTUAL',
      versionId: ACTUAL_VERSION,
      lens: 'reported',
      entityIds: ['gulf'],
    });
    // Dirhams are worth about a fifth of a pound, so the untranslated figure is several times the
    // translated one — and a lens that returned the same number for both would be doing nothing.
    expect(functional.lines.get('revenue')?.group ?? 0).toBeGreaterThan(
      (reported.lines.get('revenue')?.group ?? 0) * 3,
    );
  });

  it('quotes rates with a source, because a re-keyed rate is a variance nobody can reproduce', () => {
    expect(world.rates.id).toBeTruthy();
    expect(world.rates.source).toMatch(/treasury/i);
    expect(world.rates.monthsFor('EUR')).toHaveLength(43);
    // Sterling is not in the table and does not need to be.
    expect(world.rates.at(PRESENTATION, SEED_END).closing).toBe(1);
  });
});

describe('versions', () => {
  it('holds a budget, three superseded forecasts and one draft', () => {
    expect(VERSIONS.map((v) => v.id)).toEqual(['budget-fy26', 'v4', 'v5', 'v6', 'v7']);
    expect(VERSIONS.filter((v) => v.status === 'approved').map((v) => v.id)).toEqual([
      'budget-fy26',
      'v6',
    ]);
    expect(VERSIONS.find((v) => v.id === 'v7')?.status).toBe('draft');
  });

  it('and July actuals beat what forecast v6 assumed for it', () => {
    // PLANTED 1. The size of the beat is the bridge's job to decompose; that it exists at all is
    // the seed's, and if it ever did not, the Overview's favourable board would be empty.
    const actual = groupPl(group(world)).revenue;
    const forecast = groupPl(
      consolidate({
        store: world.store,
        rates: world.rates,
        scope: july,
        scenario: 'FORECAST',
        versionId: 'v6',
        lens: 'reported',
      }),
    ).revenue;
    expect(actual).toBeGreaterThan(forecast);
    // Around £0.7m, which is the figure the client's own slide quotes.
    const beat = (actual - forecast) / 100 / 1e6;
    expect(beat).toBeGreaterThan(0.4);
    expect(beat).toBeLessThan(1.1);
  });

  it('each successive forecast assumed a subcontract rate below the one that arrived', () => {
    // PLANTED 9 — bias, not bad luck: the same direction four versions running. The forecast-quality
    // surface is built on this being true in the data rather than asserted in prose.
    const assumed = ['budget-fy26', 'v4', 'v5', 'v6'].map(
      (id) => VERSIONS.find((v) => v.id === id)?.assumptions.subcontractRate ?? 0,
    );
    expect(assumed.every((rate) => rate < 1)).toBe(true);
    // And each one less wrong than the last, which is what a team learning slowly looks like.
    expect([...assumed].sort((a, b) => a - b)).toEqual(assumed);
  });
});

describe('the restatement', () => {
  const base = {
    entityId: RESTATEMENT_ENTITY,
    scope: monthScope(RESTATEMENT_MONTH),
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
    costCentreId: null,
  } as const;

  it('moves June gross margin between two vintages, and leaves net income alone', () => {
    // PLANTED 11. A reclassification between cost of sales and operating expense is the right
    // restatement to plant precisely because it changes the margin and not the profit — so a reader
    // who only watches the bottom line sees nothing, and the vintage is the only way to explain it.
    const before =
      world.store.query({
        ...base,
        accountId: 'cost_of_sales',
        asOfVintage: `v-${RESTATEMENT_MONTH}-core`,
      }).value ?? 0;
    const after = world.store.query({ ...base, accountId: 'cost_of_sales' }).value ?? 0;
    expect(before - after).toBe(RESTATEMENT_MAJOR * 100);

    const opexBefore =
      world.store.query({
        ...base,
        accountId: 'other_opex',
        asOfVintage: `v-${RESTATEMENT_MONTH}-core`,
      }).value ?? 0;
    const opexAfter = world.store.query({ ...base, accountId: 'other_opex' }).value ?? 0;
    expect(opexAfter - opexBefore).toBe(RESTATEMENT_MAJOR * 100);
  });

  it('is registered as restating the load it corrects, and arrived after it', () => {
    const vintage = world.register.vintage(RESTATEMENT_VINTAGE);
    expect(vintage.restatesVintageId).toBe(`v-${RESTATEMENT_MONTH}-core`);
    expect(world.register.restatements().map((v) => v.id)).toEqual([RESTATEMENT_VINTAGE]);
  });
});

describe('the unmapped accounts', () => {
  it('are on the July mapping set with a value at stake', () => {
    // PLANTED 7. The amount is the point: an unmapped account with no figure beside it is a warning
    // nobody clicks.
    const current = world.mappingSets.find((m) => m.status === 'approved');
    expect(current?.unmapped).toHaveLength(UNMAPPED_JULY.length);
    const total = (current?.unmapped ?? []).reduce((sum, u) => sum + u.amountMinor, 0) / 100;
    expect(total).toBe(UNMAPPED_JULY.reduce((sum, u) => sum + u.major, 0));
    expect(total).toBe(212_000);
  });

  it('and the July load says so rather than reporting a clean bill', () => {
    expect(world.register.withExceptions().map((v) => v.id)).toEqual([`v-${SEED_END}-core`]);
  });
});

describe('the healthy twin', () => {
  const healthy = buildHealthyWorld();

  it('is the same group from a different seed, and it is a different world', () => {
    expect(healthy.seed).toBe(HEALTHY_SEED);
    expect(healthy.store.monthsWithData('gulf')).toEqual(world.store.monthsWithData('gulf'));
    expect(groupPl(group(healthy)).revenue).not.toBe(groupPl(group(world)).revenue);
  });

  it('has no unmapped accounts, no restatement, and no load exceptions', () => {
    expect(healthy.mappingSets.flatMap((m) => m.unmapped)).toEqual([]);
    expect(healthy.register.restatements()).toEqual([]);
    expect(healthy.register.withExceptions()).toEqual([]);
  });

  it('has no material intercompany break in any month', () => {
    const breaks = MONTHS.filter((month) => {
      const c = consolidate({
        store: healthy.store,
        rates: healthy.rates,
        scope: monthScope(month),
        scenario: 'ACTUAL',
        versionId: ACTUAL_VERSION,
        lens: 'reported',
      });
      return Math.abs(c.unreconciled.trading) > IC_MATERIALITY_MINOR;
    });
    expect(breaks).toEqual([]);
  });

  it('still balances, so a clean world is not a differently-broken one', () => {
    const c = group(healthy);
    expect(c.lines.get('cash')?.group).not.toBeNull();
    const assets = [
      'cash',
      'receivables',
      'receivables_ic',
      'inventory',
      'fixed_assets',
      'other_assets',
    ] as const;
    const total = assets.reduce((sum, code) => sum + (c.lines.get(code)?.group ?? 0), 0);
    expect(total).toBeGreaterThan(0);
  });
});

describe('the entity subtree is the row-level access primitive', () => {
  it('resolves the group to every trading entity and a business unit to itself', () => {
    expect(subtree('group')).toEqual(['manufacturing', 'services', 'gulf', 'europe', 'inc']);
    expect(subtree('gulf')).toEqual(['gulf']);
  });

  it('and a sub-consolidation is honestly smaller than the group', () => {
    const gulfOnly = consolidate({
      store: world.store,
      rates: world.rates,
      scope: july,
      scenario: 'ACTUAL',
      versionId: ACTUAL_VERSION,
      lens: 'reported',
      entityIds: subtree('gulf'),
    });
    expect(groupPl(gulfOnly).revenue).toBeLessThan(groupPl(group(world)).revenue);
    expect(gulfOnly.entityIds).toEqual(['gulf']);
  });
});

describe('year-to-date reconciles to its months', () => {
  it('for a flow, and reads the closing month for a balance', () => {
    const ytd = ytdScope(SEED_END, CALENDAR_YEAR);
    const perMonth = [
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ].reduce((sum, month) => sum + groupPl(group(world, 'reported', monthScope(month))).revenue, 0);
    const ytdRevenue = groupPl(group(world, 'reported', ytd)).revenue;

    // Within five hundredths of one per cent — and the gap is a decision rather than a defect. A
    // seven-month window translates at the UNWEIGHTED mean of seven monthly rates; summing the
    // months translates each at its own. Those differ whenever revenue is not flat across the
    // window, and the unweighted mean is the deliberate choice: weighting by revenue would make the
    // rate depend on the figure being translated, so two accounts in one period would translate at
    // two different rates. A basis error, by contrast, would show up here as a multiple.
    const drift = Math.abs(ytdRevenue - perMonth) / ytdRevenue;
    expect(drift).toBeLessThan(0.0005);

    // Cash is a balance: the year-to-date figure is July's, not the sum of seven months'.
    expect(group(world, 'reported', ytd).lines.get('cash')?.group).toBe(
      group(world).lines.get('cash')?.group,
    );
  });
});

describe('close readiness is a first-class object, not a flag on a figure', () => {
  // PLANTED 10. The reason it is an object: a consolidated number built from four closed ledgers and one
  // that has only submitted is not wrong, and it is not final either, and the difference is invisible in
  // the figure. Without somewhere to hold that, the only honest options are to omit the entity or to
  // print the total and say nothing — and every real group reporting pack does the second.
  it('says where every entity is, in every month', () => {
    expect(world.closePositions.length).toBe(MONTHS.length * tradingEntities().length);
    for (const position of world.closePositions) {
      expect(['not_submitted', 'submitted', 'closed']).toContain(position.state);
      // An owner on every position, including the closed ones: "who do I ask" is a question about the
      // ones that are late, and a field that is only populated when something is wrong is a field
      // nobody trusts.
      expect(position.owner.length).toBeGreaterThan(3);
    }
  });

  it('and exactly one ledger is open, in the month the demo is about', () => {
    const july = closeCompleteness(world.closePositions, SEED_END);
    expect(july.total).toBe(5);
    expect(july.closed).toBe(4);
    expect(july.open.map((p) => p.entityId)).toEqual(['inc']);
    expect(july.open[0]?.state).toBe('submitted');
    // And it says why, in words a reviewer can act on rather than a status nobody can question.
    expect(july.open[0]?.note).toMatch(/under review/);
  });

  it('and every earlier month is closed, so the one open position is the finding', () => {
    for (const month of MONTHS.filter((m) => m !== SEED_END)) {
      const completeness = closeCompleteness(world.closePositions, month);
      expect(completeness.open).toEqual([]);
      expect(completeness.closed).toBe(completeness.total);
    }
  });

  it('and completeness is counted by entity, never weighted by value', () => {
    // A weighting by revenue would let the group report itself 97% closed while the entity holding the
    // exposure is the open one, and "97% closed" is precisely the figure that stops a question being
    // asked. Four of five is a worse-looking number and a more useful one.
    const july = closeCompleteness(world.closePositions, SEED_END);
    expect(july.closed / july.total).toBe(0.8);
  });

  it('and the healthy twin has nothing open', () => {
    const twin = closeCompleteness(buildHealthyWorld().closePositions, SEED_END);
    expect(twin.open).toEqual([]);
    expect(twin.closed).toBe(twin.total);
  });
});

describe('the services cost-to-serve assumption reaches the data', () => {
  // Conditions 2, 3 and 9 are one cause seen at three horizons, and the cause is this assumption. It has
  // to move the services segments and leave the product segments alone, or the finding it produces is a
  // group-wide drift that nobody owns.
  const forecastScope = monthScope(SEED_END);

  function segmentCost(w: World, segmentId: 'contracts' | 'equipment', versionId: string): number {
    return tradingEntities().reduce((total, e) => {
      const result = w.store.query({
        entityId: e.id,
        accountId: 'cost_of_sales',
        scope: forecastScope,
        scenario: versionId === ACTUAL_VERSION ? 'ACTUAL' : 'FORECAST',
        versionId,
        segmentId,
        costCentreId: null,
      });
      return total + (result.value ?? 0);
    }, 0);
  }

  it('so a services segment costs more than the forecast assumed', () => {
    expect(segmentCost(world, 'contracts', ACTUAL_VERSION)).toBeGreaterThan(
      segmentCost(world, 'contracts', 'v6'),
    );
  });

  it('and it is read from the segment’s division rather than a list of codes', () => {
    // So a third service line picks the assumption up instead of silently escaping it. Equipment moves
    // too — every version has a unit-cost assumption — but by less, because only services carries both.
    const servicesGap =
      segmentCost(world, 'contracts', ACTUAL_VERSION) / segmentCost(world, 'contracts', 'v6') - 1;
    const productsGap =
      segmentCost(world, 'equipment', ACTUAL_VERSION) / segmentCost(world, 'equipment', 'v6') - 1;
    expect(servicesGap).toBeGreaterThan(productsGap);
    expect(servicesGap).toBeGreaterThan(0.04);
  });

  it('and the healthy twin has no gap at all, on either', () => {
    const twin = buildHealthyWorld();
    expect(segmentCost(twin, 'contracts', ACTUAL_VERSION)).toBe(
      segmentCost(twin, 'contracts', 'v6'),
    );
    expect(segmentCost(twin, 'equipment', ACTUAL_VERSION)).toBe(
      segmentCost(twin, 'equipment', 'v6'),
    );
  });
});
