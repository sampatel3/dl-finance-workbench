/**
 * The canonical account taxonomy.
 *
 * Every source chart of accounts maps into these codes, which is what lets one deployment serve
 * a group whose five entities run three different ledgers. Nothing above this file ever refers to
 * a source system's own account number; it refers to an account, and the mapping set does the
 * translation.
 *
 * Four properties on each account do the work:
 *
 *   **basis** decides how the account is evaluated over a window, and it is the single rule that
 *   makes a month, a quarter, a half-year and a year all correct out of one fact table:
 *       flow        — summed across the months in the window (revenue, cost, tax, receipts)
 *       balance     — read at the last month in the window that has a fact (cash, debt, equity)
 *       avg_balance — averaged across the months in the window that have facts (the denominators)
 *   Get this wrong and a quarterly comparison sums three closing cash balances into one number
 *   that looks exactly like a number.
 *
 *   **sign** records the convention the amount is stored in. Everything here is stored in its
 *   natural sign — revenue positive, cost positive, liabilities positive — and the statement
 *   arithmetic subtracts what it needs to. The alternative (credits negative) is defensible and
 *   is not what a reader expects when they open a drill-down.
 *
 *   **polarity** is what a movement MEANS, and it is not the arithmetic sign. A cost that rose is
 *   a positive number and unfavourable news. Any product that colours by sign will eventually
 *   print a rising expense in the same green as rising income.
 *
 *   **side** is the balance-sheet side, which is what the identity check in the data-quality gate
 *   is built on.
 */

export type Basis = 'flow' | 'balance' | 'avg_balance';
export type Statement = 'pl' | 'bs' | 'cf';
export type Side = 'asset' | 'liability' | 'equity';
export type Polarity = 'higher_is_better' | 'lower_is_better' | 'neutral';

export interface Account {
  readonly code: string;
  readonly label: string;
  readonly basis: Basis;
  readonly statement: Statement;
  readonly polarity: Polarity;
  /** Set for every balance-sheet account, absent otherwise. */
  readonly side?: Side;
  /** True where the account is an intercompany one and therefore eliminated on consolidation. */
  readonly intercompany?: boolean;
  /** True where the account exists to hold what the mapping set could not place. */
  readonly unmapped?: boolean;
  /**
   * Which exchange rate the account translates at, where it is not the one its basis implies.
   *
   * Only equity needs this. Assets and liabilities move at the closing rate and profit at the
   * average rate, both of which fall out of the basis — but equity is a `balance` account that must
   * NOT move at the closing rate, because then the translated balance sheet balances exactly and
   * the cumulative translation reserve is zero. A currency model whose reserve is always zero is a
   * currency model that has quietly stopped translating.
   */
  readonly translateAt?: 'closing' | 'average';
  /**
   * True where the account counts things rather than measuring money.
   *
   * Such an account must NOT be translated. Twelve people are twelve people in every currency, and
   * dividing a headcount by an exchange rate produces a group of 519.96 staff — which is both absurd
   * and small enough to survive a review. Hours are the same, and getting it wrong there is worse
   * than absurd: utilisation is a ratio of two hour counts, so translating both would leave the ratio
   * looking right while every hour figure behind it was wrong.
   */
  readonly nonMonetary?: boolean;
}

export const ACCOUNTS = [
  // ------------------------------------------------------------------ profit and loss
  {
    code: 'revenue',
    label: 'Revenue',
    basis: 'flow',
    statement: 'pl',
    polarity: 'higher_is_better',
  },
  {
    code: 'revenue_ic',
    label: 'Intercompany revenue',
    basis: 'flow',
    statement: 'pl',
    polarity: 'neutral',
    intercompany: true,
  },
  {
    code: 'cost_of_sales',
    label: 'Cost of sales',
    basis: 'flow',
    statement: 'pl',
    polarity: 'lower_is_better',
  },
  {
    code: 'cost_of_sales_ic',
    label: 'Intercompany cost of sales',
    basis: 'flow',
    statement: 'pl',
    polarity: 'neutral',
    intercompany: true,
  },
  {
    code: 'subcontract_cost',
    label: 'Subcontract labour',
    basis: 'flow',
    statement: 'pl',
    polarity: 'lower_is_better',
  },
  {
    code: 'staff_cost',
    label: 'Staff cost',
    basis: 'flow',
    statement: 'pl',
    polarity: 'lower_is_better',
  },
  {
    code: 'other_opex',
    label: 'Other operating expense',
    basis: 'flow',
    statement: 'pl',
    polarity: 'lower_is_better',
  },
  {
    code: 'unmapped_opex',
    label: 'Unmapped operating expense',
    basis: 'flow',
    statement: 'pl',
    polarity: 'lower_is_better',
    unmapped: true,
  },
  {
    code: 'depreciation',
    label: 'Depreciation & amortisation',
    basis: 'flow',
    statement: 'pl',
    polarity: 'lower_is_better',
  },
  {
    code: 'interest_expense',
    label: 'Interest expense',
    basis: 'flow',
    statement: 'pl',
    polarity: 'lower_is_better',
  },
  {
    code: 'tax_expense',
    label: 'Tax expense',
    basis: 'flow',
    statement: 'pl',
    polarity: 'lower_is_better',
  },

  // ------------------------------------------------------------------ balance sheet: assets
  {
    code: 'cash',
    label: 'Cash & equivalents',
    basis: 'balance',
    statement: 'bs',
    polarity: 'higher_is_better',
    side: 'asset',
  },
  {
    code: 'receivables',
    label: 'Trade receivables',
    basis: 'balance',
    statement: 'bs',
    polarity: 'neutral',
    side: 'asset',
  },
  {
    code: 'receivables_ic',
    label: 'Intercompany receivables',
    basis: 'balance',
    statement: 'bs',
    polarity: 'neutral',
    side: 'asset',
    intercompany: true,
  },
  {
    code: 'inventory',
    label: 'Inventory',
    basis: 'balance',
    statement: 'bs',
    polarity: 'neutral',
    side: 'asset',
  },
  {
    code: 'fixed_assets',
    label: 'Property, plant & equipment',
    basis: 'balance',
    statement: 'bs',
    polarity: 'neutral',
    side: 'asset',
  },
  {
    code: 'other_assets',
    label: 'Other assets',
    basis: 'balance',
    statement: 'bs',
    polarity: 'neutral',
    side: 'asset',
  },

  // ------------------------------------------------------------------ balance sheet: liabilities
  {
    code: 'payables',
    label: 'Trade payables',
    basis: 'balance',
    statement: 'bs',
    polarity: 'neutral',
    side: 'liability',
  },
  {
    code: 'payables_ic',
    label: 'Intercompany payables',
    basis: 'balance',
    statement: 'bs',
    polarity: 'neutral',
    side: 'liability',
    intercompany: true,
  },
  {
    code: 'borrowings',
    label: 'Borrowings',
    basis: 'balance',
    statement: 'bs',
    polarity: 'lower_is_better',
    side: 'liability',
  },
  {
    code: 'other_liabilities',
    label: 'Other liabilities',
    basis: 'balance',
    statement: 'bs',
    polarity: 'neutral',
    side: 'liability',
  },

  // ------------------------------------------------------------------ balance sheet: equity
  //
  // Split into three because a consolidated equity of one number cannot be translated: opening
  // equity moves at the prior closing rate, the year's profit at the average rate, and the
  // difference between them is the translation reserve. One line would hide the mechanism the
  // Controls surface exists to show.
  {
    code: 'share_capital',
    label: 'Share capital',
    basis: 'balance',
    statement: 'bs',
    polarity: 'neutral',
    side: 'equity',
    translateAt: 'average',
  },
  {
    code: 'retained_earnings',
    label: 'Retained earnings',
    basis: 'balance',
    statement: 'bs',
    polarity: 'higher_is_better',
    side: 'equity',
    translateAt: 'average',
  },
  {
    code: 'translation_reserve',
    label: 'Cumulative translation reserve',
    basis: 'balance',
    statement: 'bs',
    polarity: 'neutral',
    side: 'equity',
  },

  // ------------------------------------------------------------------ denominators
  //
  // Average balances are their own accounts rather than something computed from the balance
  // accounts at read time. A days-sales-outstanding ratio wants the average receivable over the
  // window, and computing that from a `balance` query is impossible: the query has already
  // collapsed the window to its last month.
  {
    code: 'avg_receivables',
    label: 'Average receivables',
    basis: 'avg_balance',
    statement: 'bs',
    polarity: 'neutral',
  },
  {
    code: 'avg_payables',
    label: 'Average payables',
    basis: 'avg_balance',
    statement: 'bs',
    polarity: 'neutral',
  },
  {
    code: 'avg_inventory',
    label: 'Average inventory',
    basis: 'avg_balance',
    statement: 'bs',
    polarity: 'neutral',
  },
  {
    code: 'avg_capital_employed',
    label: 'Average capital employed',
    basis: 'avg_balance',
    statement: 'bs',
    polarity: 'neutral',
  },

  // ------------------------------------------------------------------ operational
  //
  // On the fact table rather than beside it, because a driver that lives somewhere else is a
  // driver that will disagree with the P&L it is supposed to explain.
  {
    code: 'headcount',
    label: 'Headcount (FTE)',
    basis: 'balance',
    statement: 'cf',
    polarity: 'neutral',
    nonMonetary: true,
  },
  {
    code: 'chargeable_hours',
    label: 'Chargeable hours',
    basis: 'flow',
    statement: 'cf',
    polarity: 'higher_is_better',
    nonMonetary: true,
  },
  {
    code: 'subcontract_hours',
    label: 'Subcontract hours',
    basis: 'flow',
    statement: 'cf',
    polarity: 'lower_is_better',
    nonMonetary: true,
  },
  {
    code: 'available_hours',
    label: 'Available hours',
    basis: 'flow',
    statement: 'cf',
    polarity: 'neutral',
    nonMonetary: true,
  },
  {
    code: 'pipeline_weighted',
    label: 'Weighted pipeline',
    basis: 'balance',
    statement: 'cf',
    polarity: 'higher_is_better',
  },
  // Two flows whose ratio is the conversion rate, rather than a rate stored as a fact. A rate cannot be
  // summed across entities, so an account holding one would silently produce a group figure that is the
  // sum of five percentages. Held as numerator and denominator, the conversion aggregates correctly as a
  // weighted average without anybody having to remember that it should.
  {
    code: 'pipeline_converted',
    label: 'Pipeline converted to order',
    basis: 'balance',
    statement: 'cf',
    polarity: 'higher_is_better',
  },

  // ------------------------------------------------------------------ cash flow
  {
    code: 'capex',
    label: 'Capital expenditure',
    basis: 'flow',
    statement: 'cf',
    polarity: 'neutral',
  },
  {
    code: 'dividends',
    label: 'Dividends paid',
    basis: 'flow',
    statement: 'cf',
    polarity: 'neutral',
  },
  {
    code: 'net_borrowing',
    label: 'Net borrowing drawn',
    basis: 'flow',
    statement: 'cf',
    polarity: 'neutral',
  },
] as const satisfies readonly Account[];

export type AccountCode = (typeof ACCOUNTS)[number]['code'];

/**
 * The same list, widened.
 *
 * `ACCOUNTS` is `as const` so `AccountCode` is a union of literals rather than `string` — which is
 * what makes a typo in an account code a compile error everywhere in the product. The cost is that
 * each member's type is exactly its own literal shape, so a member that has no `side` does not have
 * the property at all and cannot be asked about it. This widened view is for iterating; the literal
 * one is for typing.
 */
const ALL: readonly Account[] = ACCOUNTS;

const BY_CODE = new Map<string, Account>(ALL.map((a) => [a.code, a]));

export function account(code: AccountCode): Account {
  const found = BY_CODE.get(code);
  if (!found) throw new Error(`Unknown account: ${code}`);
  return found;
}

export function basisOf(code: AccountCode): Basis {
  return account(code).basis;
}

/**
 * The rate an account translates at: its own override, else whatever its basis implies.
 *
 * One function so the rule lives in one place. `currency.ts` maps a basis to a rate kind; this
 * lets an account overrule it, and equity is the only thing that does.
 */
/** True where the account counts things and must therefore never be translated. */
export function isNonMonetary(code: AccountCode): boolean {
  return account(code).nonMonetary === true;
}

export function translateAtOf(code: AccountCode): 'closing' | 'average' {
  const a = account(code);
  if (a.translateAt !== undefined) return a.translateAt;
  return a.basis === 'balance' ? 'closing' : 'average';
}

export function isIntercompany(code: AccountCode): boolean {
  return account(code).intercompany === true;
}

/** Every account on one side of the balance sheet — what the identity check iterates. */
export function accountsOnSide(side: Side): AccountCode[] {
  return ALL.filter((a) => a.side === side).map((a) => a.code as AccountCode);
}

/** Every account on one statement. */
export function accountsOnStatement(statement: Statement): AccountCode[] {
  return ALL.filter((a) => a.statement === statement).map((a) => a.code as AccountCode);
}

// ---------------------------------------------------------------------------
// Segments and cost centres
// ---------------------------------------------------------------------------

/**
 * Revenue segments.
 *
 * `unitised` is the field the whole variance story rests on: a segment that sells countable
 * things carries a quantity on its facts, so its variance decomposes into price, volume and mix.
 * A segment that does not — a management recharge, an overhead allocation — carries no quantity,
 * and the bridge correctly reports a rate effect for it rather than inventing a price.
 */
export const SEGMENTS = [
  { code: 'equipment', label: 'Equipment', division: 'products', unitised: true },
  { code: 'spares', label: 'Spares & consumables', division: 'products', unitised: true },
  { code: 'contracts', label: 'Service contracts', division: 'services', unitised: true },
  { code: 'projects', label: 'Projects', division: 'services', unitised: false },
] as const;

export type SegmentCode = (typeof SEGMENTS)[number]['code'];
export type DivisionCode = (typeof SEGMENTS)[number]['division'];

export const DIVISIONS = [
  { code: 'products', label: 'Products' },
  { code: 'services', label: 'Services' },
] as const;

const SEGMENT_BY_CODE = new Map(SEGMENTS.map((s) => [s.code, s]));

export function segment(code: SegmentCode): (typeof SEGMENTS)[number] {
  const found = SEGMENT_BY_CODE.get(code);
  if (!found) throw new Error(`Unknown segment: ${code}`);
  return found;
}

export function segmentsOfDivision(division: DivisionCode): SegmentCode[] {
  return SEGMENTS.filter((s) => s.division === division).map((s) => s.code);
}

/** Cost centres, in the order a management P&L lists them. */
export const COST_CENTRES = [
  { code: 'operations', label: 'Manufacturing operations', function: 'delivery' },
  { code: 'field_service', label: 'Field service', function: 'delivery' },
  { code: 'engineering', label: 'Engineering', function: 'delivery' },
  { code: 'sales', label: 'Sales & marketing', function: 'commercial' },
  { code: 'finance_admin', label: 'Finance & administration', function: 'support' },
  { code: 'it', label: 'IT', function: 'support' },
] as const;

export type CostCentreCode = (typeof COST_CENTRES)[number]['code'];
