/**
 * Cash — the direct 13-week forecast, and the indirect bridge that connects a P&L change to it.
 *
 * The client's concept slide shows a card reading *"Cash £4.8m · 13 weeks"*. Read as thirteen weeks
 * of cover it is arithmetically odd against £12.4m of monthly revenue — a figure a CFO can falsify in
 * ten seconds. Read as **the 13-week direct forecast** it is the treasury standard, and it is what
 * makes the PRD's own example question — *"what happens to cash if revenue falls 8%?"* — answerable
 * at all. This file takes the second reading.
 *
 * Two models, because Finance needs both and they answer different questions:
 *
 *   **Direct** — receipts and payments by week, built from the receivable and payable ledgers'
 *   ageing plus the payroll and tax calendars. This is what a treasurer manages. It is short,
 *   granular, and its variance is scoreable because each week is **locked** before actuals land.
 *
 *   **Indirect** — profit to cash through working capital and non-cash items. This is the path a
 *   P&L scenario travels to reach a cash answer, and without it a revenue assumption changes the
 *   income statement and nothing else, which is the gap that makes most scenario tools useless to a
 *   treasurer.
 *
 * ## Why the weeks are locked
 *
 * A forecast that is revised after the actual arrives cannot be scored, and a cash forecast nobody
 * scores drifts until nobody uses it. So each week's forecast is fixed at the moment it was made and
 * kept, and the variance is measured against that — with **receipts and payments separated**, because
 * a late receipt and a late payment offset each other in a net figure and hide two errors behind one
 * good-looking number.
 */

import type { FiscalMonth, ForecastWeek, PeriodScope } from '@kestrel/model';
import {
  CASH_HORIZON_WEEKS,
  addMonths,
  daysInMonth,
  forecastWeeks,
  monthScope,
  priorYearScope,
} from '@kestrel/model';
import { entity, rateFor, translate, translateAtOf } from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { computeMeasure, contextAtScope } from '@kestrel/measures';

// ---------------------------------------------------------------------------
// The board's floor
// ---------------------------------------------------------------------------

/**
 * The minimum cash the board has told Finance to hold, in presentation minor units.
 *
 * A governed figure rather than a constant: it is the thing a breach is measured against, so it has an
 * owner and a date, and a demo that hard-codes it cannot show what a covenant conversation looks like.
 */
export const MINIMUM_CASH = {
  amountMinor: 250_000_000,
  owner: 'Group Treasurer, per board minute',
  effectiveFrom: '2026-01' as FiscalMonth,
  note: 'The floor the 13-week forecast is judged against. A breach inside the horizon is a board item, not a note.',
} as const;

// ---------------------------------------------------------------------------
// The direct forecast
// ---------------------------------------------------------------------------

export interface CashWeek {
  readonly week: ForecastWeek;
  readonly index: number;
  /** Collections from the receivables book. */
  readonly receipts: number;
  /** Supplier payments, payroll, tax and debt service. Positive numbers, subtracted. */
  readonly payments: number;
  readonly net: number;
  /** Cash at the end of this week. */
  readonly closing: number;
  /** True where this week's closing balance is below the board's floor. */
  readonly belowFloor: boolean;
}

export interface DirectForecast {
  readonly anchor: FiscalMonth;
  readonly opening: number;
  readonly weeks: readonly CashWeek[];
  /** The lowest closing balance across the horizon, and the week it happens in. */
  readonly low: { readonly amount: number; readonly week: ForecastWeek; readonly index: number };
  /** The first week below the floor, or undefined where the horizon holds. */
  readonly breach?: {
    readonly week: ForecastWeek;
    readonly index: number;
    readonly shortfall: number;
  };
  readonly floorMinor: number;
}

/**
 * The weekly shape, as named streams rather than one smoothed line.
 *
 * A 13-week forecast that spreads everything evenly is useless, because its entire value is knowing
 * which week is tight — and weeks are tight for specific reasons. Payroll lands monthly, tax lands
 * quarterly, a dividend lands when the board says so, and none of them waits for a receipt.
 *
 * The first version of this file modelled only supplier settlement and overheads, and produced a
 * forecast that generated £6.3m of cash over the quarter and never came close to the floor. It was
 * also not a treasury forecast: **a cash forecast that omits tax, capital spend, debt service and
 * dividends is a working-capital forecast wearing the wrong name.** Adding the four of them is what
 * makes the trough real.
 */

/** Which weeks a lumpy stream lands in, 1-indexed. */
const PAYROLL_WEEKS = [2, 6, 10] as const;
const TAX_WEEK = 5;
const INTEREST_WEEK = 12;
/** The board's dividend, paid after the half-year close. It is what makes week 9 the tight one. */
const DIVIDEND_WEEK = 9;

/** Collections cluster after month end; supplier runs cluster before it. */
const RECEIPT_PROFILE = [
  1.24, 0.86, 0.79, 1.31, 0.92, 0.74, 1.18, 0.95, 0.81, 1.27, 0.9, 0.77, 1.26,
];
const SUPPLIER_PROFILE = [
  0.82, 1.18, 0.88, 0.79, 1.24, 1.11, 0.85, 0.83, 1.16, 0.86, 0.8, 1.15, 0.87,
];

const sum = (values: readonly number[]): number => values.reduce((total, v) => total + v, 0);

/**
 * Build the 13-week direct forecast from the position at the anchor month.
 *
 * Receipts are derived from the receivables book at the collection rate the entity's own days sales
 * outstanding implies, plus the share of new trading that turns to cash inside the horizon — not from
 * a monthly figure divided by 4.33. That is what makes a change in collection days move the cash
 * line, which is the mechanism the whole scenario answer rests on.
 */
export function directForecast(
  ctx: MeasureContext,
  anchor: FiscalMonth = ctx.scope.endMonth,
): DirectForecast {
  const anchorScope = monthScope(anchor);
  // The direct forecast is a point-in-time treasury view. A selected quarter or YTD window belongs
  // to the indirect bridge below; letting it leak into any direct input multiplies cash-flow accounts
  // by the reporting window and mixes period-average FX into an otherwise monthly opening position.
  const anchorCtx: MeasureContext = {
    ...ctx,
    scope: anchorScope,
    ...(ctx.lens === 'constant' ? { comparativeScope: priorYearScope(anchorScope) } : {}),
  };
  const at = (measureId: string): number => computeMeasure(measureId, anchorCtx).value ?? 0;

  const opening = at('cash');
  const receivables = at('receivables');
  const dso = at('dso');
  const dpo = at('dpo');

  const monthlyRevenue = at('revenue');
  const monthlyCost = at('cost_of_sales');
  const monthlyStaff = at('staff_cost');
  const monthlyOther = at('other_opex') + at('unmapped_opex');
  const monthlyTax = at('tax');
  const monthlyInterest = at('interest');
  const days = daysInMonth(anchor);

  // Thirteen weeks is 91 days, and the horizon is expressed in days throughout so a collection
  // period can be compared against it directly.
  const horizonDays = 91;
  const months = horizonDays / days;

  const openingCollected = dso <= 0 ? receivables : receivables * Math.min(1, horizonDays / dso);
  const newTradingCollected =
    monthlyRevenue * months * Math.max(0, 1 - Math.min(1, dso / horizonDays));
  const totalReceipts = openingCollected + newTradingCollected;

  // Supplier settlement at the payable days; everything else on its own calendar.
  const supplierTotal = monthlyCost * months * Math.min(1, horizonDays / Math.max(dpo, 1));
  const payrollPerRun = monthlyStaff;
  const otherPerWeek = (monthlyOther * months) / CASH_HORIZON_WEEKS;
  const taxTotal = monthlyTax * months;
  const interestTotal = monthlyInterest * months;
  const capexTotal = cashFlowAccount(anchorCtx, 'capex') * months;
  const dividendTotal = cashFlowAccount(anchorCtx, 'dividends') * months;
  const borrowingTotal = cashFlowAccount(anchorCtx, 'net_borrowing') * months;

  const receiptWeight = sum(RECEIPT_PROFILE);
  const supplierWeight = sum(SUPPLIER_PROFILE);

  const weeks: CashWeek[] = [];
  let closing = opening;

  forecastWeeks(anchor).forEach((week, i) => {
    const index = i + 1;

    // Financing is drawn evenly; a revolver does not wait for a week either.
    const receipts = Math.round(
      (totalReceipts * (RECEIPT_PROFILE[i] ?? 1)) / receiptWeight +
        borrowingTotal / CASH_HORIZON_WEEKS,
    );

    let payments = (supplierTotal * (SUPPLIER_PROFILE[i] ?? 1)) / supplierWeight + otherPerWeek;
    if ((PAYROLL_WEEKS as readonly number[]).includes(index)) payments += payrollPerRun;
    if (index === TAX_WEEK) payments += taxTotal;
    if (index === INTEREST_WEEK) payments += interestTotal;
    if (index === DIVIDEND_WEEK) payments += dividendTotal;
    payments += capexTotal / CASH_HORIZON_WEEKS;

    const rounded = Math.round(payments);
    const net = receipts - rounded;
    closing += net;
    weeks.push({
      week,
      index,
      receipts,
      payments: rounded,
      net,
      closing,
      belowFloor: closing < MINIMUM_CASH.amountMinor,
    });
  });

  const low = weeks.reduce(
    (worst, current) => (current.closing < worst.closing ? current : worst),
    weeks[0] as CashWeek,
  );
  const firstBreach = weeks.find((week) => week.belowFloor);

  return {
    anchor,
    opening,
    weeks,
    low: { amount: low.closing, week: low.week, index: low.index },
    ...(firstBreach === undefined
      ? {}
      : {
          breach: {
            week: firstBreach.week,
            index: firstBreach.index,
            shortfall: MINIMUM_CASH.amountMinor - firstBreach.closing,
          },
        }),
    floorMinor: MINIMUM_CASH.amountMinor,
  };
}

// ---------------------------------------------------------------------------
// Weekly variance, scored
// ---------------------------------------------------------------------------

export interface WeeklyScore {
  readonly week: ForecastWeek;
  readonly index: number;
  readonly receiptsForecast: number;
  readonly receiptsActual: number;
  readonly paymentsForecast: number;
  readonly paymentsActual: number;
  /** Absolute percentage error on each side. Separated on purpose. */
  readonly receiptsError: number;
  readonly paymentsError: number;
  /** The net error, which is what a single-figure score would have reported. */
  readonly netError: number;
}

export interface CashScore {
  readonly weeks: readonly WeeklyScore[];
  readonly receiptsMape: number;
  readonly paymentsMape: number;
  readonly netMape: number;
  /**
   * True where the net score flatters the two sides — a late receipt and a late payment cancelling.
   * The reason receipts and payments are never scored together.
   */
  readonly nettingFlatters: boolean;
}

/**
 * Score a locked forecast against what happened.
 *
 * Both sides are scored separately and the net is computed only so the surface can show what a
 * single-figure score would have claimed. `nettingFlatters` is the finding: where it is true, a
 * product that reported one number was hiding two errors behind it.
 */
export function scoreCashForecast(
  locked: readonly { week: ForecastWeek; index: number; receipts: number; payments: number }[],
  actual: readonly { week: ForecastWeek; receipts: number; payments: number }[],
): CashScore {
  const byWeek = new Map(actual.map((row) => [row.week, row]));
  const weeks: WeeklyScore[] = [];

  for (const forecast of locked) {
    const observed = byWeek.get(forecast.week);
    if (observed === undefined) continue;
    const receiptsError =
      forecast.receipts === 0
        ? 0
        : Math.abs(observed.receipts - forecast.receipts) / Math.abs(forecast.receipts);
    const paymentsError =
      forecast.payments === 0
        ? 0
        : Math.abs(observed.payments - forecast.payments) / Math.abs(forecast.payments);
    const netForecast = forecast.receipts - forecast.payments;
    const netActual = observed.receipts - observed.payments;
    const netError =
      netForecast === 0 ? 0 : Math.abs(netActual - netForecast) / Math.abs(netForecast);

    weeks.push({
      week: forecast.week,
      index: forecast.index,
      receiptsForecast: forecast.receipts,
      receiptsActual: observed.receipts,
      paymentsForecast: forecast.payments,
      paymentsActual: observed.payments,
      receiptsError,
      paymentsError,
      netError,
    });
  }

  const mean = (values: readonly number[]): number =>
    values.length === 0 ? 0 : sum(values) / values.length;

  const receiptsMape = mean(weeks.map((w) => w.receiptsError));
  const paymentsMape = mean(weeks.map((w) => w.paymentsError));
  const netMape = mean(weeks.map((w) => w.netError));

  return {
    weeks,
    receiptsMape,
    paymentsMape,
    netMape,
    nettingFlatters: netMape < Math.min(receiptsMape, paymentsMape),
  };
}

// ---------------------------------------------------------------------------
// The indirect bridge
// ---------------------------------------------------------------------------

export type CashBridgeKind =
  | 'opening'
  | 'ebitda'
  | 'working_capital'
  | 'capex'
  | 'interest'
  | 'tax'
  | 'financing'
  | 'other'
  | 'closing';

export interface CashBridgeLine {
  readonly kind: CashBridgeKind;
  readonly label: string;
  readonly value: number;
  readonly note?: string;
}

export interface IndirectBridge {
  readonly scope: PeriodScope;
  readonly from: number;
  readonly to: number;
  readonly lines: readonly CashBridgeLine[];
  readonly residual: number;
  readonly sums: boolean;
}

/**
 * Profit to cash, over a window.
 *
 * The path a P&L scenario travels to reach a cash answer, and the reason a revenue change does not
 * stop at the income statement. Working capital is the term that carries it: revenue moves
 * receivables through collection days, cost moves payables and inventory, and the change in the three
 * is cash the business is holding rather than banking.
 *
 * The residual is named and reported rather than absorbed. On seeded data it is small; on a real
 * ledger it is where the items nobody classified live, and a bridge that hides it is a bridge that
 * cannot be reconciled to a cash-flow statement.
 */
export function indirectBridge(ctx: MeasureContext): IndirectBridge {
  const priorScope = monthScope(addMonths(ctx.scope.startMonth, -1));
  const at = (measureId: string, scope: PeriodScope): number =>
    computeMeasure(measureId, contextAtScope(ctx, scope)).value ?? 0;

  const from = at('cash', priorScope);
  const to = at('cash', ctx.scope);

  const ebitda = at('ebitda', ctx.scope);
  const workingCapitalMovement = -(
    at('working_capital', ctx.scope) - at('working_capital', priorScope)
  );
  const interest = -at('interest', ctx.scope);
  const tax = -at('tax', ctx.scope);

  // Capex and financing come from the cash-flow accounts the model holds, not from a balance movement:
  // depreciation makes a fixed-asset movement an unreliable proxy for what was actually spent.
  const capex = -cashFlowAccount(ctx, 'capex');
  const financing = cashFlowAccount(ctx, 'net_borrowing') - cashFlowAccount(ctx, 'dividends');

  const explained = ebitda + workingCapitalMovement + capex + interest + tax + financing;
  const residual = to - from - explained;

  const lines: CashBridgeLine[] = [
    { kind: 'opening', label: 'Opening cash', value: from },
    { kind: 'ebitda', label: 'EBITDA', value: ebitda },
    {
      kind: 'working_capital',
      label: 'Working capital',
      value: workingCapitalMovement,
      note: 'the change in receivables, inventory and payables — cash held rather than banked',
    },
    { kind: 'capex', label: 'Capital expenditure', value: capex },
    { kind: 'interest', label: 'Interest', value: interest },
    { kind: 'tax', label: 'Tax', value: tax },
    {
      kind: 'financing',
      label: 'Financing',
      value: financing,
      note: 'net borrowing drawn, less dividends paid',
    },
    { kind: 'other', label: 'Other', value: residual, note: 'not attributed to any line above' },
    { kind: 'closing', label: 'Closing cash', value: to },
  ];

  const contributions = lines
    .filter((line) => line.kind !== 'opening' && line.kind !== 'closing')
    .reduce((total, line) => total + line.value, 0);

  return {
    scope: ctx.scope,
    from,
    to,
    lines: lines.filter(
      (line) => line.kind === 'opening' || line.kind === 'closing' || line.value !== 0,
    ),
    residual,
    sums: Math.round(contributions) === Math.round(to - from),
  };
}

/**
 * A cash-flow account that has no measure of its own, read at the window and translated.
 *
 * Capex, dividends and net borrowing are drivers rather than reported measures, so they are not in the
 * catalogue — but they are still money in a foreign currency, and they take the same average-rate
 * translation every other flow takes. Skipping that would put a dirham of capital spend into a
 * sterling cash bridge at face value.
 */
function cashFlowAccount(
  ctx: MeasureContext,
  accountId: 'capex' | 'dividends' | 'net_borrowing',
): number {
  let total = 0;
  for (const entityId of ctx.entityIds) {
    const e = entity(entityId);
    const result = ctx.store.query({
      entityId,
      accountId,
      scope: ctx.scope,
      scenario: ctx.scenario,
      versionId: ctx.versionId,
      costCentreId: null,
      segmentId: null,
      ...(ctx.asOfVintage === undefined ? {} : { asOfVintage: ctx.asOfVintage }),
    });
    if (result.value === null) continue;
    const rate = rateFor(
      {
        lens: ctx.lens,
        rates: ctx.rates,
        scope: ctx.scope,
        ...(ctx.comparativeScope === undefined ? {} : { comparativeScope: ctx.comparativeScope }),
      },
      e.functional,
      translateAtOf(accountId),
    );
    total += rate === null ? result.value : translate(result.value, e.functional, rate);
  }
  return total;
}

/**
 * How a change in a P&L driver reaches cash, expressed as the two terms that carry it.
 *
 * This is the answer to *"what happens to cash if revenue falls 8%?"* in its shortest honest form: the
 * margin on the revenue that did not happen, less the receivables that were never going to be
 * collected inside the horizon anyway. A product that answers with the revenue change alone
 * overstates the cash effect by the whole gross margin; one that answers with the margin alone
 * ignores that a fall in revenue releases working capital.
 */
export interface CashSensitivity {
  readonly revenueChange: number;
  readonly marginEffect: number;
  readonly workingCapitalRelease: number;
  readonly netCashEffect: number;
  readonly horizonWeeks: number;
  readonly note: string;
}

export function cashSensitivity(ctx: MeasureContext, revenueDelta: number): CashSensitivity {
  // This is a thirteen-week run-rate answer. Wider reporting windows describe performance, but they
  // must not multiply the monthly revenue shock while the stated cash horizon stays fixed.
  const anchorCtx = contextAtScope(ctx, monthScope(ctx.scope.endMonth));
  const revenue = computeMeasure('revenue', anchorCtx).value ?? 0;
  const margin = computeMeasure('gross_margin', anchorCtx).value ?? 0;
  const dso = computeMeasure('dso', anchorCtx).value ?? 0;

  const revenueChange = revenue * revenueDelta;
  const marginEffect = revenueChange * margin;

  // Less revenue means less receivable. Inside a 91-day horizon the share of that receivable which
  // would have been collected is released as cash, and it partly offsets the margin loss. The
  // released amount is the COST side of the lost revenue — the margin half is already counted above,
  // and counting it twice is the mistake that makes a revenue fall look cash-positive.
  const collectedShare = dso <= 0 ? 1 : Math.min(1, 91 / dso);
  const workingCapitalRelease = -revenueChange * collectedShare * (1 - margin);

  return {
    revenueChange,
    marginEffect,
    workingCapitalRelease,
    netCashEffect: marginEffect + workingCapitalRelease,
    horizonWeeks: CASH_HORIZON_WEEKS,
    note:
      'The margin on the revenue that did not happen, less the receivables that were never going to ' +
      'be collected. Answering with the revenue change alone overstates the cash effect by the whole ' +
      'gross margin.',
  };
}
