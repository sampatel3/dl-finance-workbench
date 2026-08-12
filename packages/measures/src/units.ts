/**
 * Units, and formatting — which happens once, at the edge.
 *
 * Values travel through this product as **numbers with a unit**, never as pre-formatted strings.
 * That rule is why the same figure can appear as `£12.4m` on the executive surface, `12,393,412` in
 * the analyst grid, `£12,393,411.63` in a drill-down and `12393411.63` in an export without three of
 * those four being a re-parse of the first. A product that ships `"$1.24B"` out of its model has
 * already lost the ability to do arithmetic on its own figures.
 *
 * Two conventions, stated because every caller depends on them:
 *
 *   **currency is minor units** — pence, cents, fils — as a signed integer, all the way up from the
 *   fact store. It becomes a decimal here and nowhere else.
 *
 *   **percent and ratio are rates, not percentages.** A gross margin of 41.8% is `0.418`. Storing it
 *   as `41.8` means every downstream comparison has to know which of the two it is holding, and one
 *   of them eventually will not.
 */

export type Unit =
  | 'currency'
  /** A rate rendered with a % sign. `0.418` prints as `41.8%`. */
  | 'percent'
  /** A rate rendered as basis points. Used for movements in a percentage, not for levels. */
  | 'bps'
  /** A rate rendered as a multiple. `1.4` prints as `1.4×`. */
  | 'ratio'
  | 'count'
  | 'hours'
  | 'days'
  /** Money per unit of something — a price, a blended hourly rate. Minor units. */
  | 'rate';

/** Does a unit measure money? Decides both the symbol and the minor-unit conversion. */
export function isMonetary(unit: Unit): boolean {
  return unit === 'currency' || unit === 'rate';
}

export type CurrencyCode = 'GBP' | 'AED' | 'EUR' | 'USD';

const SYMBOL: Readonly<Record<CurrencyCode, string>> = {
  GBP: '£',
  AED: 'AED ',
  EUR: '€',
  USD: '$',
};

/** The em dash. A missing figure is not a zero, and it must not look like one. */
export const ABSENT = '—';

export interface FormatOptions {
  readonly currency?: CurrencyCode;
  /** Force a scale rather than choosing one. The analyst grid wants a column to agree with itself. */
  readonly scale?: 'unit' | 'thousands' | 'millions';
  /** Decimal places. Defaults per unit. */
  readonly places?: number;
  /** Print a leading `+` for a positive number. Deltas want this; levels do not. */
  readonly signed?: boolean;
}

/**
 * Format a value for reading.
 *
 * `null` is `—` for every unit. That is the single most important line in the file: the alternative
 * is a zero, and a dashboard that renders a missing month as zero will eventually tell a chief
 * financial officer their cash is zero.
 */
export function formatValue(value: number | null, unit: Unit, options: FormatOptions = {}): string {
  if (value === null) return ABSENT;

  switch (unit) {
    case 'currency':
      return formatMoney(value, options);
    case 'rate':
      // A price or an hourly rate: two decimals, never abbreviated. `£41.80` per hour is the figure
      // somebody negotiated, and `£0.0m` is not a rate.
      return formatMoney(value, { ...options, scale: 'unit', places: options.places ?? 2 });
    case 'percent':
      return `${sign(value, options)}${(Math.abs(value) * 100).toFixed(options.places ?? 1)}%`;
    case 'bps':
      return `${sign(value, options)}${Math.round(Math.abs(value)).toLocaleString('en-GB')}bps`;
    case 'ratio':
      return `${sign(value, options)}${Math.abs(value).toFixed(options.places ?? 2)}×`;
    case 'days':
      return `${sign(value, options)}${Math.abs(value).toFixed(options.places ?? 0)} days`;
    case 'hours':
      return `${sign(value, options)}${Math.round(Math.abs(value)).toLocaleString('en-GB')} hrs`;
    case 'count':
      return `${sign(value, options)}${Math.round(Math.abs(value)).toLocaleString('en-GB')}`;
  }
}

function sign(value: number, options: FormatOptions): string {
  if (value < 0) return '−'; // U+2212, which aligns with digits where a hyphen does not
  return options.signed === true && value > 0 ? '+' : '';
}

/**
 * Money, from minor units.
 *
 * The scale is chosen from the magnitude unless the caller pins it, and the thresholds are where a
 * finance reader would put them: millions above a million, thousands above ten thousand, and the
 * exact figure below that — because £4,182 abbreviated to £4k is a rounding a reader did not ask for
 * on a number small enough to read.
 */
function formatMoney(minor: number, options: FormatOptions): string {
  const symbol = SYMBOL[options.currency ?? 'GBP'];
  const magnitude = Math.abs(minor);
  const scale =
    options.scale ??
    (magnitude >= 100_000_000 ? 'millions' : magnitude >= 1_000_000 ? 'thousands' : 'unit');

  const prefix = `${sign(minor, options)}${symbol}`;

  if (scale === 'millions') {
    return `${prefix}${(magnitude / 100 / 1e6).toFixed(options.places ?? 1)}m`;
  }
  if (scale === 'thousands') {
    return `${prefix}${(magnitude / 100 / 1e3).toFixed(options.places ?? 0)}k`;
  }
  const places = options.places ?? 2;
  return `${prefix}${(magnitude / 100).toLocaleString('en-GB', {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  })}`;
}

/**
 * How a movement in this unit should be expressed.
 *
 * A currency movement is a percentage of where it started; a movement in a percentage is basis
 * points, because "gross margin fell 2.6%" is ambiguous between 2.6 points and 2.6% of 41.8%, and
 * the two differ by a factor of forty. Naming the unit of the delta removes the ambiguity from every
 * sentence downstream, including the ones a model writes.
 */
export function deltaUnitFor(unit: Unit): Unit {
  switch (unit) {
    case 'percent':
      return 'bps';
    case 'currency':
    case 'rate':
    case 'count':
    case 'hours':
      return 'percent';
    case 'days':
      return 'days';
    case 'ratio':
      return 'ratio';
    case 'bps':
      return 'bps';
  }
}

/**
 * The movement between two values, in the unit `deltaUnitFor` names.
 *
 * Relative for a level that can be divided, absolute for a rate. Returns null where the comparative
 * is absent or zero — a percentage change from nothing is not infinity, it is undefined, and a
 * product that prints `+∞%` has stopped being a finance product.
 */
export function delta(
  current: number | null,
  comparative: number | null,
  unit: Unit,
): { value: number | null; unit: Unit } {
  const deltaUnit = deltaUnitFor(unit);
  if (current === null || comparative === null) return { value: null, unit: deltaUnit };

  if (deltaUnit === 'percent') {
    if (comparative === 0) return { value: null, unit: deltaUnit };
    return { value: (current - comparative) / Math.abs(comparative), unit: deltaUnit };
  }
  if (deltaUnit === 'bps') return { value: (current - comparative) * 10_000, unit: deltaUnit };
  return { value: current - comparative, unit: deltaUnit };
}
