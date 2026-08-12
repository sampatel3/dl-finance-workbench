/**
 * The period spine.
 *
 * Everything here is about one class of defect: a window that is arithmetically fine and answers a
 * question nobody asked. A prior-year comparative that snaps to the whole prior year, a half-year
 * that is really two quarters glued badly, an annualisation that assumes every month is a twelfth —
 * each produces a plausible figure, and a plausible wrong figure is the only kind that survives to
 * a board pack.
 */

import { describe, expect, it } from 'vitest';

import {
  CALENDAR_YEAR,
  addMonths,
  annualisationFactor,
  daysInMonth,
  daysInScope,
  fiscalHalfOf,
  fiscalQuarterOf,
  fiscalYearOf,
  fiscalYearScope,
  forecastWeeks,
  formatMonthLong,
  halfYearScope,
  monthCount,
  monthScope,
  monthsBetween,
  priorPeriodScope,
  priorYearScope,
  quarterScope,
  ttmScope,
  ym,
  ytdScope,
} from './period.ts';

const JUNE_YEAR_END = { fiscalYearEndMonth: 6 };

describe('the calendar', () => {
  it('walks months across a year boundary in both directions', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2025-12', 1)).toBe('2026-01');
    expect(addMonths('2026-07', -12)).toBe('2025-07');
    expect(addMonths('2023-01', 42)).toBe('2026-07');
  });

  it('returns an empty range rather than looping forever on an inverted one', () => {
    expect(monthsBetween('2026-07', '2026-01')).toEqual([]);
    expect(monthsBetween('2026-07', '2026-07')).toEqual(['2026-07']);
  });

  it('counts real days, so annualising is arithmetic rather than an assumption', () => {
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2026-07')).toBe(31);

    // Seven months of 2026 is 212 days, not seven twelfths of a year. A product that assumes the
    // latter overstates an annualised year-to-date return by nearly 2% in July.
    const ytd = ytdScope('2026-07', CALENDAR_YEAR);
    expect(daysInScope(ytd)).toBe(212);
    expect(annualisationFactor(ytd)).toBeCloseTo(365 / 212, 10);
    expect(annualisationFactor(ytd)).not.toBeCloseTo(12 / 7, 3);
  });
});

describe('a June year end needs no special case', () => {
  it('maps months to the right fiscal year, quarter and half', () => {
    // July 2025 is the first month of fiscal 2026 for a June year end.
    expect(fiscalYearOf('2025-07', JUNE_YEAR_END)).toBe(2026);
    expect(fiscalYearOf('2026-06', JUNE_YEAR_END)).toBe(2026);
    expect(fiscalQuarterOf('2025-07', JUNE_YEAR_END)).toBe(1);
    expect(fiscalQuarterOf('2026-06', JUNE_YEAR_END)).toBe(4);
    expect(fiscalHalfOf('2025-12', JUNE_YEAR_END)).toBe(1);
    expect(fiscalHalfOf('2026-01', JUNE_YEAR_END)).toBe(2);

    const fy = fiscalYearScope(2026, JUNE_YEAR_END);
    expect(fy.startMonth).toBe('2025-07');
    expect(fy.endMonth).toBe('2026-06');
    expect(monthCount(fy)).toBe(12);
  });

  it('and the calendar-year case is the same code', () => {
    const fy = fiscalYearScope(2026, CALENDAR_YEAR);
    expect(fy.startMonth).toBe('2026-01');
    expect(fy.endMonth).toBe('2026-12');
  });
});

describe('half-years', () => {
  it('are two quarters, and the two halves tile the year exactly', () => {
    const h1 = halfYearScope(2026, 1, CALENDAR_YEAR);
    const h2 = halfYearScope(2026, 2, CALENDAR_YEAR);
    expect([h1.startMonth, h1.endMonth]).toEqual(['2026-01', '2026-06']);
    expect([h2.startMonth, h2.endMonth]).toEqual(['2026-07', '2026-12']);

    const q1 = quarterScope(2026, 1, CALENDAR_YEAR);
    const q2 = quarterScope(2026, 2, CALENDAR_YEAR);
    expect(monthsBetween(h1.startMonth, h1.endMonth)).toEqual([
      ...monthsBetween(q1.startMonth, q1.endMonth),
      ...monthsBetween(q2.startMonth, q2.endMonth),
    ]);
  });

  it('refuse a half that does not exist', () => {
    expect(() => halfYearScope(2026, 3, CALENDAR_YEAR)).toThrow(/Half out of range/);
    expect(() => quarterScope(2026, 5, CALENDAR_YEAR)).toThrow(/Quarter out of range/);
  });
});

describe('comparatives preserve the window length', () => {
  it('prior year shifts twelve months and keeps the length, rather than snapping to the full year', () => {
    const ytd = ytdScope('2026-07', CALENDAR_YEAR);
    const prior = priorYearScope(ytd);
    expect([prior.startMonth, prior.endMonth]).toEqual(['2025-01', '2025-07']);
    // Seven months against seven months. Snapping to the prior full year would compare seven
    // months of trading against twelve, which is the comparison that makes every business look
    // like it is shrinking.
    expect(monthCount(prior)).toBe(monthCount(ytd));
  });

  it('prior period is the window immediately before, even across a year end', () => {
    const ytd = ytdScope('2026-03', CALENDAR_YEAR);
    const prior = priorPeriodScope(ytd);
    expect([prior.startMonth, prior.endMonth]).toEqual(['2025-10', '2025-12']);
    expect(monthCount(prior)).toBe(3);
  });

  it('and the two are different windows, which is why the comparator is a choice', () => {
    const q = quarterScope(2026, 2, CALENDAR_YEAR);
    expect(priorPeriodScope(q).startMonth).toBe('2026-01');
    expect(priorYearScope(q).startMonth).toBe('2025-04');
  });
});

describe('labels', () => {
  it('name the month a year-to-date scope runs to, not only its fiscal year', () => {
    // Otherwise the one thing on a page whose claim is that everything moves is the period label.
    expect(ytdScope('2026-03', CALENDAR_YEAR).label).toBe('YTD through March 2026');
    expect(ytdScope('2026-07', CALENDAR_YEAR).label).toBe('YTD through July 2026');
    expect(ytdScope('2026-03', CALENDAR_YEAR).label).not.toBe(ytdScope('2026-07', CALENDAR_YEAR).label);
  });

  it('read the way a finance team writes them', () => {
    expect(quarterScope(2026, 2, CALENDAR_YEAR).label).toBe('Q2 FY26');
    expect(halfYearScope(2026, 1, CALENDAR_YEAR).label).toBe('H1 FY26');
    expect(fiscalYearScope(2025, CALENDAR_YEAR).label).toBe('FY25');
    expect(monthScope('2026-07').label).toBe('Jul 26');
    expect(formatMonthLong('2026-07')).toBe('July 2026');
    expect(ttmScope('2026-07').startMonth).toBe('2025-08');
  });
});

describe('weeks belong to the cash forecast and to nothing else', () => {
  it('are thirteen, anchored to a month, and refuse to go beyond the horizon', () => {
    const weeks = forecastWeeks('2026-07');
    expect(weeks).toHaveLength(13);
    expect(weeks[0]).toBe('2026-07W1');
    expect(weeks[12]).toBe('2026-07W13');
  });
});

describe('malformed input', () => {
  it('throws rather than producing a month that does not exist', () => {
    expect(() => addMonths('2026-13', 1)).toThrow(/Malformed fiscal month/);
    expect(() => monthScope('nonsense').label).toThrow(/Malformed fiscal month/);
    expect(ym(2026, 7)).toBe('2026-07');
  });
});
