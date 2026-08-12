/**
 * The build-time brief: what code found, written down by a model, cached in a committed file.
 *
 * Three properties come from that arrangement and all three are the reason for it:
 *
 *   - **A page load never waits on a model.** The prose is already on disk.
 *   - **A keyless build still ships.** With no key the ladder in `@demo-kit/llm` returns the
 *     deterministic fallback below, so there is no state in which the demo renders nothing.
 *   - **Stale prose is a failing test, not a quiet lie.** The numbers in the committed file
 *     came from the seed; change a threshold, a rate or the seed and they move. The pinned
 *     projection at the foot is what `narration.test.ts` compares, so the wording may float
 *     and the figures may not.
 *
 * `buildBriefs` is shared by `scripts/narrate.ts` and by that test, deliberately: a test
 * that reconstructs what the generator does is a test of a second implementation.
 */

import { narrate, type AnthropicLike, type NarrationPack, type NarrationResult } from '@demo-kit/llm';
import { DEMO_NAME } from './demo';
import { findings, monthLabel, type Finding } from './findings';
import { percent, units } from './format';
import { LATEST_MONTH, networkVolume, world, type World } from './world';

/** The key every brief is filed under. One brief today; a demo will grow more. */
export const NETWORK_BRIEF = 'network';

/**
 * One cached brief: the figures it was written from, and the sentences a model wrote about
 * them. The split is the whole mechanism — everything above `narration` is pinned.
 */
export interface BriefRecord {
  readonly title: string;
  readonly month: string;
  /** The deterministic figures behind the prose, pinned by the freshness test. */
  readonly figures: Readonly<Record<string, number>>;
  /** The sentence code wrote, which is also what ships when the model is not available. */
  readonly finding: string;
  readonly narration: NarrationResult;
}

/** What the freshness test compares. Everything except the prose. */
export function pinned(record: BriefRecord): unknown {
  return {
    title: record.title,
    month: record.month,
    figures: record.figures,
    finding: record.finding,
  };
}

/**
 * The demo's voice. The kit appends its own rules — no invented numbers, no causation, no
 * forecasts, no superlatives — so this says only who is reading and how it should sound.
 */
const SYSTEM = [
  `You are writing one short brief for the operations lead of ${DEMO_NAME}.`,
  'They already know the business. Say what moved and by how much, in plain words.',
  'British English. No jargon, no adjectives that are not doing work.',
].join('\n');

/** The sentence code writes: true, complete, and what ships when there is no model. */
function findingSentence(finding: Finding | undefined, month: string): string {
  if (finding === undefined) {
    return `No site fell for three consecutive months to ${monthLabel(month)}.`;
  }
  return (
    `${finding.site} fell in each of the three months to ${monthLabel(month)}, ` +
    `from ${units(finding.from)} units to ${units(finding.to)}, ${percent(finding.change)}.`
  );
}

/**
 * The closed set of facts the model is given, and the only numbers it may use.
 *
 * `facts` is not decoration: `@demo-kit/llm` builds the numeral allow-list from it, and a
 * figure the model quotes that is not derivable from one of these is rejected and the brief
 * falls back. So a number that belongs in the prose belongs here.
 */
function briefPack(source: World, finding: Finding | undefined): NarrationPack {
  const month = LATEST_MONTH.id;
  const total = networkVolume(source, month);
  const sentence = findingSentence(finding, month);

  return {
    content: {
      period: monthLabel(month),
      networkVolume: total,
      siteCount: source.sites.length,
      finding:
        finding === undefined
          ? null
          : {
              site: finding.site,
              months: finding.months.map(monthLabel),
              volumeBefore: finding.from,
              volumeNow: finding.to,
              changeRate: finding.change,
            },
    },
    facts: [
      { value: total, unit: 'count' },
      { value: source.sites.length, unit: 'count' },
      ...(finding === undefined
        ? []
        : ([
            { value: finding.from, unit: 'count' },
            { value: finding.to, unit: 'count' },
            { value: finding.change, unit: 'ratio' },
          ] as const)),
    ],
    codeWritten: [sentence],
    fallback: {
      headline: finding === undefined ? 'Every site held or grew' : `Volume is falling at ${finding.site}`,
      body: `${sentence} Across all ${source.sites.length} sites the network dispatched ${units(total)} units in ${monthLabel(month)}.`,
    },
  };
}

export interface BuildOptions {
  /** Omit and every brief is the deterministic fallback — which is what a test wants. */
  readonly client?: AnthropicLike;
  /** Injected so a test's output is comparable with a committed file. */
  readonly now?: () => string;
  readonly onReject?: (reason: string, detail: string) => void;
}

/**
 * The pack behind the committed brief, so a test can run the kit's own validators over the
 * prose that shipped. The generator checks the model's output before it writes; this is what
 * makes a hand edit to the generated file checkable too.
 */
export function networkPack(): NarrationPack {
  const source = world();
  return briefPack(source, findings(source)[0]);
}

/** Build every brief this demo caches. One today. */
export async function buildBriefs(
  options: BuildOptions = {},
): Promise<Record<string, BriefRecord>> {
  const source = world();
  const month = LATEST_MONTH.id;
  const finding = findings(source)[0];
  const pack = briefPack(source, finding);

  const narration = await narrate(pack, {
    system: SYSTEM,
    ...(options.client === undefined ? {} : { client: options.client }),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.onReject === undefined ? {} : { onReject: options.onReject }),
  });

  return {
    [NETWORK_BRIEF]: {
      title: `${monthLabel(month)} operations brief`,
      month,
      figures: {
        networkVolume: networkVolume(source, month),
        siteCount: source.sites.length,
        ...(finding === undefined
          ? {}
          : { volumeBefore: finding.from, volumeNow: finding.to, changeRate: finding.change }),
      },
      finding: pack.codeWritten[0] ?? '',
      narration,
    },
  };
}
