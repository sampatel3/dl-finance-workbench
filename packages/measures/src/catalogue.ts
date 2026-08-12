/**
 * The measure catalogue — and the semantic layer.
 *
 * Every measure the product can show is declared here, exactly once, with its formula in words, its
 * unit, its polarity, its owner and its approval state. Two things read this file and that is the
 * whole point of it:
 *
 *   the **product**, so a figure on the executive surface and the same figure in the analyst grid
 *   are one computation rather than two that agree today;
 *
 *   the **model**, through the chat's tools, so a question about gross margin is answered from the
 *   definition Finance approved rather than from whatever the model believes gross margin is.
 *
 * That second reader is the reason a semantic layer is worth building in 2026. The alternative is a
 * product where the report is governed and the assistant is not, which is a product with two
 * versions of the truth and a plausible one on the screen the executive is looking at.
 *
 * Three conventions:
 *
 *   **`compute` may only read accounts through `get`.** It cannot reach the store, so every input a
 *   measure touches is recorded, and the drill spine is a consequence of the signature rather than a
 *   discipline somebody has to remember.
 *
 *   **Currency values are minor units; percent and ratio are rates.** `0.418`, not `41.8`.
 *
 *   **`annualise` is opt-in and it is about the numerator's window.** A return on capital computed
 *   over seven months has to be annualised from the window's actual days; a margin — a ratio of two
 *   flows over the same window — must not be, and annualising one is how a product reports a 71%
 *   gross margin in February.
 */

import type { AccountCode, Polarity } from '@kestrel/model';
import { annualisationFactor, daysInScope } from '@kestrel/model';
import type { PeriodScope } from '@kestrel/model';
import type { Unit } from './units.ts';

/** What a measure may ask for. The only way into the data from a definition. */
export type Resolver = (accountId: AccountCode, label?: string) => number | null;

export interface MeasureScopeInfo {
  readonly scope: PeriodScope;
}

/**
 * How a measure's trailing values aggregate when the trend comparator fits a line through them.
 *
 * Measures have no basis — they are computed, not stored — so the aggregation cannot be derived and
 * has to be declared. A flow sums, a stock is read at the end, a rate is averaged. Getting it wrong
 * produces a trend expectation seven times too large for a year-to-date window, which is exactly the
 * kind of wrongness a fitted comparator can hide.
 */
export type TrendAggregation = 'sum' | 'last' | 'mean';

export interface MeasureDefinition {
  readonly id: string;
  readonly label: string;
  readonly unit: Unit;
  readonly polarity: Polarity;
  /** The formula, in words. What the formula inspector shows and what the chat is allowed to quote. */
  readonly formula: string;
  readonly owner: string;
  readonly status: 'approved' | 'draft';
  readonly trend: TrendAggregation;
  /** Multiply by the window's annualisation factor. Only for a flow measured against a stock. */
  readonly annualise?: boolean;
  /** One sentence on the trap in this measure. Rendered beside it in the catalogue. */
  readonly note?: string;
  compute(get: Resolver, info: MeasureScopeInfo): number | null;
}

/** Sum accounts, returning null if any is absent — a partial total is a wrong total. */
function total(get: Resolver, ...codes: readonly AccountCode[]): number | null {
  let sum = 0;
  for (const code of codes) {
    const value = get(code);
    if (value === null) return null;
    sum += value;
  }
  return sum;
}

/** Sum accounts, treating an absent one as zero. For accounts that legitimately may not exist. */
function optionalTotal(get: Resolver, ...codes: readonly AccountCode[]): number {
  return codes.reduce((sum, code) => sum + (get(code) ?? 0), 0);
}

const div = (a: number | null, b: number | null): number | null =>
  a === null || b === null || b === 0 ? null : a / b;

// The three composites every profit measure is built from, so they cannot disagree.
const revenue = (get: Resolver): number | null => {
  const external = get('revenue');
  if (external === null) return null;
  // Intercompany revenue survives elimination only where it did not match. At group level that
  // residual IS group revenue and hiding it would make the profit and loss disagree with the
  // balance sheet; at entity level it is the entity's real internal sales.
  return external + optionalTotal(get, 'revenue_ic');
};

const costOfSales = (get: Resolver): number | null => {
  const external = get('cost_of_sales');
  if (external === null) return null;
  return external + optionalTotal(get, 'cost_of_sales_ic', 'subcontract_cost');
};

const opex = (get: Resolver): number =>
  optionalTotal(get, 'staff_cost', 'other_opex', 'unmapped_opex');

const grossProfit = (get: Resolver): number | null => {
  const r = revenue(get);
  const c = costOfSales(get);
  return r === null || c === null ? null : r - c;
};

const ebitda = (get: Resolver): number | null => {
  const gp = grossProfit(get);
  return gp === null ? null : gp - opex(get);
};

export const MEASURES: readonly MeasureDefinition[] = [
  // ------------------------------------------------------------------ profit and loss
  {
    id: 'revenue',
    label: 'Revenue',
    unit: 'currency',
    polarity: 'higher_is_better',
    formula: 'external revenue + any intercompany revenue that did not eliminate',
    owner: 'Group FP&A',
    status: 'approved',
    trend: 'sum',
    note: 'At group level this is after eliminating internal trade, so it is smaller than the sum of the entities’ revenue.',
    compute: revenue,
  },
  {
    id: 'cost_of_sales',
    label: 'Cost of sales',
    unit: 'currency',
    polarity: 'lower_is_better',
    formula: 'direct cost + intercompany purchases + subcontract labour',
    owner: 'Group Financial Controller',
    status: 'approved',
    trend: 'sum',
    note: 'Subcontract labour is inside cost of sales, not operating expense — it is delivery capacity bought in.',
    compute: costOfSales,
  },
  {
    id: 'gross_profit',
    label: 'Gross profit',
    unit: 'currency',
    polarity: 'higher_is_better',
    formula: 'revenue − cost of sales',
    owner: 'Group FP&A',
    status: 'approved',
    trend: 'sum',
    compute: grossProfit,
  },
  {
    id: 'gross_margin',
    label: 'Gross margin',
    unit: 'percent',
    polarity: 'higher_is_better',
    formula: 'gross profit ÷ revenue',
    owner: 'Group FP&A',
    status: 'approved',
    trend: 'mean',
    note: 'Not annualised: it is a ratio of two flows over the same window, and annualising it would be meaningless.',
    compute: (get) => div(grossProfit(get), revenue(get)),
  },
  {
    id: 'subcontract_cost',
    label: 'Subcontract labour',
    unit: 'currency',
    polarity: 'lower_is_better',
    formula: 'subcontract hours × the blended rate paid for them',
    owner: 'Operations Director',
    status: 'approved',
    trend: 'sum',
    compute: (get) => get('subcontract_cost'),
  },
  {
    id: 'subcontract_rate',
    label: 'Subcontract rate',
    unit: 'rate',
    polarity: 'lower_is_better',
    formula: 'subcontract labour cost ÷ subcontract hours',
    owner: 'Operations Director',
    status: 'approved',
    trend: 'mean',
    note: 'The blended rate actually paid, which is the driver a forecast assumption is set against.',
    compute: (get) => div(get('subcontract_cost'), get('subcontract_hours')),
  },
  {
    id: 'staff_cost',
    label: 'Staff cost',
    unit: 'currency',
    polarity: 'lower_is_better',
    formula: 'payroll cost, excluding subcontract labour',
    owner: 'Group Financial Controller',
    status: 'approved',
    trend: 'sum',
    compute: (get) => get('staff_cost'),
  },
  {
    id: 'other_opex',
    label: 'Other operating expense',
    unit: 'currency',
    polarity: 'lower_is_better',
    formula: 'operating expense other than payroll',
    owner: 'Group Financial Controller',
    status: 'approved',
    trend: 'sum',
    compute: (get) => get('other_opex'),
  },
  {
    id: 'unmapped_opex',
    label: 'Unmapped operating expense',
    unit: 'currency',
    polarity: 'lower_is_better',
    formula: 'cost from ledger accounts the mapping set could not place',
    owner: 'Group Financial Controller',
    status: 'approved',
    trend: 'sum',
    note: 'A line nobody wants on a slide, and the reason the mapped profit and loss ties to the trial balance.',
    compute: (get) => get('unmapped_opex'),
  },
  {
    id: 'opex',
    label: 'Operating expense',
    unit: 'currency',
    polarity: 'lower_is_better',
    formula: 'staff cost + other operating expense + unmapped',
    owner: 'Group FP&A',
    status: 'approved',
    trend: 'sum',
    compute: (get) => {
      const staff = get('staff_cost');
      return staff === null ? null : staff + optionalTotal(get, 'other_opex', 'unmapped_opex');
    },
  },
  {
    id: 'ebitda',
    label: 'EBITDA',
    unit: 'currency',
    polarity: 'higher_is_better',
    formula: 'gross profit − operating expense',
    owner: 'Group FP&A',
    status: 'approved',
    trend: 'sum',
    compute: ebitda,
  },
  {
    id: 'ebitda_margin',
    label: 'EBITDA margin',
    unit: 'percent',
    polarity: 'higher_is_better',
    formula: 'EBITDA ÷ revenue',
    owner: 'Group FP&A',
    status: 'approved',
    trend: 'mean',
    compute: (get) => div(ebitda(get), revenue(get)),
  },
  {
    id: 'operating_profit',
    label: 'Operating profit',
    unit: 'currency',
    polarity: 'higher_is_better',
    formula: 'EBITDA − depreciation & amortisation',
    owner: 'Group FP&A',
    status: 'approved',
    trend: 'sum',
    compute: (get) => {
      const e = ebitda(get);
      const d = get('depreciation');
      return e === null || d === null ? null : e - d;
    },
  },
  {
    id: 'net_income',
    label: 'Net income',
    unit: 'currency',
    polarity: 'higher_is_better',
    formula: 'operating profit − interest − tax',
    owner: 'Group FP&A',
    status: 'approved',
    trend: 'sum',
    compute: (get) => {
      const e = ebitda(get);
      if (e === null) return null;
      return e - optionalTotal(get, 'depreciation', 'interest_expense', 'tax_expense');
    },
  },

  // ------------------------------------------------------------------ balance sheet and cash
  {
    id: 'cash',
    label: 'Cash',
    unit: 'currency',
    polarity: 'higher_is_better',
    formula: 'cash & equivalents at period end',
    owner: 'Group Treasurer',
    status: 'approved',
    trend: 'last',
    compute: (get) => get('cash'),
  },
  {
    id: 'receivables',
    label: 'Trade receivables',
    unit: 'currency',
    polarity: 'lower_is_better',
    formula: 'trade receivables at period end',
    owner: 'Group Financial Controller',
    status: 'approved',
    trend: 'last',
    compute: (get) => get('receivables'),
  },
  {
    id: 'working_capital',
    label: 'Working capital',
    unit: 'currency',
    polarity: 'lower_is_better',
    formula: 'receivables + inventory − payables, at period end',
    owner: 'Group Treasurer',
    status: 'approved',
    trend: 'last',
    note: 'Lower is better because working capital is cash the business is not holding.',
    compute: (get) => {
      const r = get('receivables');
      const i = get('inventory');
      const p = get('payables');
      return r === null || i === null || p === null ? null : r + i - p;
    },
  },
  {
    id: 'net_debt',
    label: 'Net debt',
    unit: 'currency',
    polarity: 'lower_is_better',
    formula: 'borrowings − cash, at period end',
    owner: 'Group Treasurer',
    status: 'approved',
    trend: 'last',
    compute: (get) => {
      const b = get('borrowings');
      const c = get('cash');
      return b === null || c === null ? null : b - c;
    },
  },
  {
    id: 'roce',
    label: 'Return on capital employed',
    unit: 'percent',
    polarity: 'higher_is_better',
    formula: 'operating profit ÷ average capital employed, annualised on the window’s actual days',
    owner: 'Group FP&A',
    status: 'approved',
    trend: 'mean',
    annualise: true,
    note: 'Against AVERAGE capital employed, not the closing balance — and annualised from real days, because seven months is not seven twelfths of a year.',
    compute: (get) => {
      const e = ebitda(get);
      const d = get('depreciation');
      const capital = get('avg_capital_employed');
      if (e === null || d === null) return null;
      return div(e - d, capital);
    },
  },

  // ------------------------------------------------------------------ working capital, in days
  {
    id: 'dso',
    label: 'Days sales outstanding',
    unit: 'days',
    polarity: 'lower_is_better',
    formula: 'average receivables ÷ revenue × days in the period',
    owner: 'Group Treasurer',
    status: 'approved',
    trend: 'mean',
    note: 'Against AVERAGE receivables. Using the closing balance makes the ratio jump on the last day of a period for reasons that have nothing to do with collections.',
    compute: (get, info) => {
      const r = div(get('avg_receivables'), revenue(get));
      return r === null ? null : r * daysInScope(info.scope);
    },
  },
  {
    id: 'dpo',
    label: 'Days payable outstanding',
    unit: 'days',
    polarity: 'higher_is_better',
    formula: 'average payables ÷ cost of sales × days in the period',
    owner: 'Group Treasurer',
    status: 'approved',
    trend: 'mean',
    compute: (get, info) => {
      const r = div(get('avg_payables'), costOfSales(get));
      return r === null ? null : r * daysInScope(info.scope);
    },
  },
  {
    id: 'dio',
    label: 'Days inventory outstanding',
    unit: 'days',
    polarity: 'lower_is_better',
    formula: 'average inventory ÷ cost of sales × days in the period',
    owner: 'Group Financial Controller',
    status: 'approved',
    trend: 'mean',
    compute: (get, info) => {
      const r = div(get('avg_inventory'), costOfSales(get));
      return r === null ? null : r * daysInScope(info.scope);
    },
  },
  {
    id: 'cash_conversion_cycle',
    label: 'Cash conversion cycle',
    unit: 'days',
    polarity: 'lower_is_better',
    formula: 'days sales outstanding + days inventory − days payable',
    owner: 'Group Treasurer',
    status: 'approved',
    trend: 'mean',
    compute: (get, info) => {
      const days = daysInScope(info.scope);
      const dso = div(get('avg_receivables'), revenue(get));
      const dio = div(get('avg_inventory'), costOfSales(get));
      const dpo = div(get('avg_payables'), costOfSales(get));
      if (dso === null || dio === null || dpo === null) return null;
      return (dso + dio - dpo) * days;
    },
  },

  // ------------------------------------------------------------------ operational
  {
    id: 'headcount',
    label: 'Headcount',
    unit: 'count',
    polarity: 'neutral',
    formula: 'full-time equivalent staff at period end',
    owner: 'Group HR',
    status: 'approved',
    trend: 'last',
    compute: (get) => {
      const value = get('headcount');
      // Held in minor units like every other fact, so it comes back multiplied by a hundred.
      return value === null ? null : value / 100;
    },
  },
  {
    id: 'revenue_per_head',
    label: 'Revenue per head',
    unit: 'currency',
    polarity: 'higher_is_better',
    formula: 'revenue ÷ headcount',
    owner: 'Group FP&A',
    status: 'approved',
    trend: 'mean',
    compute: (get) => {
      const heads = get('headcount');
      return heads === null || heads === 0 ? null : div(revenue(get), heads / 100);
    },
  },
  {
    id: 'utilisation',
    label: 'Utilisation',
    unit: 'percent',
    polarity: 'higher_is_better',
    formula: 'chargeable hours ÷ available hours',
    owner: 'Operations Director',
    status: 'approved',
    trend: 'mean',
    note: 'Own capacity only. Subcontract hours are bought in, and counting them here would make a margin problem look like a productivity gain.',
    compute: (get) => div(get('chargeable_hours'), get('available_hours')),
  },
  {
    id: 'pipeline_coverage',
    label: 'Pipeline coverage',
    unit: 'ratio',
    polarity: 'higher_is_better',
    formula: 'weighted pipeline ÷ revenue for the period',
    owner: 'Sales Director',
    // Draft on purpose: the weighting comes from the CRM and nobody in Finance owns it yet, which is
    // exactly the state most operational drivers arrive in.
    status: 'draft',
    trend: 'last',
    compute: (get) => div(get('pipeline_weighted'), revenue(get)),
  },
];

const BY_ID = new Map(MEASURES.map((m) => [m.id, m]));

export function measure(id: string): MeasureDefinition {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown measure: ${id}`);
  return found;
}

export function measureIds(): string[] {
  return MEASURES.map((m) => m.id);
}

/** Approved measures only — what a published figure or a board pack may cite. */
export function approvedMeasures(): MeasureDefinition[] {
  return MEASURES.filter((m) => m.status === 'approved');
}

/** The factor a measure's window contributes, or 1 where it does not annualise. */
export function annualisationFor(definition: MeasureDefinition, scope: PeriodScope): number {
  return definition.annualise === true ? annualisationFactor(scope) : 1;
}
