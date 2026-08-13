/**
 * How figures are written down — one formatter, and it is the measure layer's.
 *
 * This file is deliberately thin. Every figure on every surface, in every chart label, in every deck
 * slide and in every tool result the model is shown goes through `formatValue` in `@kestrel/measures`,
 * because a figure that reads one way in a card and another in a chat answer is two figures as far as a
 * reader is concerned. The measure layer owns it rather than the app: the unit is a property of the
 * measure, so the thing that knows how to print it is the thing that knows what it is.
 *
 * ## The one thing this file adds
 *
 * A `null` is not a zero. `formatValue(null, …)` already returns `—`, and every helper here preserves
 * that rather than coercing — a page that renders a missing month as `£0` will eventually tell a chief
 * financial officer their cash is nothing.
 *
 * ## What the scaffold got wrong here, recorded because it is subtle
 *
 * The template's version of this file used an ASCII hyphen for negatives and said why: that the chat's
 * grounding check "reads numerals with an ASCII pattern, and a prettier character would hand it a
 * positive number where the tool returned a negative one".
 *
 * That is not what the check does. Its pattern is `/\d[\d,]*(?:\.\d+)?/g`, which must *start* at a
 * digit, so neither `-` nor `−` is ever captured and the sign plays no part in grounding at all. The
 * measure layer's typographic minus (U+2212, which aligns with digits where a hyphen does not) is
 * therefore safe, and keeping a second formatter to satisfy a constraint that does not exist would have
 * been the actual defect — two formatters is how the page and the tool results drift apart.
 *
 * The real limitation is the opposite one and worth stating plainly: because grounding compares
 * unsigned numerals, it cannot catch a *direction* error. A model that says revenue fell 5.4% when the
 * tool said it rose 5.4% passes. That is what the tools' own prose is for — they return the movement
 * already worded, so the model has a sentence to quote rather than a sign to interpret.
 */

import type { Unit } from '@kestrel/measures';
import { ABSENT, deltaUnitFor, formatValue } from '@kestrel/measures';

export { ABSENT, deltaUnitFor, formatValue };
export type { Unit };

/** A measure's value in its own unit. The default path for anything on a surface. */
export function figure(value: number | null, unit: Unit): string {
  return formatValue(value, unit);
}

/**
 * A movement, with an explicit sign.
 *
 * The sign is added here rather than in the measure layer because a *level* should not carry one — a
 * revenue of `+£12.4m` reads as though something were being compared. A movement always is.
 */
export function movement(value: number | null, unit: Unit): string {
  if (value === null) return ABSENT;
  const shown = formatValue(Math.abs(value), unit);
  // U+2212 for negatives, matching the measure layer, and a real plus for positives.
  return `${value < 0 ? '−' : '+'}${shown}`;
}

/**
 * Which of the two direction tokens a movement should be painted in, or neither.
 *
 * Takes `favourable` rather than the value, because the value cannot answer it: a cost that rose is a
 * positive movement and unfavourable news, and a surface that colours by arithmetic sign paints a
 * rising expense the same green as rising income. That is the single most common defect in a management
 * report and the reason `favourable` exists as a field on a comparison.
 */
export function directionClass(favourable: boolean | null): string {
  return favourable === null ? '' : favourable ? 'pos' : 'neg';
}

/** A percentage held as a rate, for a chart axis or an inline share. */
export function share(rate: number | null): string {
  return formatValue(rate, 'percent');
}
