/**
 * How figures are written down.
 *
 * One module, because a figure that reads one way in a card, another in a chart label and a
 * third in a chat answer is three figures as far as a reader is concerned — and the chat's
 * grounding check compares the model's numerals against what the tools returned as TEXT, so
 * a second formatter is a second set of numbers the check can reject.
 *
 * `en-GB` is named explicitly. A locale read from the host would make the same seed render
 * differently on a different machine, which is determinism lost at the last inch.
 */

const LOCALE = 'en-GB';

export function units(value: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value);
}

/**
 * A total, to the nearest pound. Pennies on a five-figure total are noise a reader has to
 * look past.
 */
export function money(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * A rate, to the penny. The same rounding as `money` turns £4.49 per unit into "£4", which
 * is a different claim — on five thousand units it is two thousand pounds of difference.
 */
export function moneyRate(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * A rate as a signed percentage: 0.055 becomes "+5.5%".
 *
 * The sign is an ASCII hyphen rather than a typographic minus, because the chat's grounding
 * check reads numerals with an ASCII pattern and a prettier character would hand it a
 * positive number where the tool returned a negative one.
 */
export function percent(rate: number): string {
  const shown = new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(rate));
  return `${rate < 0 ? '-' : '+'}${shown}`;
}
