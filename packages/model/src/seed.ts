/**
 * Kestrel Industrial Group, generated month by month.
 *
 * There is no pilot customer yet, so the group is synthetic. What it is NOT is the approach the
 * client's concept slide implies — typing in the figures you want on screen. Every number the
 * product shows is computed from the facts this file emits, which is why the period selector, the
 * comparator, the entity picker, the version diff and the scenario controls all genuinely
 * recompute, and why the detectors fire on conditions that are genuinely present.
 *
 * What is enforced here, because a controller will check it in the first minute:
 *
 *   - assets = liabilities + equity, to the penny, every month, for every entity
 *   - segments sum exactly to entity revenue; cost centres sum exactly to entity opex
 *   - equity rolls forward by retained earnings less dividends
 *   - the balance sheet moves only by the cash flow that explains it
 *   - intercompany sales and purchases match, except where a mismatch is planted on purpose
 *
 * The last of those is the interesting one. The identity holds by CONSTRUCTION rather than by a
 * plug: cash is derived from the flows, every other balance is derived from its own driver, and the
 * arithmetic is arranged so the two sides cannot disagree. The proof is in `identity.test.ts`; the
 * mechanism is `closeMonth` below.
 *
 * Twelve conditions are planted deliberately so the analysis has something true to find. Each is
 * marked `PLANTED n` at the line that causes it, so a reader can get from a finding on screen to
 * the arithmetic that produced it without guessing.
 */

import { noise } from '@demo-kit/data';

import type { AccountCode, CostCentreCode, SegmentCode } from './taxonomy.ts';
import { COST_CENTRES, SEGMENTS, segment } from './taxonomy.ts';
import type { Currency } from './entities.ts';
import { INTERCOMPANY, PRESENTATION, entity, tradingEntities } from './entities.ts';
import type { Fact, Scenario } from './facts.ts';
import { FactStore } from './facts.ts';
import type { MonthRate, RateTable } from './currency.ts';
import { Rates } from './currency.ts';
import type { FiscalMonth } from './period.ts';
import { addMonths, daysInMonth, monthsBetween } from './period.ts';
import type { ClosePosition, MappingSet, SourceSystem, Vintage } from './vintages.ts';
import { VintageRegister } from './vintages.ts';

// ---------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------

export const SEED_START: FiscalMonth = '2023-01';
/**
 * The last closed month, and the month the whole demo is about.
 *
 * July 2026 rather than "now": the figures must not move a month after the screenshots were taken,
 * and the client's own illustrative question asks for a July board commentary. Nothing in this
 * package reads a clock.
 */
export const SEED_END: FiscalMonth = '2026-07';

export const MONTHS: readonly FiscalMonth[] = monthsBetween(SEED_START, SEED_END);

/** The month every anchor figure below is quoted at. Index 42 of `MONTHS`. */
const ANCHOR: FiscalMonth = SEED_END;
const ANCHOR_INDEX = MONTHS.indexOf(ANCHOR);

/** The version id actuals are filed under. Actuals have one version, by definition. */
export const ACTUAL_VERSION = 'actual';

const cents = (major: number): number => Math.round(major * 100);

/** Deposits build through the year and dip after the summer. Multiplicative, mean ≈ 1. */
const SEASONAL = [0.96, 0.98, 1.05, 1.0, 1.01, 1.06, 0.94, 0.9, 1.02, 1.05, 1.03, 1.0] as const;

function seasonal(month: FiscalMonth): number {
  return SEASONAL[Number(month.slice(5)) - 1] ?? 1;
}

/** Seasonality normalised so the anchor month is neutral and the anchor figures mean what they say. */
function seasonalRelative(month: FiscalMonth): number {
  return seasonal(month) / seasonal(ANCHOR);
}

// ---------------------------------------------------------------------------
// The specification
// ---------------------------------------------------------------------------

/**
 * A revenue segment, as drivers rather than as an amount.
 *
 * Units and price are separate because that is the only way a variance can be decomposed into
 * volume and price. Unit cost is separate for the same reason on the other side of the margin.
 * Every figure is quoted at the anchor month and walked outward by its drift, so changing one
 * number here changes one story rather than every month independently.
 */
interface SegmentSpec {
  readonly segment: SegmentCode;
  /** Units in the anchor month, before seasonality and noise. */
  readonly units: number;
  /** Month-on-month unit growth. */
  readonly unitGrowth: number;
  /** Price per unit at the anchor, in the entity's functional currency. */
  readonly price: number;
  readonly priceDrift: number;
  /** Direct cost per unit at the anchor. */
  readonly unitCost: number;
  readonly unitCostDrift: number;
}

/**
 * A segment with no natural unit — project revenue, recognised over time.
 *
 * It exists so the bridge has to cope with a segment it cannot split into price and volume, which
 * is the honest case and the one a product that assumes everything is unitised gets wrong. Its
 * facts carry `quantity: null`, and the decomposition reports a rate effect for it.
 */
interface UnUnitisedSpec {
  readonly segment: SegmentCode;
  readonly revenue: number;
  readonly revenueGrowth: number;
  /** Direct cost as a share of revenue. */
  readonly costRate: number;
}

interface EntitySpec {
  readonly id: string;
  readonly unitised: readonly SegmentSpec[];
  readonly unUnitised: readonly UnUnitisedSpec[];

  /**
   * Subcontract labour, for the service entities. Hours × a blended rate, both drivers, because
   * the whole Services-margin story is a rate moving against an assumption and a volume of hours
   * moving with it.
   */
  readonly subcontractHours?: number;
  readonly subcontractHoursGrowth?: number;
  readonly subcontractRate?: number;
  readonly subcontractRateDrift?: number;
  /**
   * Which segments the bought-in labour is worked on, as weights summing to one.
   *
   * Held per entity because it is a fact about the business rather than a convention: production
   * overflow at the factory is equipment work, and bought-in engineers at the service companies are on
   * contracts and projects. Without it subcontract cost has no segment, and then a segment-sliced gross
   * margin silently excludes the largest cost in the services division — so the planted service-margin
   * condition existed in the group figure and was invisible at exactly the level a reader would drill to
   * find it.
   */
  readonly subcontractSegments?: Readonly<Partial<Record<SegmentCode, number>>>;

  /** Own delivery capacity, so utilisation is a real ratio rather than a made-up percentage. */
  readonly chargeableHours?: number;
  readonly availableHours?: number;

  readonly headcount: number;
  readonly headcountGrowth: number;
  /** Average annual cost per head, at the anchor. */
  readonly costPerHead: number;
  readonly costPerHeadDrift: number;

  /** Other operating expense as a share of revenue. */
  readonly otherOpexRate: number;

  /** Working capital, in days. */
  readonly dso: number;
  readonly dpo: number;
  readonly dio: number;

  readonly openingCash: number;
  readonly openingFixedAssets: number;
  readonly openingBorrowings: number;
  readonly openingOtherAssets: number;
  readonly openingOtherLiabilities: number;
  readonly shareCapital: number;

  readonly monthlyCapex: number;
  /** Depreciation as a monthly share of opening fixed assets. */
  readonly depreciationRate: number;
  /** Annual interest on borrowings. */
  readonly interestRate: number;
  readonly taxRate: number;
  /** Share of profit paid out, monthly. */
  readonly dividendRate: number;

  /** How opex splits across cost centres. Normalised, so these are weights not percentages. */
  readonly costCentreWeights: Partial<Record<CostCentreCode, number>>;

  /** Weighted CRM pipeline at the anchor, for the opportunity the Overview surfaces. */
  readonly pipelineWeighted?: number;
}

/**
 * The group.
 *
 * The figures are tuned so July 2026 consolidates to the four headline numbers on the client's
 * concept slide — revenue £12.4m, gross margin 41.8%, EBITDA £2.1m, cash £4.8m — as computed
 * results rather than literals. `headline.test.ts` asserts they still land, so a change to a driver
 * that moves them away from the deck is a failing test rather than a quiet drift.
 */
const SPECS: readonly EntitySpec[] = [
  {
    id: 'manufacturing',
    unitised: [
      {
        segment: 'equipment',
        units: 141,
        unitGrowth: 0.0042,
        price: 24_800,
        priceDrift: 0.0016,
        unitCost: 14_030,
        unitCostDrift: 0.0019,
      },
      {
        segment: 'spares',
        units: 4_395,
        unitGrowth: 0.0061,
        price: 205,
        priceDrift: 0.0012,
        unitCost: 103.8,
        unitCostDrift: 0.0014,
      },
    ],
    unUnitised: [],
    headcount: 214,
    headcountGrowth: 0.0011,
    costPerHead: 40_400,
    costPerHeadDrift: 0.0021,
    otherOpexRate: 0.061,
    dso: 52,
    dpo: 46,
    dio: 74,
    openingCash: 2_050_000,
    openingFixedAssets: 18_900_000,
    openingBorrowings: 9_400_000,
    openingOtherAssets: 3_100_000,
    openingOtherLiabilities: 2_450_000,
    shareCapital: 12_000_000,
    monthlyCapex: 168_000,
    depreciationRate: 0.0069,
    interestRate: 0.062,
    taxRate: 0.25,
    dividendRate: 0.8192,
    costCentreWeights: {
      operations: 0.44,
      engineering: 0.19,
      sales: 0.16,
      finance_admin: 0.13,
      it: 0.08,
    },
    pipelineWeighted: 9_400_000,
  },
  {
    id: 'services',
    unitised: [
      {
        segment: 'contracts',
        units: 1_872,
        unitGrowth: 0.0048,
        price: 1_082,
        priceDrift: 0.0014,
        unitCost: 450.5,
        unitCostDrift: 0.0022,
      },
    ],
    unUnitised: [{ segment: 'projects', revenue: 941_000, revenueGrowth: 0.0034, costRate: 0.605 }],
    // PLANTED 2 and 3 — the subcontract rate drifts up faster than the price it is recovered in,
    // so service-contract gross margin falls short of every forecast that assumed the old rate,
    // and the last three months are above the assumption rather than merely near it.
    subcontractHours: 9_850,
    subcontractHoursGrowth: 0.0072,
    subcontractRate: 41.8,
    subcontractRateDrift: 0.0058,
    // Production overflow: bought-in machining and fabrication, on the equipment line.
    subcontractSegments: { equipment: 0.78, spares: 0.22 },
    chargeableHours: 21_400,
    availableHours: 27_600,
    headcount: 168,
    headcountGrowth: 0.0016,
    costPerHead: 37_700,
    costPerHeadDrift: 0.0019,
    otherOpexRate: 0.058,
    dso: 58,
    dpo: 42,
    dio: 12,
    openingCash: 1_180_000,
    openingFixedAssets: 4_600_000,
    openingBorrowings: 3_200_000,
    openingOtherAssets: 1_450_000,
    openingOtherLiabilities: 1_620_000,
    shareCapital: 4_000_000,
    monthlyCapex: 62_000,
    depreciationRate: 0.0081,
    interestRate: 0.064,
    taxRate: 0.25,
    dividendRate: 0.8192,
    costCentreWeights: {
      field_service: 0.47,
      engineering: 0.14,
      sales: 0.17,
      finance_admin: 0.14,
      it: 0.08,
    },
    pipelineWeighted: 6_100_000,
  },
  {
    id: 'gulf',
    unitised: [
      {
        segment: 'contracts',
        units: 6_133,
        unitGrowth: 0.0069,
        price: 1_705,
        priceDrift: 0.0018,
        unitCost: 714.4,
        unitCostDrift: 0.0026,
      },
    ],
    unUnitised: [
      { segment: 'projects', revenue: 2_140_000, revenueGrowth: 0.0051, costRate: 0.621 },
    ],
    subcontractHours: 14_600,
    subcontractHoursGrowth: 0.0094,
    subcontractRate: 121.4,
    subcontractRateDrift: 0.0071,
    // Bought-in engineers, mostly on the contracted service base. PLANTED 2 lands here.
    subcontractSegments: { contracts: 0.7, projects: 0.3 },
    chargeableHours: 29_800,
    availableHours: 41_200,
    headcount: 232,
    headcountGrowth: 0.0028,
    costPerHead: 99_400,
    costPerHeadDrift: 0.0018,
    otherOpexRate: 0.054,
    // PLANTED 5 — collections at the Gulf entity slip. The base is already the longest in the
    // group; `dsoDrift` below steepens it over the closing quarter, which is what takes the
    // 13-week cash forecast under the board's floor.
    dso: 64,
    dpo: 44,
    dio: 18,
    openingCash: 6_400_000,
    openingFixedAssets: 11_200_000,
    openingBorrowings: 8_600_000,
    openingOtherAssets: 2_900_000,
    openingOtherLiabilities: 3_400_000,
    shareCapital: 18_000_000,
    monthlyCapex: 184_000,
    depreciationRate: 0.0074,
    interestRate: 0.055,
    // UAE corporate tax, 9%.
    taxRate: 0.09,
    dividendRate: 0.7942,
    costCentreWeights: {
      field_service: 0.49,
      engineering: 0.13,
      sales: 0.16,
      finance_admin: 0.14,
      it: 0.08,
    },
    pipelineWeighted: 21_400_000,
  },
  {
    id: 'europe',
    unitised: [
      {
        segment: 'equipment',
        units: 40,
        unitGrowth: 0.0036,
        price: 33_100,
        priceDrift: 0.0013,
        unitCost: 19_000,
        unitCostDrift: 0.0017,
      },
      {
        segment: 'spares',
        units: 1_700,
        unitGrowth: 0.0052,
        price: 268,
        priceDrift: 0.0011,
        unitCost: 137.2,
        unitCostDrift: 0.0013,
      },
    ],
    unUnitised: [],
    headcount: 74,
    headcountGrowth: 0.0009,
    costPerHead: 55_300,
    costPerHeadDrift: 0.0023,
    otherOpexRate: 0.063,
    dso: 47,
    dpo: 51,
    dio: 68,
    openingCash: 1_640_000,
    openingFixedAssets: 5_800_000,
    openingBorrowings: 2_900_000,
    openingOtherAssets: 1_100_000,
    openingOtherLiabilities: 1_280_000,
    shareCapital: 5_000_000,
    monthlyCapex: 58_000,
    depreciationRate: 0.0072,
    interestRate: 0.049,
    taxRate: 0.3,
    dividendRate: 0.7942,
    costCentreWeights: {
      operations: 0.41,
      engineering: 0.18,
      sales: 0.18,
      finance_admin: 0.15,
      it: 0.08,
    },
    pipelineWeighted: 3_800_000,
  },
  {
    id: 'inc',
    unitised: [
      {
        segment: 'contracts',
        units: 611,
        unitGrowth: 0.0058,
        price: 1_235,
        priceDrift: 0.0017,
        unitCost: 531.4,
        unitCostDrift: 0.0021,
      },
    ],
    unUnitised: [{ segment: 'projects', revenue: 168_000, revenueGrowth: 0.0062, costRate: 0.626 }],
    subcontractHours: 2_140,
    subcontractHoursGrowth: 0.0081,
    subcontractRate: 84.5,
    subcontractRateDrift: 0.0049,
    subcontractSegments: { contracts: 0.55, projects: 0.45 },
    chargeableHours: 4_900,
    availableHours: 6_600,
    headcount: 31,
    headcountGrowth: 0.0021,
    costPerHead: 90_900,
    costPerHeadDrift: 0.0024,
    otherOpexRate: 0.067,
    dso: 44,
    dpo: 39,
    dio: 14,
    openingCash: 720_000,
    openingFixedAssets: 1_150_000,
    openingBorrowings: 900_000,
    openingOtherAssets: 380_000,
    openingOtherLiabilities: 420_000,
    shareCapital: 1_500_000,
    monthlyCapex: 14_000,
    depreciationRate: 0.0086,
    interestRate: 0.071,
    taxRate: 0.21,
    dividendRate: 0.7942,
    costCentreWeights: {
      field_service: 0.44,
      engineering: 0.12,
      sales: 0.21,
      finance_admin: 0.15,
      it: 0.08,
    },
    pipelineWeighted: 1_900_000,
  },
];

const SPEC_BY_ID = new Map(SPECS.map((s) => [s.id, s]));

function spec(id: string): EntitySpec {
  const found = SPEC_BY_ID.get(id);
  if (!found) throw new Error(`No seed spec for entity ${id}`);
  return found;
}

// ---------------------------------------------------------------------------
// The planted conditions that are timing rather than drift
// ---------------------------------------------------------------------------

/** PLANTED 5 — extra days of DSO at the Gulf entity over the closing quarter. */
const GULF_DSO_DRIFT: Readonly<Record<FiscalMonth, number>> = {
  '2026-05': 3,
  '2026-06': 6,
  '2026-07': 9,
};

/** PLANTED 7 — two ledger accounts appeared in the July load with no mapping. */
export const UNMAPPED_JULY: readonly {
  entityId: string;
  costCentre: CostCentreCode;
  sourceCode: string;
  sourceLabel: string;
  major: number;
}[] = [
  {
    entityId: 'services',
    costCentre: 'field_service',
    sourceCode: '58420',
    sourceLabel: 'Subcontract labour — framework',
    major: 148_000,
  },
  {
    entityId: 'manufacturing',
    costCentre: 'it',
    sourceCode: '61155',
    sourceLabel: 'Software subscriptions',
    major: 64_000,
  },
];

/** PLANTED 8 — the Gulf entity has not recorded one intercompany invoice. */
export const IC_MISMATCH_MONTH: FiscalMonth = '2026-07';
export const IC_MISMATCH_PRESENTATION_MAJOR = 48_000;

/**
 * The threshold an intercompany reconciliation runs at, in minor units of the presentation currency.
 *
 * Two sides of one transaction denominated in different currencies are each rounded to their own
 * minor unit, so they can differ by a penny or two without anything being wrong. A reconciliation
 * with no threshold reports every one of those and buries the difference that matters; a real one
 * sets a threshold, and this is ours — one pound, which is four orders of magnitude below the
 * planted break.
 */
export const IC_MATERIALITY_MINOR = 100;

/** PLANTED 11 — the July load restates June at Kestrel Services: cost of sales to operating expense. */
export const RESTATEMENT_MONTH: FiscalMonth = '2026-06';
export const RESTATEMENT_ENTITY = 'services';
export const RESTATEMENT_MAJOR = 310_000;

/** PLANTED 12 — pipeline conversion running ahead of the rate the forecast assumes. */
export const PIPELINE_CONVERSION_ASSUMED = 0.28;
export const PIPELINE_CONVERSION_ACTUAL = 0.343;

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

/**
 * Rates as units of foreign currency per £1, month by month.
 *
 * AED is pegged to the dollar, so it moves only as sterling moves against the dollar — which is
 * why the Gulf entity's translation is nearly flat while the euro entity's is not, and why the
 * constant-currency test can assert that one moves and the other does not. A rate table of made-up
 * numbers would pass a test that only checks translation happened at all.
 */
const RATE_ANCHOR: Readonly<Record<Exclude<Currency, 'GBP'>, number>> = {
  USD: 1.272,
  EUR: 1.168,
  AED: 4.671, // 1.272 × 3.6725, the dollar peg
};

/**
 * PLANTED 4 — the euro weakens against sterling over the window.
 *
 * Rates are units of foreign currency per £1, so a RISING rate is a WEAKENING currency: more euros
 * to the pound. The exponent below is therefore positive in time, and getting its sign wrong
 * reverses every constant-currency conclusion in the product while leaving every figure looking
 * entirely plausible — which is why the world test asserts the direction rather than only the
 * difference.
 */
const RATE_DRIFT: Readonly<Record<Exclude<Currency, 'GBP'>, number>> = {
  USD: 0.0011,
  EUR: 0.0034,
  AED: 0.0011,
};

/**
 * The healthy twin's rates carry no drift, only noise.
 *
 * Condition 4 lives in the rate table rather than in the ledger, so it is the one planted condition the
 * twin cannot be cleaned of by changing an assumption — and it was surviving there, silently, because
 * `buildRates` was never told which world it was building. A twin whose euro still weakens gives the
 * constant-currency detector something real to find, and then the detector's silence on the twin is the
 * thing being asserted and it is not silent.
 *
 * Noise stays. A twin with rates frozen to six decimal places would let a bug that ignores rates
 * entirely pass every test the twin is in.
 */
function buildRates(seed: string, healthy: boolean): RateTable {
  const rates: MonthRate[] = [];
  for (const currency of ['USD', 'EUR', 'AED'] as const) {
    let previousClosing = 0;
    for (const month of MONTHS) {
      const t = MONTHS.indexOf(month) - ANCHOR_INDEX;
      const drift = healthy ? 0 : RATE_DRIFT[currency];
      const trend = RATE_ANCHOR[currency] * (1 + drift) ** t;
      const closing = trend * (1 + noise(`${seed}|fx|${currency}|${month}`) * 0.011);
      // The average is the mean of this month's close and last month's, which is what a monthly
      // close actually uses and is why average and closing differ by a real amount rather than by
      // a fudge factor.
      const average = previousClosing === 0 ? closing : (closing + previousClosing) / 2;
      previousClosing = closing;
      rates.push({
        currency,
        month,
        closing: round(closing, 6),
        average: round(average, 6),
      });
    }
  }
  return { id: 'fx-2026-07-ecb-close', source: 'Group treasury, ECB close', rates };
}

const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

// ---------------------------------------------------------------------------
// Assumption sets — what a version believed
// ---------------------------------------------------------------------------

/**
 * A version's assumptions, as multipliers on the drivers.
 *
 * Holding a forecast as a set of deltas against the same generator is what makes a version diff
 * possible at all: the difference between v6 and v7 is the difference between these two objects,
 * and the impact of that difference is the generator run twice. A forecast stored as its output
 * instead can be compared only figure by figure, which tells a reader what changed and never why.
 */
export interface AssumptionSet {
  readonly volume: number;
  readonly price: number;
  readonly unitCost: number;
  /**
   * The cost to serve on the **services** division only — contracts and projects.
   *
   * A group-wide unit-cost multiplier cannot express the condition the client's own slide 5 describes:
   * services margin behind plan while the group is ahead of it. Everything moving together is not a
   * finding anybody can act on, because there is nobody to give it to. A cost-to-serve assumption on the
   * service book is also how a forecast is actually built — the service business is priced on a rate card
   * and delivered at a cost that drifts, and the gap between those two is the thing FP&A argues about.
   *
   * It carries three of the twelve conditions at once, which is the point: the margin miss on services
   * (2), the delivery rate above assumption (3), and the same-direction miss across versions (9) are one
   * cause seen at three horizons, and a reader can drill from any of them to the other two.
   */
  readonly serviceDeliveryCost: number;
  readonly subcontractRate: number;
  readonly subcontractHours: number;
  readonly dsoDays: number;
  readonly pipelineConversion: number;
}

export const ACTUAL_ASSUMPTIONS: AssumptionSet = {
  volume: 1,
  price: 1,
  unitCost: 1,
  serviceDeliveryCost: 1,
  subcontractRate: 1,
  subcontractHours: 1,
  dsoDays: 0,
  pipelineConversion: PIPELINE_CONVERSION_ACTUAL,
};

export interface VersionSpec {
  readonly id: string;
  readonly label: string;
  readonly scenario: Scenario;
  /** Months up to and including this one are actuals in this version; later months are projected. */
  readonly actualsThrough: FiscalMonth;
  readonly assumptions: AssumptionSet;
  readonly status: 'approved' | 'superseded' | 'draft';
  readonly owner: string;
}

/**
 * The versions the demo holds.
 *
 * PLANTED 1 — v6 assumed 5.4% less volume than July delivered, at nearly the same price, so the
 * revenue variance decomposes as mostly volume.
 *
 * PLANTED 9 — v4, v5 and v6 each assumed a subcontract rate *and* an hours figure below the ones
 * that arrived, and each by less than the last: a same-direction miss across three consecutive
 * versions, shrinking, so no single variance looks like a pattern.
 *
 * The volume, price and unit-cost assumptions deliberately **straddle** what arrived — v4 optimistic,
 * v5 nearly right, v6 short. That is the point rather than an accident of calibration. An earlier
 * version of this table had every multiplier below 1, which made every forecast conservative about
 * everything, and the bias detector then fired on revenue, cost of sales and EBITDA alike — correctly,
 * because the data really was uniformly biased, and uselessly, because a detector that fires on
 * everything has found nothing. A forecast that is noisy about volume and habitually wrong about one
 * cost is both more realistic and the only shape in which the finding means anything.
 */
export const VERSIONS: readonly VersionSpec[] = [
  {
    id: 'budget-fy26',
    label: 'Budget FY26',
    scenario: 'BUDGET',
    actualsThrough: '2025-12',
    assumptions: {
      volume: 0.938,
      price: 0.992,
      unitCost: 0.984,
      serviceDeliveryCost: 0.902,
      subcontractRate: 0.918,
      subcontractHours: 0.952,
      dsoDays: 0,
      pipelineConversion: PIPELINE_CONVERSION_ASSUMED,
    },
    status: 'approved',
    owner: 'Group FP&A',
  },
  {
    id: 'v4',
    label: 'Forecast v4',
    scenario: 'FORECAST',
    actualsThrough: '2025-12',
    // Optimistic on volume: the first cut at FY26, made before the year started.
    assumptions: {
      volume: 1.028,
      price: 1.006,
      unitCost: 1.011,
      serviceDeliveryCost: 0.912,
      subcontractRate: 0.929,
      subcontractHours: 0.958,
      dsoDays: 0,
      pipelineConversion: PIPELINE_CONVERSION_ASSUMED,
    },
    status: 'superseded',
    owner: 'Group FP&A',
  },
  {
    id: 'v5',
    label: 'Forecast v5',
    scenario: 'FORECAST',
    actualsThrough: '2026-03',
    // Trimmed at Q3, and nearly right on volume — which is what makes the subcontract miss stand out.
    assumptions: {
      volume: 1.009,
      price: 0.997,
      unitCost: 0.996,
      serviceDeliveryCost: 0.928,
      subcontractRate: 0.947,
      subcontractHours: 0.969,
      dsoDays: 0,
      pipelineConversion: PIPELINE_CONVERSION_ASSUMED,
    },
    status: 'superseded',
    owner: 'Group FP&A',
  },
  {
    id: 'v6',
    label: 'Forecast v6',
    scenario: 'FORECAST',
    actualsThrough: '2026-06',
    assumptions: {
      volume: 0.946,
      price: 0.998,
      unitCost: 0.993,
      serviceDeliveryCost: 0.941,
      subcontractRate: 0.962,
      subcontractHours: 0.981,
      dsoDays: 0,
      pipelineConversion: PIPELINE_CONVERSION_ASSUMED,
    },
    status: 'approved',
    owner: 'Group FP&A',
  },
  {
    id: 'v7',
    label: 'Forecast v7',
    scenario: 'FORECAST',
    actualsThrough: '2026-07',
    assumptions: {
      volume: 1,
      price: 1,
      unitCost: 1,
      serviceDeliveryCost: 1.008,
      subcontractRate: 1.032,
      subcontractHours: 1.014,
      dsoDays: 6,
      pipelineConversion: PIPELINE_CONVERSION_ACTUAL,
    },
    status: 'draft',
    owner: 'Group FP&A',
  },
];

// ---------------------------------------------------------------------------
// One month of one entity
// ---------------------------------------------------------------------------

/** Everything the balance sheet needs carried from one month to the next. */
interface Carried {
  cash: number;
  receivables: number;
  receivablesIc: number;
  inventory: number;
  payables: number;
  payablesIc: number;
  fixedAssets: number;
  otherAssets: number;
  otherLiabilities: number;
  borrowings: number;
  retainedEarnings: number;
}

interface MonthPl {
  readonly revenueBySegment: Map<SegmentCode, { revenue: number; units: number | null }>;
  readonly costBySegment: Map<SegmentCode, { cost: number; units: number | null }>;
  readonly revenueIc: number;
  readonly costIc: number;
  readonly subcontractCost: number;
  readonly subcontractHours: number;
  readonly chargeableHours: number;
  readonly availableHours: number;
  readonly headcount: number;
  readonly staffCost: number;
  readonly otherOpex: number;
  readonly unmappedOpex: number;
  readonly depreciation: number;
  readonly interest: number;
  readonly tax: number;
  readonly netIncome: number;
  readonly revenue: number;
  readonly costOfSales: number;
}

/** Compound a monthly drift out from the anchor month. */
function drift(base: number, rate: number, index: number): number {
  return base * (1 + rate) ** (index - ANCHOR_INDEX);
}

/**
 * The cost-to-serve multiplier, which applies to the services division and to nothing else.
 *
 * Read from the segment's own division rather than from a list of segment codes, so adding a third
 * service line picks the assumption up instead of silently escaping it.
 */
function serviceCostFactor(code: SegmentCode, a: AssumptionSet): number {
  return segment(code).division === 'services' ? a.serviceDeliveryCost : 1;
}

function monthPl(
  s: EntitySpec,
  month: FiscalMonth,
  index: number,
  a: AssumptionSet,
  seed: string,
  carried: Carried,
  rates: Rates,
  healthy: boolean,
): MonthPl {
  const season = seasonalRelative(month);
  const revenueBySegment = new Map<SegmentCode, { revenue: number; units: number | null }>();
  const costBySegment = new Map<SegmentCode, { cost: number; units: number | null }>();

  for (const seg of s.unitised) {
    const units = Math.max(
      1,
      Math.round(
        drift(seg.units, seg.unitGrowth, index) *
          season *
          a.volume *
          (1 + noise(`${seed}|${s.id}|${seg.segment}|${month}|units`) * 0.021),
      ),
    );
    const price =
      drift(seg.price, seg.priceDrift, index) *
      a.price *
      (1 + noise(`${seed}|${s.id}|${seg.segment}|${month}|price`) * 0.006);
    const unitCost =
      drift(seg.unitCost, seg.unitCostDrift, index) *
      a.unitCost *
      serviceCostFactor(seg.segment, a) *
      (1 + noise(`${seed}|${s.id}|${seg.segment}|${month}|cost`) * 0.009);
    revenueBySegment.set(seg.segment, { revenue: units * price, units });
    costBySegment.set(seg.segment, { cost: units * unitCost, units });
  }

  for (const seg of s.unUnitised) {
    const revenue =
      drift(seg.revenue, seg.revenueGrowth, index) *
      season *
      a.volume *
      (1 + noise(`${seed}|${s.id}|${seg.segment}|${month}|rev`) * 0.028);
    revenueBySegment.set(seg.segment, { revenue, units: null });
    costBySegment.set(seg.segment, {
      cost: revenue * seg.costRate * a.unitCost * serviceCostFactor(seg.segment, a),
      units: null,
    });
  }

  const revenue = [...revenueBySegment.values()].reduce((sum, r) => sum + r.revenue, 0);
  const costOfSales = [...costBySegment.values()].reduce((sum, c) => sum + c.cost, 0);

  const subcontractHours =
    s.subcontractHours === undefined
      ? 0
      : drift(s.subcontractHours, s.subcontractHoursGrowth ?? 0, index) *
        season *
        a.subcontractHours *
        (1 + noise(`${seed}|${s.id}|${month}|schours`) * 0.024);
  const subcontractRate =
    s.subcontractRate === undefined
      ? 0
      : drift(s.subcontractRate, s.subcontractRateDrift ?? 0, index) *
        a.subcontractRate *
        (1 + noise(`${seed}|${s.id}|${month}|scrate`) * 0.007);
  const subcontractCost = subcontractHours * subcontractRate;

  const chargeableHours =
    s.chargeableHours === undefined
      ? 0
      : drift(s.chargeableHours, 0.0021, index) *
        season *
        a.volume *
        (1 + noise(`${seed}|${s.id}|${month}|ch`) * 0.019);
  const availableHours =
    s.availableHours === undefined ? 0 : drift(s.availableHours, 0.0014, index);

  const headcount = Math.round(drift(s.headcount, s.headcountGrowth, index));
  const staffCost = (headcount * drift(s.costPerHead, s.costPerHeadDrift, index)) / 12;
  const otherOpex =
    revenue * s.otherOpexRate * (1 + noise(`${seed}|${s.id}|${month}|opex`) * 0.017);

  // PLANTED 7 — the unmapped accounts land in July only, and only as actuals: a forecast cannot
  // have failed to map an account that had not appeared when it was made.
  const unmappedOpex =
    !healthy && month === SEED_END
      ? UNMAPPED_JULY.filter((u) => u.entityId === s.id).reduce((sum, u) => sum + u.major, 0)
      : 0;

  // Intercompany: the seller's side is derived from what the buyers buy, so the two cannot drift
  // apart by construction — which is what makes the one planted mismatch legible as a mismatch.
  const costIc = intercompanyPurchase(s.id, costOfSales, month, a, rates, healthy);
  const revenueIc = intercompanySale(s.id, month, a, seed, index, rates);

  const depreciation = carried.fixedAssets * s.depreciationRate;
  const interest = (carried.borrowings * s.interestRate) / 12;

  const grossProfit = revenue + revenueIc - costOfSales - costIc - subcontractCost;
  const ebitda = grossProfit - staffCost - otherOpex - unmappedOpex;
  const preTax = ebitda - depreciation - interest;
  const tax = preTax > 0 ? preTax * s.taxRate : 0;

  return {
    revenueBySegment,
    costBySegment,
    revenueIc,
    costIc,
    subcontractCost,
    subcontractHours,
    chargeableHours,
    availableHours,
    headcount,
    staffCost,
    otherOpex,
    unmappedOpex,
    depreciation,
    interest,
    tax,
    netIncome: preTax - tax,
    revenue,
    costOfSales,
  };
}

/**
 * What this entity buys from inside the group.
 *
 * Denominated in the SELLER's currency and recorded by the buyer at the month's average rate, which
 * is how an intercompany invoice actually works — and it is what makes the two sides eliminate
 * exactly. Using a fixed transfer-pricing rate instead leaves a residual equal to the currency
 * movement since that rate was set, in every month, which reads on screen as a permanently failing
 * reconciliation and buries the one that is real.
 */
function intercompanyPurchase(
  entityId: string,
  costOfSales: number,
  month: FiscalMonth,
  a: AssumptionSet,
  rates: Rates,
  healthy: boolean,
): number {
  const pair = INTERCOMPANY.find((p) => p.buyerId === entityId);
  if (pair === undefined) return 0;
  const gross = costOfSales * pair.shareOfBuyerCost;

  // PLANTED 8 — the Gulf entity has not recorded one intercompany invoice in July. Its cost and
  // its payable are both short by the same amount, so ITS OWN balance sheet still balances; what
  // does not match is the seller's side, which is exactly what an intercompany reconciliation is
  // for. The group therefore carries the difference as an unreconciled balance rather than as a
  // broken identity — see `consolidate.ts`.
  if (!healthy && entityId === 'gulf' && month === IC_MISMATCH_MONTH) {
    return gross - IC_MISMATCH_PRESENTATION_MAJOR * rates.at('AED', month).average;
  }

  return gross;
}

/** What this entity sells inside the group: the sum of what its buyers recorded buying. */
function intercompanySale(
  entityId: string,
  month: FiscalMonth,
  a: AssumptionSet,
  seed: string,
  index: number,
  rates: Rates,
): number {
  const pairs = INTERCOMPANY.filter((p) => p.sellerId === entityId);
  if (pairs.length === 0) return 0;
  let total = 0;
  for (const pair of pairs) {
    const buyer = spec(pair.buyerId);
    // Recomputing the buyer's cost of sales here rather than threading it through is deliberate:
    // both sides then read the same function of the same drivers, and the seller's invoice cannot
    // silently stop matching the buyer's purchase. The buyer's own currency is translated at the
    // anchor rate, which is the group's transfer-pricing convention.
    const buyerCost = buyerCostOfSales(buyer, month, index, a, seed);
    const inBuyerCurrency = buyerCost * pair.shareOfBuyerCost;
    const buyerCurrency = entity(pair.buyerId).functional;
    // The month's average rate — the same rate the consolidation will use to translate the buyer's
    // side back. Anything else and the two sides differ by the currency movement.
    const rate = rates.at(buyerCurrency, month).average;
    total += inBuyerCurrency / rate;
  }
  return total;
}

/** The buyer's direct cost, computed the same way `monthPl` computes it. */
function buyerCostOfSales(
  s: EntitySpec,
  month: FiscalMonth,
  index: number,
  a: AssumptionSet,
  seed: string,
): number {
  const season = seasonalRelative(month);
  let total = 0;
  for (const seg of s.unitised) {
    const units = Math.max(
      1,
      Math.round(
        drift(seg.units, seg.unitGrowth, index) *
          season *
          a.volume *
          (1 + noise(`${seed}|${s.id}|${seg.segment}|${month}|units`) * 0.021),
      ),
    );
    const unitCost =
      drift(seg.unitCost, seg.unitCostDrift, index) *
      a.unitCost *
      (1 + noise(`${seed}|${s.id}|${seg.segment}|${month}|cost`) * 0.009);
    total += units * unitCost;
  }
  for (const seg of s.unUnitised) {
    const revenue =
      drift(seg.revenue, seg.revenueGrowth, index) *
      season *
      a.volume *
      (1 + noise(`${seed}|${s.id}|${seg.segment}|${month}|rev`) * 0.028);
    total += revenue * seg.costRate * a.unitCost;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Closing the month
// ---------------------------------------------------------------------------

interface Closed {
  readonly pl: MonthPl;
  readonly next: Carried;
  readonly cashFlow: number;
}

/**
 * Roll one month's balance sheet forward.
 *
 * The identity holds because of the last line of `cashFlow`: every balance either derives from a
 * flow already in the profit and loss, or its movement is added back here. Nothing is a plug, so
 * nothing has to be reconciled afterwards — and if a balance is ever added to `Carried` without a
 * matching term below, `identity.test.ts` fails on the first month.
 */
function closeMonth(
  s: EntitySpec,
  month: FiscalMonth,
  pl: MonthPl,
  carried: Carried,
  a: AssumptionSet,
  index: number,
  healthy: boolean,
): Closed {
  const days = daysInMonth(month);
  // PLANTED 5, and gated on `healthy` — it was not, so the twin's Gulf collections slipped the same
  // nine days and the working-capital detector had something real to find there.
  const gulfSlip = !healthy && s.id === 'gulf' ? (GULF_DSO_DRIFT[month] ?? 0) : 0;
  const dsoExtra = gulfSlip + a.dsoDays;

  const receivables = ((pl.revenue + pl.revenueIc) * (s.dso + dsoExtra)) / days;
  const receivablesIc = (pl.revenueIc * 45) / days;
  const inventory = (pl.costOfSales * s.dio) / days;
  const payables = ((pl.costOfSales + pl.subcontractCost + pl.otherOpex) * s.dpo) / days;
  const payablesIc = (pl.costIc * 45) / days;

  const capex = s.monthlyCapex * (1 + 0.0018) ** (index - ANCHOR_INDEX);
  const fixedAssets = carried.fixedAssets + capex - pl.depreciation;
  const otherAssets = carried.otherAssets * 1.0014;
  const otherLiabilities = carried.otherLiabilities * 1.0011;

  const netBorrowing = borrowingDraw(s, month, index);
  const borrowings = carried.borrowings + netBorrowing;
  const dividends = pl.netIncome > 0 ? pl.netIncome * s.dividendRate : 0;

  const cashFlow =
    pl.netIncome +
    pl.depreciation -
    (receivables - carried.receivables) -
    (receivablesIc - carried.receivablesIc) -
    (inventory - carried.inventory) +
    (payables - carried.payables) +
    (payablesIc - carried.payablesIc) -
    capex +
    netBorrowing -
    dividends +
    (otherLiabilities - carried.otherLiabilities) -
    (otherAssets - carried.otherAssets);

  return {
    pl,
    cashFlow,
    next: {
      cash: carried.cash + cashFlow,
      receivables,
      receivablesIc,
      inventory,
      payables,
      payablesIc,
      fixedAssets,
      otherAssets,
      otherLiabilities,
      borrowings,
      retainedEarnings: carried.retainedEarnings + pl.netIncome - dividends,
    },
  };
}

/** Debt is drawn to fund capital spend and repaid slowly. A driver, not a plug. */
function borrowingDraw(s: EntitySpec, month: FiscalMonth, index: number): number {
  const seasonalDraw = seasonal(month) < 0.95 ? s.monthlyCapex * 0.9 : -s.monthlyCapex * 0.35;
  return seasonalDraw;
}

/** The opening balance sheet: every balance chosen, and retained earnings the one that balances it. */
function openingCarried(
  s: EntitySpec,
  firstPl: MonthPl,
  firstMonth: FiscalMonth,
  a: AssumptionSet,
): Carried {
  const days = daysInMonth(firstMonth);
  const dsoExtra = a.dsoDays;
  const receivables = ((firstPl.revenue + firstPl.revenueIc) * (s.dso + dsoExtra)) / days;
  const receivablesIc = (firstPl.revenueIc * 45) / days;
  const inventory = (firstPl.costOfSales * s.dio) / days;
  const payables =
    ((firstPl.costOfSales + firstPl.subcontractCost + firstPl.otherOpex) * s.dpo) / days;
  const payablesIc = (firstPl.costIc * 45) / days;

  const assets =
    s.openingCash +
    receivables +
    receivablesIc +
    inventory +
    s.openingFixedAssets +
    s.openingOtherAssets;
  const liabilities = payables + payablesIc + s.openingBorrowings + s.openingOtherLiabilities;

  return {
    cash: s.openingCash,
    receivables,
    receivablesIc,
    inventory,
    payables,
    payablesIc,
    fixedAssets: s.openingFixedAssets,
    otherAssets: s.openingOtherAssets,
    otherLiabilities: s.openingOtherLiabilities,
    borrowings: s.openingBorrowings,
    // The plug, and the only one in the file: opening retained earnings is whatever makes the
    // opening balance sheet balance. Every month after this one balances because of the cash flow,
    // not because of a plug.
    retainedEarnings: assets - liabilities - s.shareCapital,
  };
}

// ---------------------------------------------------------------------------
// Emitting facts
// ---------------------------------------------------------------------------

interface EmitContext {
  readonly facts: Fact[];
  readonly entityId: string;
  readonly scenario: Scenario;
  readonly versionId: string;
  readonly vintageFor: (month: FiscalMonth) => string;
}

function emit(
  ctx: EmitContext,
  accountId: AccountCode,
  month: FiscalMonth,
  major: number,
  options: {
    costCentreId?: CostCentreCode | null;
    segmentId?: SegmentCode | null;
    quantity?: number | null;
  } = {},
): void {
  ctx.facts.push({
    entityId: ctx.entityId,
    accountId,
    month,
    scenario: ctx.scenario,
    versionId: ctx.versionId,
    costCentreId: options.costCentreId ?? null,
    segmentId: options.segmentId ?? null,
    vintageId: ctx.vintageFor(month),
    amountMinor: cents(major),
    quantity: options.quantity ?? null,
  });
}

/**
 * Emit a figure that is already in minor units.
 *
 * Used only for retained earnings, which is a residual rather than a rounded amount — running it
 * through `emit` would round an already-exact integer and reintroduce the penny it exists to remove.
 */
function emitMinor(
  ctx: EmitContext,
  accountId: AccountCode,
  month: FiscalMonth,
  amountMinor: number,
  costCentreId: CostCentreCode | null = null,
  segmentId: SegmentCode | null = null,
): void {
  ctx.facts.push({
    entityId: ctx.entityId,
    accountId,
    month,
    scenario: ctx.scenario,
    versionId: ctx.versionId,
    costCentreId,
    segmentId,
    vintageId: ctx.vintageFor(month),
    amountMinor,
    quantity: null,
  });
}

/**
 * Split an amount across cost centres so the parts sum exactly to the whole.
 *
 * In MINOR UNITS, and that is the whole point. Splitting in major units and rounding each part
 * afterwards leaves the children out by a penny against the parent — which is not a rounding
 * nuisance but a broken invariant: a drill-down that does not add up to the figure it was opened
 * from is the defect this product exists to be trusted about. So the allocation is integer
 * arithmetic, and the last centre takes the remainder.
 */
function splitByWeights<K extends string>(
  order: readonly K[],
  weights: Readonly<Partial<Record<K, number>>>,
  totalMinor: number,
): { key: K; amountMinor: number }[] {
  const entries = order.filter((code) => (weights[code] ?? 0) > 0);
  const weightTotal = entries.reduce((sum, code) => sum + (weights[code] ?? 0), 0);
  let assigned = 0;
  return entries.map((code, i) => {
    const isLast = i === entries.length - 1;
    const amountMinor = isLast
      ? totalMinor - assigned
      : Math.round((totalMinor * (weights[code] ?? 0)) / weightTotal);
    assigned += amountMinor;
    return { key: code, amountMinor };
  });
}

function splitByCostCentre(
  weights: Partial<Record<CostCentreCode, number>>,
  totalMinor: number,
): { costCentre: CostCentreCode; amountMinor: number }[] {
  return splitByWeights(
    COST_CENTRES.map((c) => c.code),
    weights,
    totalMinor,
  ).map(({ key, amountMinor }) => ({ costCentre: key, amountMinor }));
}

// ---------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------

export interface World {
  readonly seed: string;
  readonly store: FactStore;
  readonly rates: Rates;
  readonly register: VintageRegister;
  readonly mappingSets: readonly MappingSet[];
  /** Where each entity is in the close, per month. */
  readonly closePositions: readonly ClosePosition[];
  readonly months: readonly FiscalMonth[];
  readonly dataThrough: FiscalMonth;
  readonly versions: readonly VersionSpec[];
}

export interface WorldOptions {
  readonly seed: string;
  /** Omit every planted condition. The healthy twin, whose job is to prove the detectors quiet. */
  readonly healthy?: boolean;
  /**
   * An extra forecast version, generated alongside the declared ones.
   *
   * This is what makes a scenario possible, and it is why a forecast is held as assumptions applied to
   * a generator rather than as its own stored output. A scenario is not a second dataset or a
   * spreadsheet bolted to the side — it is *this* world believed differently, generated by the same
   * code that produced every other version. So its figures are comparable with the approved forecast by
   * construction, and its cash number came down the same path from its revenue number.
   *
   * The alternative — adjusting the output figures by a factor — produces a profit and loss that no
   * longer ties to a balance sheet, and a cash figure that is a guess about a guess.
   */
  readonly scenario?: {
    readonly id: string;
    readonly actualsThrough: FiscalMonth;
    readonly assumptions: AssumptionSet;
  };
}

/** Vintage ids, so the store can rank two loads covering the same month. */
function vintageId(month: FiscalMonth): string {
  return `v-${month}-core`;
}

export const RESTATEMENT_VINTAGE = 'v-2026-07-restate-2026-06';

function buildRegister(healthy: boolean): VintageRegister {
  const register = new VintageRegister();

  const sources: readonly SourceSystem[] = [
    {
      id: 'sap-uk',
      name: 'SAP S/4HANA — UK ledgers',
      mechanism: 'universal_journal_cds',
      entityIds: ['manufacturing', 'services'],
      feed: 'gl',
    },
    {
      id: 'fusion-gulf',
      name: 'Oracle Fusion — Gulf ledger',
      mechanism: 'bi_cloud_connector',
      entityIds: ['gulf'],
      feed: 'gl',
    },
    {
      id: 'd365-eu',
      name: 'Dynamics 365 F&O — Europe',
      mechanism: 'lake_link',
      entityIds: ['europe'],
      feed: 'gl',
    },
    {
      id: 'netsuite-us',
      name: 'NetSuite — US',
      mechanism: 'rest_api',
      entityIds: ['inc'],
      feed: 'gl',
    },
    {
      id: 'plan-anaplan',
      name: 'Anaplan — budget & forecast',
      mechanism: 'rest_api',
      entityIds: ['manufacturing', 'services', 'gulf', 'europe', 'inc'],
      feed: 'plan',
    },
    {
      id: 'psa',
      name: 'Field service PSA — hours & utilisation',
      mechanism: 'rest_api',
      entityIds: ['services', 'gulf', 'inc'],
      feed: 'operational',
    },
    {
      id: 'crm',
      name: 'Salesforce — weighted pipeline',
      mechanism: 'rest_api',
      entityIds: ['manufacturing', 'services', 'gulf', 'europe', 'inc'],
      feed: 'pipeline',
    },
    {
      id: 'payroll',
      name: 'Group payroll — headcount & cost',
      mechanism: 'file_contract',
      entityIds: ['manufacturing', 'services', 'gulf', 'europe', 'inc'],
      feed: 'payroll',
    },
    {
      id: 'bank',
      name: 'Bank statements — camt.053',
      mechanism: 'bank_statement_camt',
      entityIds: ['manufacturing', 'services', 'gulf', 'europe', 'inc'],
      feed: 'bank',
    },
  ];
  for (const source of sources) register.addSource(source);

  for (const month of MONTHS) {
    const isJuly = month === SEED_END;
    register.addVintage({
      id: vintageId(month),
      sourceId: 'sap-uk',
      fromMonth: month,
      toMonth: month,
      loadedAt: `${addMonths(month, 1)}-04T03:12:00Z`,
      // PLANTED 7 — July's load is the one that brought two accounts nothing could map.
      status: !healthy && isJuly ? 'accepted_with_exceptions' : 'accepted',
      rowCount: 41_800 + Math.round(noise(`rows|${month}`) * 900),
      ...(!healthy && isJuly
        ? { note: 'Two ledger accounts arrived with no mapping. See Mappings.' }
        : {}),
    });
  }

  // PLANTED 11 — the restatement. It arrives after the load it corrects, which the register
  // enforces, and it is why a published pack pins a vintage.
  if (!healthy) {
    register.addVintage({
      id: RESTATEMENT_VINTAGE,
      sourceId: 'sap-uk',
      fromMonth: RESTATEMENT_MONTH,
      toMonth: RESTATEMENT_MONTH,
      loadedAt: '2026-08-03T09:41:00Z',
      status: 'accepted',
      rowCount: 2,
      restatesVintageId: vintageId(RESTATEMENT_MONTH),
      note: `Reclassified £${(RESTATEMENT_MAJOR / 1000).toFixed(0)}k from cost of sales to operating expense at Kestrel Services.`,
    });
  }

  return register;
}

function buildMappingSets(healthy: boolean): MappingSet[] {
  return [
    {
      id: 'map-2024-01',
      version: 1,
      owner: 'Group Financial Controller',
      effectiveFrom: SEED_START,
      effectiveTo: '2026-06',
      status: 'superseded',
      mappedCodes: 1_284,
      unmapped: [],
    },
    {
      id: 'map-2026-07',
      version: 2,
      owner: 'Group Financial Controller',
      effectiveFrom: SEED_END,
      status: 'approved',
      mappedCodes: 1_291,
      unmapped: healthy
        ? []
        : UNMAPPED_JULY.map((u) => ({
            sourceCode: u.sourceCode,
            sourceLabel: u.sourceLabel,
            entityId: u.entityId,
            firstSeen: SEED_END,
            amountMinor: cents(u.major),
          })),
    },
  ];
}

/**
 * PLANTED 10 — Kestrel Inc has submitted July and not closed it.
 *
 * Every prior month is closed everywhere, so the one open position is the finding rather than the
 * normal state of things. It matters because the group revenue figure on the front page is built from
 * it: the number is not wrong, it is not final, and nothing in the figure itself says so.
 */
const OPEN_CLOSE_ENTITY = 'inc';

function buildClosePositions(healthy: boolean): ClosePosition[] {
  const positions: ClosePosition[] = [];
  for (const month of MONTHS) {
    for (const e of tradingEntities()) {
      const open = !healthy && month === SEED_END && e.id === OPEN_CLOSE_ENTITY;
      positions.push({
        entityId: e.id,
        month,
        state: open ? 'submitted' : 'closed',
        owner: open ? 'US Financial Controller' : 'Group Financial Controller',
        submittedAt: `${month}-04T09:00:00Z`,
        ...(open ? {} : { closedAt: `${month}-06T17:00:00Z` }),
        ...(open
          ? {
              note:
                'Trial balance submitted; revenue cut-off on two project milestones still under ' +
                'review, so the figures may move before close.',
            }
          : {}),
      });
    }
  }
  return positions;
}

/**
 * Generate every fact for one entity under one version's assumptions.
 *
 * `actualsThrough` is what makes a forecast version a forecast: months up to it are the actual
 * drivers, months after it are the version's assumptions applied to the same generator. So a
 * forecast is not a second dataset — it is this dataset believed differently, which is why the
 * difference between two versions can be attributed to the assumptions that differ.
 */
function generateEntity(
  ctx: EmitContext,
  s: EntitySpec,
  assumptions: AssumptionSet,
  actualsThrough: FiscalMonth,
  seed: string,
  healthy: boolean,
  rates: Rates,
): void {
  let carried: Carried | null = null;

  MONTHS.forEach((month, index) => {
    const projecting = month > actualsThrough;
    const a = projecting ? assumptions : ACTUAL_ASSUMPTIONS;
    const effective = healthy ? healthyAssumptions(a) : a;

    const pl = monthPl(s, month, index, effective, seed, carried ?? zeroCarried(s), rates, healthy);
    if (carried === null) carried = openingCarried(s, pl, month, effective);

    const closed = closeMonth(s, month, pl, carried, effective, index, healthy);

    // ---- profit and loss, by segment where the account has one
    for (const [segmentCode, row] of pl.revenueBySegment) {
      emit(ctx, 'revenue', month, row.revenue, { segmentId: segmentCode, quantity: row.units });
    }
    for (const [segmentCode, row] of pl.costBySegment) {
      emit(ctx, 'cost_of_sales', month, row.cost, { segmentId: segmentCode, quantity: row.units });
    }
    if (pl.revenueIc !== 0) emit(ctx, 'revenue_ic', month, pl.revenueIc);
    if (pl.costIc !== 0) emit(ctx, 'cost_of_sales_ic', month, pl.costIc);
    if (pl.subcontractCost !== 0) {
      // By segment first, then the aggregate. The aggregate is a different row from its children — the
      // null-dimension rule — so a query that omits the segment gets the total and one that names a
      // segment gets that segment, and neither silently returns the other.
      for (const part of splitByWeights(
        SEGMENTS.map((seg) => seg.code),
        s.subcontractSegments ?? {},
        cents(pl.subcontractCost),
      )) {
        emitMinor(ctx, 'subcontract_cost', month, part.amountMinor, null, part.key);
      }
      emit(ctx, 'subcontract_cost', month, pl.subcontractCost, {
        quantity: Math.round(pl.subcontractHours),
      });
    }

    for (const part of splitByCostCentre(s.costCentreWeights, cents(pl.staffCost))) {
      emitMinor(ctx, 'staff_cost', month, part.amountMinor, part.costCentre);
    }
    emit(ctx, 'staff_cost', month, pl.staffCost);

    for (const part of splitByCostCentre(s.costCentreWeights, cents(pl.otherOpex))) {
      emitMinor(ctx, 'other_opex', month, part.amountMinor, part.costCentre);
    }
    emit(ctx, 'other_opex', month, pl.otherOpex);

    if (pl.unmappedOpex !== 0) {
      for (const u of UNMAPPED_JULY.filter((x) => x.entityId === s.id)) {
        emit(ctx, 'unmapped_opex', month, u.major, { costCentreId: u.costCentre });
      }
      emit(ctx, 'unmapped_opex', month, pl.unmappedOpex);
    }

    emit(ctx, 'depreciation', month, pl.depreciation);
    emit(ctx, 'interest_expense', month, pl.interest);
    emit(ctx, 'tax_expense', month, pl.tax);

    // ---- balance sheet
    //
    // Rounded to minor units FIRST, then retained earnings is set to the residual. Every balance
    // rounds independently, and eleven independent roundings leave the identity out by a few pence
    // — which is exactly the kind of tiny wrongness that costs an afternoon and all of a reader's
    // confidence. The pence go to retained earnings, which is where a real ledger puts them too,
    // and the rolled-forward figure and the residual differ by less than a penny per month.
    const next = closed.next;
    const assetCents =
      cents(next.cash) +
      cents(next.receivables) +
      cents(next.receivablesIc) +
      cents(next.inventory) +
      cents(next.fixedAssets) +
      cents(next.otherAssets);
    const liabilityCents =
      cents(next.payables) +
      cents(next.payablesIc) +
      cents(next.borrowings) +
      cents(next.otherLiabilities);
    const retainedCents = assetCents - liabilityCents - cents(s.shareCapital);

    emit(ctx, 'cash', month, next.cash);
    emit(ctx, 'receivables', month, next.receivables);
    if (next.receivablesIc !== 0) emit(ctx, 'receivables_ic', month, next.receivablesIc);
    emit(ctx, 'inventory', month, next.inventory);
    emit(ctx, 'fixed_assets', month, next.fixedAssets);
    emit(ctx, 'other_assets', month, next.otherAssets);
    emit(ctx, 'payables', month, next.payables);
    if (next.payablesIc !== 0) emit(ctx, 'payables_ic', month, next.payablesIc);
    emit(ctx, 'borrowings', month, next.borrowings);
    emit(ctx, 'other_liabilities', month, next.otherLiabilities);
    emit(ctx, 'share_capital', month, s.shareCapital);
    emitMinor(ctx, 'retained_earnings', month, retainedCents);
    // Zero in functional currency by definition: an entity has no translation difference against
    // its own books. The consolidation computes the group's.
    emit(ctx, 'translation_reserve', month, 0);

    // ---- denominators, as their own accounts
    emit(ctx, 'avg_receivables', month, (carried.receivables + next.receivables) / 2);
    emit(ctx, 'avg_payables', month, (carried.payables + next.payables) / 2);
    emit(ctx, 'avg_inventory', month, (carried.inventory + next.inventory) / 2);
    emit(
      ctx,
      'avg_capital_employed',
      month,
      (carried.borrowings +
        carried.retainedEarnings +
        s.shareCapital +
        next.borrowings +
        next.retainedEarnings +
        s.shareCapital) /
        2,
    );

    // ---- operational drivers and cash flow
    emit(ctx, 'headcount', month, pl.headcount, { quantity: pl.headcount });
    if (pl.chargeableHours !== 0)
      emit(ctx, 'chargeable_hours', month, pl.chargeableHours, {
        quantity: Math.round(pl.chargeableHours),
      });
    if (pl.availableHours !== 0)
      emit(ctx, 'available_hours', month, pl.availableHours, {
        quantity: Math.round(pl.availableHours),
      });
    if (pl.subcontractHours !== 0)
      emit(ctx, 'subcontract_hours', month, pl.subcontractHours, {
        quantity: Math.round(pl.subcontractHours),
      });
    if (s.pipelineWeighted !== undefined) {
      const weighted =
        drift(s.pipelineWeighted, 0.0042, index) *
        (1 + noise(`${seed}|${s.id}|${month}|pipe`) * 0.03);
      emit(ctx, 'pipeline_weighted', month, weighted);
      // PLANTED 12 — the conversion the CRM is achieving against the one the forecast assumes. It was
      // declared in the assumption set and never used in the arithmetic, so the condition existed in a
      // pair of constants and in no fact: the detector for it could not fire, and the Opportunities board
      // that condition 12 was added to fill would still have been empty. The assumption reaches the data
      // here, which is what makes the opportunity drillable to a row rather than asserted in prose.
      emit(
        ctx,
        'pipeline_converted',
        month,
        weighted *
          effective.pipelineConversion *
          (1 + noise(`${seed}|${s.id}|${month}|conv`) * 0.012),
      );
    }
    emit(ctx, 'capex', month, s.monthlyCapex * (1 + 0.0018) ** (index - ANCHOR_INDEX));
    emit(ctx, 'dividends', month, pl.netIncome > 0 ? pl.netIncome * s.dividendRate : 0);
    emit(ctx, 'net_borrowing', month, borrowingDraw(s, month, index));

    carried = next;
  });
}

/**
 * The healthy twin's assumptions: **every lever set to what arrived.**
 *
 * So the twin's forecasts are exactly right, and every finding that is a forecast variance — revenue
 * ahead of plan, a segment margin behind it, a habitual bias, a driver running above assumption —
 * has nothing to fire on. That is the point. A twin whose forecasts are merely *different* proves
 * nothing about a detector, because a detector that fires there might be right.
 *
 * Two attempts got here. The first reset the subcontract rate alone and left the hours, and the cost
 * is hours × rate, so the planted bias survived at full strength. The second reset both and left
 * volume, price and unit cost, so revenue and every margin still carried a variance. A half-removed
 * condition is worse than none: it makes a false positive look like a proven detector.
 */
function healthyAssumptions(a: AssumptionSet): AssumptionSet {
  return {
    ...a,
    volume: 1,
    price: 1,
    unitCost: 1,
    serviceDeliveryCost: 1,
    subcontractRate: 1,
    subcontractHours: 1,
    dsoDays: 0,
    pipelineConversion: PIPELINE_CONVERSION_ASSUMED,
  };
}

function zeroCarried(s: EntitySpec): Carried {
  return {
    cash: s.openingCash,
    receivables: 0,
    receivablesIc: 0,
    inventory: 0,
    payables: 0,
    payablesIc: 0,
    fixedAssets: s.openingFixedAssets,
    otherAssets: s.openingOtherAssets,
    otherLiabilities: s.openingOtherLiabilities,
    borrowings: s.openingBorrowings,
    retainedEarnings: 0,
  };
}

/**
 * The restatement, emitted as a second pair of facts in a later vintage.
 *
 * Two rows, not a mutation: June's cost of sales and other operating expense at Kestrel Services
 * are re-stated, and the store's "latest vintage per cell wins" rule means a query reads the
 * corrected figures while `asOfVintage` can still read what was there before. Gross margin for
 * June therefore differs between two vintages, and net income does not — which is exactly what a
 * reclassification is, and is why it is the right restatement to plant.
 */
function emitRestatement(store: FactStore, world: Omit<World, 'store'>, healthy: boolean): void {
  if (healthy) return;
  const original = {
    cost: store.query({
      entityId: RESTATEMENT_ENTITY,
      accountId: 'cost_of_sales',
      scope: {
        type: 'MONTH',
        startMonth: RESTATEMENT_MONTH,
        endMonth: RESTATEMENT_MONTH,
        label: RESTATEMENT_MONTH,
      },
      scenario: 'ACTUAL',
      versionId: ACTUAL_VERSION,
      segmentId: undefined,
      costCentreId: null,
    }),
    opex: store.query({
      entityId: RESTATEMENT_ENTITY,
      accountId: 'other_opex',
      scope: {
        type: 'MONTH',
        startMonth: RESTATEMENT_MONTH,
        endMonth: RESTATEMENT_MONTH,
        label: RESTATEMENT_MONTH,
      },
      scenario: 'ACTUAL',
      versionId: ACTUAL_VERSION,
      costCentreId: null,
    }),
  };

  // The reclassification moves the whole amount out of the largest segment, because a
  // reclassification is a decision about specific postings rather than a pro-rata adjustment.
  const largest = [...original.cost.rows]
    .filter((r) => r.segmentId !== null)
    .sort((a, b) => b.amountMinor - a.amountMinor)[0];
  if (largest === undefined || original.opex.value === null) return;

  store.add({
    ...largest,
    vintageId: RESTATEMENT_VINTAGE,
    amountMinor: largest.amountMinor - cents(RESTATEMENT_MAJOR),
  });
  store.add({
    entityId: RESTATEMENT_ENTITY,
    accountId: 'other_opex',
    month: RESTATEMENT_MONTH,
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
    costCentreId: null,
    segmentId: null,
    vintageId: RESTATEMENT_VINTAGE,
    amountMinor: original.opex.value + cents(RESTATEMENT_MAJOR),
    quantity: null,
  });
}

/**
 * Build the world.
 *
 * A pure function of its options. Called twice per process at most — once for the demo's own group
 * and once for the healthy twin — and memoised by the caller, because the same seed always produces
 * the same world and there is nothing to invalidate.
 */
export function buildWorld(options: WorldOptions): World {
  const { seed, healthy = false, scenario } = options;
  // Rates first: the intercompany transfer is denominated in the seller's currency and recorded by
  // the buyer at the month's rate, so the generator needs the table before it can emit a fact.
  const rates = new Rates(buildRates(seed, healthy));
  const register = buildRegister(healthy);
  const store = new FactStore({
    rank: (id) => {
      // Load time, not id: a restatement named for the month it corrects would otherwise sort
      // before the load it replaces.
      try {
        return Date.parse(register.vintage(id).loadedAt);
      } catch {
        return 0;
      }
    },
  });

  const vintageFor = (month: FiscalMonth): string => vintageId(month);
  const facts: Fact[] = [];

  for (const e of tradingEntities()) {
    const s = spec(e.id);
    generateEntity(
      { facts, entityId: e.id, scenario: 'ACTUAL', versionId: ACTUAL_VERSION, vintageFor },
      s,
      ACTUAL_ASSUMPTIONS,
      SEED_END,
      seed,
      healthy,
      rates,
    );
    for (const version of VERSIONS) {
      generateEntity(
        { facts, entityId: e.id, scenario: version.scenario, versionId: version.id, vintageFor },
        s,
        version.assumptions,
        version.actualsThrough,
        seed,
        healthy,
        rates,
      );
    }
    if (scenario !== undefined) {
      generateEntity(
        { facts, entityId: e.id, scenario: 'FORECAST', versionId: scenario.id, vintageFor },
        s,
        scenario.assumptions,
        scenario.actualsThrough,
        seed,
        healthy,
        rates,
      );
    }
  }

  store.addAll(facts);

  const mappingSets = buildMappingSets(healthy);
  const world: Omit<World, 'store'> = {
    seed,
    rates,
    register,
    mappingSets,
    closePositions: buildClosePositions(healthy),
    months: MONTHS,
    dataThrough: SEED_END,
    versions: VERSIONS,
  };

  emitRestatement(store, world, healthy);

  return { ...world, store };
}

// ---------------------------------------------------------------------------
// The two fixtures
// ---------------------------------------------------------------------------

export const HEALTHY_SEED = 'kestrel-industrial-group-healthy';

/**
 * The healthy twin.
 *
 * A second seed, the same group, and none of the planted conditions present. Its job is the one the
 * demo's own world cannot do: prove the detectors stay QUIET. A false positive in front of a chief
 * financial officer discredits every other number on the screen, so a detector proven only to fire
 * is half-proven. It is a first-class artefact rather than a test helper — the tests assert against
 * it and the Controls surface can render it beside the real world when the product explains itself.
 */
export function buildHealthyWorld(): World {
  return buildWorld({ seed: HEALTHY_SEED, healthy: true });
}
