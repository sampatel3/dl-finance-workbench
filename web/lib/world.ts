/**
 * The demo's world: four sites, twelve months, two measures.
 *
 * This is placeholder data and is meant to be replaced — the schema, the entities and the
 * planted conditions are what a demo *is*, and the kit does not own them. What is not
 * placeholder is the shape of the file, and there are three rules in it worth keeping:
 *
 *   1. **The world is a pure function of its seed.** No `Math.random`, and no wall clock:
 *      the months are written down below rather than counted back from today, because a
 *      demo whose figures move a month after the screenshots were taken is a demo whose
 *      screenshots are wrong.
 *   2. **Every figure's seed text names every dimension it varies by** — the site, the
 *      month, the measure. Two figures built from the same text are the same figure.
 *   3. **The curve carries the story, the noise is only texture.** Growth is a rate written
 *      into the site's spec; `noise` is scaled to a couple of percent on top of it. A story
 *      told by randomness is a story that changes when the seed does.
 *
 * The whole cache a memory-tier demo needs is the `memoise` at the foot: every request in
 * this process reads one object, a new process builds an identical one, and nothing is ever
 * invalidated because nothing ever changes.
 */

import { memoise, noise, seededUuid } from '@demo-kit/data';
import { DEMO_SEED } from './demo';

export interface Month {
  readonly id: string;
  readonly label: string;
  /** Position in the series. Used by the growth curve, so it is part of the data. */
  readonly index: number;
}

/**
 * Written down, not derived. Twelve closed months; nothing here is "this month", so the
 * demo reads the same in August as it did in March.
 */
const MONTH_LIST = [
  { id: '2025-07', label: 'Jul 25', index: 0 },
  { id: '2025-08', label: 'Aug 25', index: 1 },
  { id: '2025-09', label: 'Sep 25', index: 2 },
  { id: '2025-10', label: 'Oct 25', index: 3 },
  { id: '2025-11', label: 'Nov 25', index: 4 },
  { id: '2025-12', label: 'Dec 25', index: 5 },
  { id: '2026-01', label: 'Jan 26', index: 6 },
  { id: '2026-02', label: 'Feb 26', index: 7 },
  { id: '2026-03', label: 'Mar 26', index: 8 },
  { id: '2026-04', label: 'Apr 26', index: 9 },
  { id: '2026-05', label: 'May 26', index: 10 },
  { id: '2026-06', label: 'Jun 26', index: 11 },
] as const satisfies readonly Month[];

export const MONTHS: readonly Month[] = MONTH_LIST;

/* Indexed off the tuple rather than off `MONTHS.at(-1)`: a fixed-length list has a last
   element the compiler can see, so the demo needs no runtime check for an empty calendar. */
export const LATEST_MONTH: Month = MONTH_LIST[11];

/** What a site is before the seed touches it. */
export interface SiteSpec {
  readonly name: string;
  /** Units dispatched in the first month, before noise. */
  readonly base: number;
  /** Month-on-month growth, as a rate. */
  readonly growth: number;
  /** Cost per unit, in pounds. */
  readonly unitCost: number;
  /**
   * The planted condition: from this month index on, the site loses ground every month. Undefined
   * means nothing is wrong with this site.
   */
  readonly declineFrom?: number;
}

/** How hard one monthly decline bites. Larger than the noise band, so a decline is a decline. */
const DECLINE_RATE = 0.055;

/**
 * The demo's own sites, with one condition planted in East from March.
 *
 * A demo needs something true to find, or the detector below, the brief and the chat have
 * nothing to be right about.
 */
export const SITES: readonly SiteSpec[] = [
  { name: 'North', base: 1180, growth: 0.011, unitCost: 4.4 },
  { name: 'South', base: 940, growth: 0.008, unitCost: 5.1 },
  { name: 'East', base: 1075, growth: 0.01, unitCost: 4.8, declineFrom: 8 },
  { name: 'Central', base: 1560, growth: 0.006, unitCost: 4.05 },
];

/**
 * The healthy twin: the same four sites with nothing wrong in any of them.
 *
 * Growth comfortably clears the noise band (see `HEALTHY_NOISE` below), so no site can
 * stumble into a run of declines by accident — which is the difference between a fixture
 * that proves the detector stays quiet and one that happens to.
 */
export const HEALTHY_SITES: readonly SiteSpec[] = [
  { name: 'North', base: 1180, growth: 0.014, unitCost: 4.4 },
  { name: 'South', base: 940, growth: 0.013, unitCost: 5.1 },
  { name: 'East', base: 1075, growth: 0.015, unitCost: 4.8 },
  { name: 'Central', base: 1560, growth: 0.012, unitCost: 4.05 },
];

/** Texture, at a couple of percent. Anything louder starts telling the story itself. */
const NOISE = 0.022;
/** The healthy fixture's band, held under its slowest growth rate so every month rises. */
const HEALTHY_NOISE = 0.004;

export interface SiteMonth {
  readonly month: string;
  /** Units dispatched. */
  readonly volume: number;
  /** What dispatching them cost, in pounds. */
  readonly cost: number;
}

export interface Site {
  readonly id: string;
  readonly name: string;
  readonly months: readonly SiteMonth[];
}

export interface World {
  readonly seed: string;
  readonly sites: readonly Site[];
}

export interface WorldSpec {
  readonly seed: string;
  readonly sites: readonly SiteSpec[];
  readonly noiseScale: number;
}

/** Two decimals for money, whole units for counts — rounded here so every reader agrees. */
const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export function buildWorld(spec: WorldSpec): World {
  const sites = spec.sites.map((site): Site => ({
    id: seededUuid(spec.seed, 'site', site.name),
    name: site.name,
    months: MONTHS.map((month): SiteMonth => {
      const curve = site.base * (1 + site.growth) ** month.index;
      const decline =
        site.declineFrom !== undefined && month.index >= site.declineFrom
          ? (1 - DECLINE_RATE) ** (month.index - site.declineFrom + 1)
          : 1;
      const texture = 1 + noise(`${spec.seed}|${site.name}|${month.id}|volume`) * spec.noiseScale;
      const volume = Math.round(curve * decline * texture);
      const costTexture =
        1 + noise(`${spec.seed}|${site.name}|${month.id}|cost`) * (spec.noiseScale / 2);
      return {
        month: month.id,
        volume,
        cost: round(volume * site.unitCost * costTexture, 2),
      };
    }),
  }));

  return { seed: spec.seed, sites };
}

/** The demo's world. Built once per process; identical in every process. */
export const world = memoise(() =>
  buildWorld({ seed: DEMO_SEED, sites: SITES, noiseScale: NOISE }),
);

/**
 * The second fixture, from a different seed, with none of the planted conditions in it.
 *
 * Its job is the one the demo's own world cannot do: prove the detectors stay QUIET. A
 * false positive in front of a reader destroys trust in everything else on the screen, so a
 * detector that fires on a healthy book is worse than no detector at all. It is also the
 * cheapest place to catch a seed function that is not actually a function of its seed —
 * two seeds producing the same world are two seeds ignoring their seed.
 *
 * It is a first-class artefact, not a test helper: `pnpm test` asserts against it, and it is
 * exported so a demo can render it side by side with the real world when explaining itself.
 */
export const HEALTHY_SEED = 'demo-kit-template-healthy';

export const healthyWorld = memoise(() =>
  buildWorld({ seed: HEALTHY_SEED, sites: HEALTHY_SITES, noiseScale: HEALTHY_NOISE }),
);

// --------------------------------------------------------------------------- reading it

export function siteByName(source: World, name: string): Site | undefined {
  const wanted = name.trim().toLowerCase();
  return source.sites.find((s) => s.name.toLowerCase() === wanted);
}

export function monthOf(site: Site, monthId: string): SiteMonth | undefined {
  return site.months.find((m) => m.month === monthId);
}

/** Every site's figure for one month, largest first. */
export function ranked(source: World, monthId: string): readonly { site: Site; row: SiteMonth }[] {
  return source.sites
    .flatMap((site) => {
      const row = monthOf(site, monthId);
      return row === undefined ? [] : [{ site, row }];
    })
    .sort((a, b) => b.row.volume - a.row.volume);
}

/** The whole network's volume in one month. */
export function networkVolume(source: World, monthId: string): number {
  return ranked(source, monthId).reduce((total, entry) => total + entry.row.volume, 0);
}

/** The whole network's cost in one month, to the penny. */
export function networkCost(source: World, monthId: string): number {
  return round(
    ranked(source, monthId).reduce((total, entry) => total + entry.row.cost, 0),
    2,
  );
}
