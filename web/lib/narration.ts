/**
 * Commentary, written at build time and cached in a committed file.
 *
 * Three properties come from that arrangement and all three are the reason for it:
 *
 *   **A page load never waits on a model.** The prose is already on disk when the server starts.
 *
 *   **A keyless build still ships.** With no key the ladder in `@demo-kit/llm` returns the deterministic
 *   sentence code wrote, so there is no state in which the demo renders nothing. That is the designed
 *   fallback, not a degraded mode — and it is also what any non-default period renders, since the cache
 *   holds one narration per period rather than one per combination of period and comparator.
 *
 *   **Stale prose is a failing test, not a quiet lie.** The figures in the committed file came from the
 *   seed; change a threshold, a rate or the seed and they move. `narration.test.ts` compares the pinned
 *   projection at the foot, so the wording may float and the figures may not.
 *
 * ## Only the headline is written by a model
 *
 * The *detail* under a board item is an evidence chain — the figures the detector recorded, its
 * materiality verdict, its owner, its action — and code writes those, because they are a list rather
 * than a paragraph. A model asked to prose them would add connective tissue that reads as reasoning and
 * is not. So the model gets one job: a sentence naming what moved. Everything a reader drills into is
 * code's.
 *
 * ## What the model is allowed to say
 *
 * `facts` is not decoration. `@demo-kit/llm` builds the numeral allow-list from it, so a figure the
 * model quotes that is not derivable from one of these is rejected and the narration falls back to the
 * sentence code wrote. The list is assembled from the findings' own closed figure sets, which is why the
 * detectors carry them: the same array that renders on the card is the array that bounds the prose.
 */

import {
  narrate,
  type AnthropicLike,
  type NarrationPack,
  type NarrationResult,
  type NumberUnit,
} from '@demo-kit/llm';
import type { FiscalMonth } from '@kestrel/model';
import { closeCompleteness, entity } from '@kestrel/model';
import type { Unit } from '@kestrel/measures';
import { formatValue } from '@kestrel/measures';

import { DEMO_NAME } from './demo';
import { headlinesFor } from './headline';
import { LATEST_MONTH, briefFor, contextOf, monthLabel, viewOf, world } from './world';

/** The key a period's brief is filed under. One per closed month the demo offers. */
export function briefKey(month: FiscalMonth): string {
  return `overview:${month}`;
}

export interface BriefRecord {
  readonly title: string;
  readonly month: string;
  /** The deterministic figures behind the prose, pinned by the freshness test. */
  readonly figures: Readonly<Record<string, number | null>>;
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
 * The demo's voice. The kit appends its own rules — no invented numbers, no causation, no forecasts, no
 * superlatives — so this says only who is reading and how it should sound.
 */
const SYSTEM = [
  `You are writing one short commentary for the chief financial officer of ${DEMO_NAME}.`,
  'They already know the business. Say what moved and by how much, in plain words.',
  'British English. No jargon, no adjectives that are not doing work, no advice.',
].join('\n');

/**
 * The sentence code writes: true, complete, and what ships when there is no model.
 *
 * It quotes the highest-priority adverse finding — the detector's own title and statement, the same words
 * the card renders — rather than summarising all of them, because a summary of six findings is a sentence
 * that says nothing. If nothing fired it says so plainly: an empty month is a real answer, and the healthy
 * twin is a world in which every month is one.
 *
 * ## It quotes the detector, and briefly could not
 *
 * The kit's claims validator treated "forecast" as predictive language and would not allow it to be
 * echoed. In this domain the word is a *noun* — it names the comparator a variance is measured against —
 * so a detector saying "margin 404bps behind forecast" was saying the only correct thing, and prose
 * repeating it was rejected. Including this fallback, which then failed the check that exists to guard it.
 *
 * The workaround was to compose a sentence from the finding's figures and avoid the word. That worked
 * until the word turned up in a figure *label* and a detector id, at which point it was clear the product
 * was being made less accurate to satisfy a validator. Fixed upstream instead: the pattern is now
 * echoable, exactly as superlatives already were, so a model may repeat what code wrote and still cannot
 * invent "revenue will reach £14m". Recorded in the verification log as finding 30.
 */
function findingSentence(month: FiscalMonth): string {
  const brief = briefFor(viewOf({ month }));
  const attention = brief.boards.find((b) => b.id === 'attention')?.triage.kept ?? [];
  const first = attention[0];
  if (first === undefined) {
    return `Nothing adverse cleared the materiality policy in ${monthLabel(month)}.`;
  }
  /* The title and statement, which is what the card renders — and deliberately NOT what goes in the
     commentary. See `briefPack`. */
  return `${first.title}. ${first.statement}`;
}

/**
 * The sentence the *commentary* falls back to, which is a different job from the one above.
 *
 * The first version used the same string for both, and the page then read the top board item twice in
 * four inches: once as a paragraph under the figures and again, verbatim, as the first card. Two
 * renderings of one sentence is worse than one, because a reader who notices assumes the product has
 * nothing else to say.
 *
 * So this counts across the boards instead. It is the one thing a card cannot say, because a card is
 * one finding and this is the shape of all of them — which is also the only summary worth a paragraph.
 */
function overviewSentence(month: FiscalMonth): string {
  const brief = briefFor(viewOf({ month }));
  const counted = brief.boards
    .filter((b) => b.triage.kept.length > 0)
    .map((b) => `${b.triage.kept.length} on ${b.title.toLowerCase()}`);
  const total = brief.boards.reduce((sum, b) => sum + b.triage.kept.length, 0);
  if (total === 0) {
    return `Nothing cleared the materiality policy in ${monthLabel(month)}.`;
  }
  const forward = brief.boards
    .filter((b) => b.horizon === 'forward')
    .reduce((sum, b) => sum + b.triage.kept.length, 0);
  return (
    `${total} findings in ${monthLabel(month)}: ${counted.join(', ')}. ` +
    `${forward} of them are forward items, where a decision is still available.`
  );
}

/**
 * One measure-layer value, converted into a fact the numeral allow-list can ground.
 *
 * Two conversions, and the second one is a defect that took a failing test to find.
 *
 * **The unit is narrowed.** The kit's `NumberUnit` is deliberately smaller than a measure's `Unit`,
 * because the allow-list only needs to know how a value may legitimately be *rescaled* by a writer.
 * Hours and days rescale like counts; a per-unit rate rescales like money. Writing the mapping out as a
 * switch means a new unit in the measure layer fails the typecheck here rather than silently widening
 * what the model is allowed to say.
 *
 * **The value is converted out of minor units.** This is the one that bit. `scaleVariants` in the kit
 * offers a currency value divided by a thousand, a million and a billion — because a writer says "12.4
 * million" for 12,393,220. The measure layer holds money in *minor* units, so revenue is 1,239,322,000,
 * whose variants are 1,239,322 and 1,239.32 and 1.24 — and `£12.4m`, the figure on every card on the
 * page, grounds against none of them. Every currency figure the product displays would have been
 * rejected as fabricated, and the narration would have fallen back on every build while looking like a
 * model that could not be trusted with numbers.
 *
 * Minor units are right for the model layer — integer arithmetic is why the balance sheet reconciles to
 * the penny — and wrong at this boundary. The conversion belongs here, at the seam, rather than in either
 * layer.
 */
function fact(value: number, unit: Unit): { value: number; unit: NumberUnit } {
  switch (unit) {
    case 'currency':
    case 'rate':
      return { value: value / 100, unit: 'currency' };
    case 'percent':
      return { value, unit: 'percent' };
    case 'bps':
      return { value, unit: 'bps' };
    case 'ratio':
      return { value, unit: 'ratio' };
    case 'count':
    case 'hours':
    case 'days':
      return { value, unit: 'count' };
  }
}

function briefPack(month: FiscalMonth): NarrationPack {
  const view = viewOf({ month });
  const ctx = contextOf(view);
  const headlines = headlinesFor(ctx, view.comparator);
  const brief = briefFor(view);
  const completeness = closeCompleteness(world().closePositions, month);
  /* Two sentences with different jobs: `finding` is the pinned evidence line the freshness test
     compares, and `summary` is what the commentary paragraph says. They must not be the same string —
     the paragraph sits directly above the card that renders `finding`. */
  const sentence = findingSentence(month);
  const summary = overviewSentence(month);

  const findings = brief.boards.flatMap((b) => b.triage.kept);

  return {
    content: {
      period: monthLabel(month),
      basis: brief.comparator.basis,
      headlines: headlines.map((h) => ({
        measure: h.label,
        value: formatValue(h.value, h.unit),
        movement: formatValue(h.movement, h.movementUnit),
        favourable: h.favourable,
      })),
      findingCount: findings.length,
      boards: brief.boards.map((b) => ({ board: b.title, count: b.triage.kept.length })),
      ledgersClosed: `${completeness.closed} of ${completeness.total}`,
      openLedgers: completeness.open.map((p) => entity(p.entityId).name),
    },
    // Every numeral the model may use, drawn from the same figure sets the cards render.
    facts: [
      ...headlines.flatMap((h) =>
        h.value === null
          ? []
          : [
              fact(h.value, h.unit),
              ...(h.movement === null ? [] : [fact(h.movement, h.movementUnit)]),
            ],
      ),
      ...findings.flatMap((f) =>
        f.figures.flatMap((figure) =>
          figure.value === null ? [] : [fact(figure.value, figure.unit)],
        ),
      ),
      { value: completeness.closed, unit: 'count' as const },
      { value: completeness.total, unit: 'count' as const },
      { value: findings.length, unit: 'count' as const },
    ],
    /* Two strings, and the second is why: `codeWritten` numerals are quotable because code wrote them,
       and the period label carries a year. Without it "Jul 2026" is an ungrounded 2026 — a date rejected
       as a fabricated figure, which is the sort of false positive that gets a grounding check switched
       off. */
    codeWritten: [
      sentence,
      `Period: ${monthLabel(month)}. Comparative: version ${view.version.id}.`,
    ],
    fallback: {
      headline:
        findings.length === 0
          ? `${monthLabel(month)} closed with nothing above the threshold`
          : `${findings.length} items need a decision in ${monthLabel(month)}`,
      /* Worded to avoid "forecast" deliberately. The kit's claims validator treats the word as predictive
         language and does not allow it to be echoed, so prose containing it is rejected — including this
         fallback, which then fails the very check that guards it. Naming the version instead is more precise
         anyway: "against version v6" cannot be misread as a prediction, which is what the rule is for. */
      body:
        `${summary} ` +
        `Revenue was ${formatValue(headlines[0]?.value ?? null, 'currency')} and EBITDA ` +
        `${formatValue(headlines[2]?.value ?? null, 'currency')}, measured against version ` +
        `${view.version.id}. ${completeness.closed} of ${completeness.total} ledgers are closed.`,
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
 * The months a brief is cached for.
 *
 * The latest closed month only. One narration per period and comparator combination would be four
 * periods × five comparators × twelve months of model calls at every build, for prose almost nobody
 * reads — and the non-default combinations render the deterministic sentence, which is honest and is
 * what the fallback exists for.
 */
export const NARRATED_MONTHS: readonly FiscalMonth[] = [LATEST_MONTH];

/** The pack behind a committed brief, so a test can run the kit's validators over the prose that shipped. */
export function packFor(month: FiscalMonth): NarrationPack {
  return briefPack(month);
}

export async function buildBriefs(
  options: BuildOptions = {},
): Promise<Record<string, BriefRecord>> {
  const out: Record<string, BriefRecord> = {};

  for (const month of NARRATED_MONTHS) {
    const view = viewOf({ month });
    const headlines = headlinesFor(contextOf(view), view.comparator);
    const completeness = closeCompleteness(world().closePositions, month);
    const pack = briefPack(month);

    const narration = await narrate(pack, {
      system: SYSTEM,
      ...(options.client === undefined ? {} : { client: options.client }),
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.onReject === undefined ? {} : { onReject: options.onReject }),
    });

    out[briefKey(month)] = {
      title: `${monthLabel(month)} commentary`,
      month,
      figures: {
        ...Object.fromEntries(headlines.map((h) => [h.measureId, h.value])),
        ...Object.fromEntries(headlines.map((h) => [`${h.measureId}_movement`, h.movement])),
        ledgersClosed: completeness.closed,
        ledgersTotal: completeness.total,
      },
      finding: pack.codeWritten[0] ?? '',
      narration,
    };
  }

  return out;
}
