/**
 * The period spine.
 *
 * Every period in the product resolves to a `PeriodScope` — a window of fiscal months. The
 * selector at the top of every surface is six ways of building one, which is what turns those
 * buttons from labels into something that genuinely recomputes.
 *
 * Fiscal months, not calendar months, are the primary key. A group with a June year end then
 * needs no special case anywhere above this file, and a prior-year comparative is just the same
 * window shifted back twelve fiscal months.
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 *   1. **`priorPeriodScope` and `priorYearScope` both preserve the window's LENGTH.** A
 *      year-to-date-through-July scope compares against the prior January-to-July, not against
 *      the prior year's whole twelve months. That is the comparison a CFO means, and snapping to
 *      the comparative period's full extent is the classic way to produce a variance that is
 *      arithmetically correct and answers a question nobody asked.
 *
 *   2. **Days are counted, never assumed.** Annualising a year-to-date figure uses the actual
 *      days in the window. Twelve-twelfths of a seven-month period is not a year, and a return
 *      on capital built on that assumption is wrong by up to three per cent in February.
 *
 * There is no wall clock in this file. `daysInMonth` constructs a `Date` from an explicit
 * year and month to ask the calendar how long that month was, which is a lookup rather than a
 * reading of the current time — every other date in the product is a parameter.
 */

/** A fiscal month, as `YYYY-MM`. */
export type FiscalMonth = string;

export type ScopeType = 'MONTH' | 'QUARTER' | 'HALF_YEAR' | 'FISCAL_YEAR' | 'YTD' | 'TTM';

export interface PeriodScope {
  readonly type: ScopeType;
  readonly startMonth: FiscalMonth;
  readonly endMonth: FiscalMonth;
  /** Human label for the UI — "H1 FY26", "Q2 FY26", "YTD through July 2026". */
  readonly label: string;
}

export function ym(year: number, month: number): FiscalMonth {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseYm(m: FiscalMonth): { year: number; month: number } {
  const [y, mo] = m.split('-');
  const year = Number(y);
  const month = Number(mo);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Malformed fiscal month: ${m}`);
  }
  return { year, month };
}

export function addMonths(m: FiscalMonth, delta: number): FiscalMonth {
  const { year, month } = parseYm(m);
  const zero = year * 12 + (month - 1) + delta;
  return ym(Math.floor(zero / 12), (zero % 12) + 1);
}

export function compareMonths(a: FiscalMonth, b: FiscalMonth): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Inclusive list of months from start to end. An inverted range is empty, not infinite. */
export function monthsBetween(start: FiscalMonth, end: FiscalMonth): FiscalMonth[] {
  if (compareMonths(start, end) > 0) return [];
  const out: FiscalMonth[] = [];
  let cur = start;
  while (compareMonths(cur, end) <= 0) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

/** How many months a scope spans, inclusive. */
export function monthCount(scope: PeriodScope): number {
  return monthsBetween(scope.startMonth, scope.endMonth).length;
}

/** Days in a fiscal month, so annualising is arithmetic rather than an assumption. */
export function daysInMonth(m: FiscalMonth): number {
  const { year, month } = parseYm(m);
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function daysInScope(scope: PeriodScope): number {
  return monthsBetween(scope.startMonth, scope.endMonth).reduce((n, m) => n + daysInMonth(m), 0);
}

/** The factor that turns a flow over this window into an annual rate. */
export function annualisationFactor(scope: PeriodScope): number {
  const days = daysInScope(scope);
  return days > 0 ? 365 / days : 0;
}

// ---------------------------------------------------------------------------
// The fiscal calendar
// ---------------------------------------------------------------------------

/**
 * `fiscalYearEndMonth` is the calendar month the fiscal year ends in: 12 for a calendar-year
 * group, 6 for a June year end. Kestrel is a December year end, which is the boring case — and
 * the reason the awkward one is modelled anyway is that a pilot with a March year end must not
 * require a change above this file.
 */
export interface FiscalCalendar {
  readonly fiscalYearEndMonth: number;
}

export const CALENDAR_YEAR: FiscalCalendar = { fiscalYearEndMonth: 12 };

/** The fiscal year a calendar month falls in. */
export function fiscalYearOf(m: FiscalMonth, cal: FiscalCalendar): number {
  const { year, month } = parseYm(m);
  return month > cal.fiscalYearEndMonth ? year + 1 : year;
}

export function firstMonthOfFiscalYear(fy: number, cal: FiscalCalendar): FiscalMonth {
  return cal.fiscalYearEndMonth === 12 ? ym(fy, 1) : addMonths(ym(fy, cal.fiscalYearEndMonth), -11);
}

export function lastMonthOfFiscalYear(fy: number, cal: FiscalCalendar): FiscalMonth {
  return ym(fy, cal.fiscalYearEndMonth);
}

/** The fiscal quarter (1–4) a month falls in. */
export function fiscalQuarterOf(m: FiscalMonth, cal: FiscalCalendar): number {
  const first = firstMonthOfFiscalYear(fiscalYearOf(m, cal), cal);
  return Math.floor((monthsBetween(first, m).length - 1) / 3) + 1;
}

/** The fiscal half (1 or 2) a month falls in. */
export function fiscalHalfOf(m: FiscalMonth, cal: FiscalCalendar): number {
  const first = firstMonthOfFiscalYear(fiscalYearOf(m, cal), cal);
  return Math.floor((monthsBetween(first, m).length - 1) / 6) + 1;
}

// ---------------------------------------------------------------------------
// Scope builders — the six the product exposes
// ---------------------------------------------------------------------------

export function monthScope(m: FiscalMonth): PeriodScope {
  return { type: 'MONTH', startMonth: m, endMonth: m, label: formatMonthShort(m) };
}

export function quarterScope(fy: number, quarter: number, cal: FiscalCalendar): PeriodScope {
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new Error(`Quarter out of range: ${quarter}`);
  }
  const start = addMonths(firstMonthOfFiscalYear(fy, cal), (quarter - 1) * 3);
  return {
    type: 'QUARTER',
    startMonth: start,
    endMonth: addMonths(start, 2),
    label: `Q${quarter} FY${String(fy).slice(-2)}`,
  };
}

/**
 * A fiscal half. Present because the revised PRD reports on it (`FW-AI-005`) and because a
 * half-year is not derivable from a quarter selector — H1 is two quarters, and a reader asking
 * for H1 is asking a different question from a reader asking for Q2.
 */
export function halfYearScope(fy: number, half: number, cal: FiscalCalendar): PeriodScope {
  if (half !== 1 && half !== 2) throw new Error(`Half out of range: ${half}`);
  const start = addMonths(firstMonthOfFiscalYear(fy, cal), (half - 1) * 6);
  return {
    type: 'HALF_YEAR',
    startMonth: start,
    endMonth: addMonths(start, 5),
    label: `H${half} FY${String(fy).slice(-2)}`,
  };
}

export function fiscalYearScope(fy: number, cal: FiscalCalendar): PeriodScope {
  return {
    type: 'FISCAL_YEAR',
    startMonth: firstMonthOfFiscalYear(fy, cal),
    endMonth: lastMonthOfFiscalYear(fy, cal),
    label: `FY${String(fy).slice(-2)}`,
  };
}

/**
 * Year to date through a closed month.
 *
 * The label names the month rather than only the fiscal year. A year-to-date scope that labels
 * itself `YTD FY26` prints the same string for all twelve months of the year, which makes it the
 * one thing on a page whose whole claim is that everything moves.
 */
export function ytdScope(through: FiscalMonth, cal: FiscalCalendar): PeriodScope {
  const fy = fiscalYearOf(through, cal);
  return {
    type: 'YTD',
    startMonth: firstMonthOfFiscalYear(fy, cal),
    endMonth: through,
    label: `YTD through ${formatMonthLong(through)}`,
  };
}

export function ttmScope(through: FiscalMonth): PeriodScope {
  return {
    type: 'TTM',
    startMonth: addMonths(through, -11),
    endMonth: through,
    label: 'Trailing 12 months',
  };
}

// ---------------------------------------------------------------------------
// Comparative windows
// ---------------------------------------------------------------------------

/**
 * The immediately preceding window of the same length.
 *
 * Length, not calendar shape: the window before a five-month year-to-date period is the five
 * months before it, which straddles the year end and is exactly what "prior period" means to
 * somebody watching a run rate.
 */
export function priorPeriodScope(scope: PeriodScope): PeriodScope {
  const n = monthCount(scope);
  return {
    type: scope.type,
    startMonth: addMonths(scope.startMonth, -n),
    endMonth: addMonths(scope.endMonth, -n),
    label: `${scope.label} (prior period)`,
  };
}

/** The same window shifted back twelve fiscal months, preserving its length. */
export function priorYearScope(scope: PeriodScope): PeriodScope {
  return {
    type: scope.type,
    startMonth: addMonths(scope.startMonth, -12),
    endMonth: addMonths(scope.endMonth, -12),
    label: `${scope.label} (prior year)`,
  };
}

// ---------------------------------------------------------------------------
// Weeks — for the direct cash forecast, and only for it
// ---------------------------------------------------------------------------

/**
 * A forecast week, as `<month>W<n>`: the month it starts in and its position in the horizon.
 *
 * Weeks are deliberately NOT a dimension of the measure model. The direct cash forecast is the
 * only thing in the product that thinks in weeks, its horizon is thirteen of them, and giving
 * every fact a week would mean every account needed a weekly basis rule it does not have. So a
 * week is an identifier the cash engine owns, and the fact store never sees one.
 */
export type ForecastWeek = string;

export const CASH_HORIZON_WEEKS = 13;

export function forecastWeek(anchor: FiscalMonth, n: number): ForecastWeek {
  if (!Number.isInteger(n) || n < 1 || n > CASH_HORIZON_WEEKS) {
    throw new Error(`Forecast week out of range: ${n}`);
  }
  return `${anchor}W${n}`;
}

export function forecastWeeks(anchor: FiscalMonth): ForecastWeek[] {
  return Array.from({ length: CASH_HORIZON_WEEKS }, (_, i) => forecastWeek(anchor, i + 1));
}

// ---------------------------------------------------------------------------
// Formatting a month
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** "July 2026". */
export function formatMonthLong(m: FiscalMonth): string {
  const { year, month } = parseYm(m);
  return `${MONTH_NAMES[month - 1] ?? m} ${year}`;
}

/** "Jul 26" — the axis label. */
export function formatMonthShort(m: FiscalMonth): string {
  const { year, month } = parseYm(m);
  return `${(MONTH_NAMES[month - 1] ?? m).slice(0, 3)} ${String(year).slice(-2)}`;
}
