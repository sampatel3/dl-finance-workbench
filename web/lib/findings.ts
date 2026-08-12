/**
 * What the demo has found in its own data.
 *
 * One detector, deliberately: this is the placeholder for the part of a demo that is
 * actually its product, and one is enough to show the shape. Two rules are worth carrying
 * into whatever replaces it.
 *
 * **Code finds; the model phrases.** The finding below — which site, which months, how far
 * it fell — is decided here, in code that can be tested. `lib/narration.ts` hands the
 * result to a model to write down and checks every numeral in what comes back. Nothing the
 * model says can change what was found.
 *
 * **A detector has to be provable quiet.** `HEALTHY_SITES` in `world.ts` is a second seed
 * with none of the conditions planted in it, and `findings.test.ts` asserts this function
 * returns nothing for it. A detector proven only to fire is half-proven.
 */

import { MONTHS, type World } from './world';

/** How many consecutive monthly falls make a trend rather than a wobble. */
export const RUN_LENGTH = 3;

export interface Finding {
  readonly kind: 'declining-volume';
  readonly site: string;
  /** The months of the run, in order. */
  readonly months: readonly string[];
  /** Volume in the month before the run began, and in the last month of it. */
  readonly from: number;
  readonly to: number;
  /** The fall across the run, as a rate. Negative. */
  readonly change: number;
}

/**
 * Sites whose volume fell in each of the last `RUN_LENGTH` months.
 *
 * The run is measured at the END of the series rather than anywhere in it: a site that
 * stumbled last autumn and recovered is not a site with a problem now, and reporting it as
 * one is the false positive this file is most likely to produce.
 */
export function findings(world: World): readonly Finding[] {
  const out: Finding[] = [];

  for (const site of world.sites) {
    const tail = site.months.slice(-(RUN_LENGTH + 1));
    if (tail.length < RUN_LENGTH + 1) continue;

    const falling = tail.every((row, i) => i === 0 || row.volume < (tail[i - 1]?.volume ?? 0));
    if (!falling) continue;

    const first = tail[0];
    const last = tail[tail.length - 1];
    if (first === undefined || last === undefined) continue;

    out.push({
      kind: 'declining-volume',
      site: site.name,
      months: tail.slice(1).map((row) => row.month),
      from: first.volume,
      to: last.volume,
      change: Math.round(((last.volume - first.volume) / first.volume) * 1000) / 1000,
    });
  }

  return out;
}

/** A month's display label, for a finding that has to be written out in words. */
export function monthLabel(monthId: string): string {
  return MONTHS.find((m) => m.id === monthId)?.label ?? monthId;
}
