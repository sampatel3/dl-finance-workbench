/**
 * Currency, and IAS 21 translation.
 *
 * Three currencies matter and the product needs all three:
 *
 *   **transaction** — what the document was in. Held for exposure and for drill-down.
 *   **functional**  — the entity's own; its books are kept in this, and an entity-level variance
 *                     should be read in it, because that is the currency the manager being asked
 *                     about the variance actually spends.
 *   **presentation** — the group's; what the CFO reads.
 *
 * Translation between the last two follows IAS 21 and the rule has two halves that are easy to
 * get half-right:
 *
 *   balance-sheet items at the **closing** rate of the period;
 *   profit-and-loss items at the **average** rate over the period;
 *
 * and because those two rates differ, a translated balance sheet does not balance on its own. The
 * difference is not a profit and not an error: it is the **cumulative translation reserve**, and it
 * sits inside equity. A product that translates everything at one rate will balance and will be
 * wrong; a product that translates at two rates and does not carry the reserve will not balance and
 * will look broken. Both failures are common and both are visible on the first screen.
 *
 * Rates are data, with a source and a version — not constants. A variance computed on a re-keyed
 * rate is a variance nobody can reproduce, and reproducibility is the property every other claim
 * in this product rests on.
 */

import type { Currency } from './entities.ts';
import { PRESENTATION } from './entities.ts';
import type { FiscalMonth, PeriodScope } from './period.ts';
import { compareMonths, monthsBetween } from './period.ts';

/** One month's rates for one currency, expressed as units of that currency per £1. */
export interface MonthRate {
  readonly currency: Currency;
  readonly month: FiscalMonth;
  /** The rate at the last day of the month. Balance sheets translate at this. */
  readonly closing: number;
  /** The mean rate across the month. Profit and loss translates at this. */
  readonly average: number;
}

export interface RateTable {
  readonly id: string;
  readonly source: string;
  readonly rates: readonly MonthRate[];
}

/** What a translation was done at, so a figure can say so. */
export interface TranslationBasis {
  readonly rateTableId: string;
  readonly closing: number;
  readonly average: number;
}

export class Rates {
  readonly #byKey = new Map<string, MonthRate>();
  readonly #table: RateTable;

  constructor(table: RateTable) {
    this.#table = table;
    for (const rate of table.rates) this.#byKey.set(`${rate.currency}|${rate.month}`, rate);
  }

  get id(): string {
    return this.#table.id;
  }

  get source(): string {
    return this.#table.source;
  }

  /**
   * The rates for a currency in a month.
   *
   * The presentation currency is not in the table and does not need to be: it translates to itself
   * at 1. Returning a synthetic unit rate rather than requiring the seed to write 43 rows of ones
   * is what stops a missing-rate bug from being masked by a table full of them.
   */
  at(currency: Currency, month: FiscalMonth): MonthRate {
    if (currency === PRESENTATION) {
      return { currency, month, closing: 1, average: 1 };
    }
    const found = this.#byKey.get(`${currency}|${month}`);
    if (found === undefined) {
      throw new Error(`No rate for ${currency} in ${month} (table ${this.#table.id})`);
    }
    return found;
  }

  /**
   * The average rate across a window, weighted by nothing.
   *
   * An unweighted mean of monthly averages, which is what a group with monthly closes actually
   * uses: weighting by each month's revenue would make the rate depend on the figure being
   * translated, and two accounts in the same period would then translate at two different rates.
   */
  averageOver(currency: Currency, scope: PeriodScope): number {
    if (currency === PRESENTATION) return 1;
    const months = monthsBetween(scope.startMonth, scope.endMonth);
    if (months.length === 0) return 1;
    const total = months.reduce((sum, m) => sum + this.at(currency, m).average, 0);
    return total / months.length;
  }

  /** The closing rate of the last month in a window. */
  closingAt(currency: Currency, scope: PeriodScope): number {
    if (currency === PRESENTATION) return 1;
    return this.at(currency, scope.endMonth).closing;
  }

  /** Every month the table covers for a currency, ascending. */
  monthsFor(currency: Currency): FiscalMonth[] {
    return this.#table.rates
      .filter((r) => r.currency === currency)
      .map((r) => r.month)
      .sort(compareMonths);
  }
}

/**
 * Which rate an account translates at.
 *
 * Driven by the account's basis rather than by a second list, so an account cannot be added to the
 * taxonomy and forgotten here. A `flow` accumulates over the window and therefore takes the
 * average; a `balance` is a point in time and takes the closing rate; an `avg_balance` is a mean of
 * points in time, and the average rate is the honest choice for it — closing would translate
 * twelve months of balances at December's rate, which is how a days-sales-outstanding ratio starts
 * moving because of the currency.
 */
export type RateKind = 'closing' | 'average';

export function rateKindFor(basis: 'flow' | 'balance' | 'avg_balance'): RateKind {
  return basis === 'balance' ? 'closing' : 'average';
}

/**
 * Translate an amount from an entity's functional currency into the presentation currency.
 *
 * Rates are quoted as units of foreign currency per £1, so translating divides. The direction is
 * stated here once because getting it backwards produces figures that are wrong by a factor of
 * five and still look like money.
 */
export function translate(amountMinor: number, from: Currency, rate: number): number {
  if (from === PRESENTATION) return amountMinor;
  if (rate === 0) throw new Error(`Cannot translate at a zero rate (${from})`);
  return Math.round(amountMinor / rate);
}

/**
 * The lens a figure is read through.
 *
 * `functional` leaves an entity's figures in its own currency and is meaningless at group level.
 * `reported` translates at the period's own rates — what the statutory accounts say.
 * `constant` translates at the COMPARATIVE period's rates, which is what separates growth from
 * translation and is the second-most-asked-for view in any multi-currency group. It is the same
 * translation function with a different rate argument, which is the whole reason the rate is a
 * parameter rather than a lookup inside it.
 */
export type CurrencyLens = 'reported' | 'constant' | 'functional';

export interface TranslationContext {
  readonly lens: CurrencyLens;
  readonly rates: Rates;
  /** The window being reported. */
  readonly scope: PeriodScope;
  /** The window a constant-currency view borrows its rates from. */
  readonly comparativeScope?: PeriodScope;
}

/**
 * The rate to use for one account, in one entity, under one lens.
 *
 * Returning `null` means "do not translate" — the functional lens, where the caller wants the
 * entity's own figures untouched.
 */
export function rateFor(
  ctx: TranslationContext,
  currency: Currency,
  kind: RateKind,
): number | null {
  if (ctx.lens === 'functional') return null;
  if (currency === PRESENTATION) return 1;

  const scope =
    ctx.lens === 'constant' && ctx.comparativeScope !== undefined
      ? ctx.comparativeScope
      : ctx.scope;

  return kind === 'closing'
    ? ctx.rates.closingAt(currency, scope)
    : ctx.rates.averageOver(currency, scope);
}
