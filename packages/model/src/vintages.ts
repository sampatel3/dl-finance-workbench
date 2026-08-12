/**
 * Loads, and the vintages they arrive in.
 *
 * One rule governs this file and it is the reason "as at" reporting is possible at all:
 * **nothing is ever updated in place.** A correction is a new load, with a new vintage id, whose
 * record names the vintage it restates. The old rows stay exactly where they were, so a figure
 * approved last month can still be recomputed as it stood when it was approved — which is what a
 * published board pack pins, and what an auditor asks for.
 *
 * The alternative — updating a row and keeping an audit column — cannot answer the question. It can
 * say what changed; it cannot reproduce the number somebody signed.
 *
 * The demo's loads are modelled rather than real: no connector runs, and the Controls surface says
 * so. What is not modelled is the *shape* — a load has a source system, a window, a row count, a
 * control total to compare against, a validation outcome, and a status a human can read, because
 * the first question after a wrong number is always "when did this last load?"
 */

import type { FiscalMonth } from './period.ts';

export type LoadStatus =
  /** Landed and validated; the governed layer may read it. */
  | 'accepted'
  /** Landed, validated, and something failed — visible, and it blocks or flags downstream use. */
  | 'accepted_with_exceptions'
  /** Landed and rejected outright. Nothing above the staging layer sees it. */
  | 'rejected';

/**
 * How the data got here.
 *
 * The mechanism is recorded per source because it is the thing that differs most between
 * platforms and the thing a pilot conversation turns on. It is prose in the demo and a connector
 * in the product; naming it here keeps the Controls surface honest about which is which.
 */
export type IngestionMechanism =
  | 'universal_journal_cds'
  | 'bi_cloud_connector'
  | 'lake_link'
  | 'rest_api'
  | 'file_contract'
  | 'bank_statement_camt';

export interface SourceSystem {
  readonly id: string;
  readonly name: string;
  readonly mechanism: IngestionMechanism;
  /** Entities this source supplies. */
  readonly entityIds: readonly string[];
  /** What it carries: the GL, a budget, an operational driver, cash. */
  readonly feed: 'gl' | 'plan' | 'operational' | 'payroll' | 'pipeline' | 'bank';
}

export interface Vintage {
  readonly id: string;
  readonly sourceId: string;
  /** The window of fiscal months this load covers. */
  readonly fromMonth: FiscalMonth;
  readonly toMonth: FiscalMonth;
  /** When the load landed. A stated timestamp, never a reading of the clock. */
  readonly loadedAt: string;
  readonly status: LoadStatus;
  readonly rowCount: number;
  /**
   * Set when this load restates an earlier one. The presence of this field is what makes a
   * figure's history readable: two vintages covering the same month, the later naming the earlier.
   */
  readonly restatesVintageId?: string;
  /** One line a human can read on the Controls surface. */
  readonly note?: string;
}

export class VintageRegister {
  readonly #sources = new Map<string, SourceSystem>();
  readonly #vintages = new Map<string, Vintage>();

  addSource(source: SourceSystem): void {
    this.#sources.set(source.id, source);
  }

  addVintage(vintage: Vintage): void {
    if (!this.#sources.has(vintage.sourceId)) {
      throw new Error(`Vintage ${vintage.id} names an unknown source ${vintage.sourceId}`);
    }
    if (vintage.restatesVintageId !== undefined && !this.#vintages.has(vintage.restatesVintageId)) {
      throw new Error(
        `Vintage ${vintage.id} restates ${vintage.restatesVintageId}, which has not been registered — ` +
          'a restatement must arrive after the load it corrects',
      );
    }
    this.#vintages.set(vintage.id, vintage);
  }

  source(id: string): SourceSystem {
    const found = this.#sources.get(id);
    if (!found) throw new Error(`Unknown source: ${id}`);
    return found;
  }

  vintage(id: string): Vintage {
    const found = this.#vintages.get(id);
    if (!found) throw new Error(`Unknown vintage: ${id}`);
    return found;
  }

  sources(): SourceSystem[] {
    return [...this.#sources.values()];
  }

  vintages(): Vintage[] {
    return [...this.#vintages.values()].sort((a, b) => a.loadedAt.localeCompare(b.loadedAt));
  }

  /** Loads that restate an earlier one — the Controls surface's restatement list. */
  restatements(): Vintage[] {
    return this.vintages().filter((v) => v.restatesVintageId !== undefined);
  }

  /** Loads whose validation found something. Not an error list: an exceptions list. */
  withExceptions(): Vintage[] {
    return this.vintages().filter((v) => v.status !== 'accepted');
  }

  /**
   * The vintage a month's figures should be read from: the latest accepted load covering it.
   *
   * "Latest" is by load time rather than by id, because ids sort lexically and a restatement
   * loaded in July but named for June would otherwise lose to the load it corrects.
   */
  currentFor(month: FiscalMonth): Vintage | undefined {
    return this.vintages()
      .filter((v) => v.status !== 'rejected' && v.fromMonth <= month && month <= v.toMonth)
      .at(-1);
  }
}

// ---------------------------------------------------------------------------
// Mapping sets
// ---------------------------------------------------------------------------

/**
 * A mapping set: source codes in, canonical codes out, effective-dated and owned.
 *
 * The interesting field is `unmapped`. A mapping set that only records what it resolved is a
 * mapping set that loses money silently — a new ledger account appears, nothing matches it, and its
 * balance simply leaves the profit and loss. So what it *failed* to place is a first-class output
 * with a value attached, and it appears on the Controls surface as a reconciling line between the
 * mapped P&L and the trial balance rather than as a warning nobody clicks.
 */
export interface UnmappedAccount {
  readonly sourceCode: string;
  readonly sourceLabel: string;
  readonly entityId: string;
  /** First month the code appeared. */
  readonly firstSeen: FiscalMonth;
  /** What is at stake, in the entity's functional currency, minor units. */
  readonly amountMinor: number;
}

export interface MappingSet {
  readonly id: string;
  readonly version: number;
  readonly owner: string;
  readonly effectiveFrom: FiscalMonth;
  readonly effectiveTo?: FiscalMonth;
  readonly status: 'draft' | 'approved' | 'superseded';
  /** How many source codes it resolves. */
  readonly mappedCodes: number;
  readonly unmapped: readonly UnmappedAccount[];
}

/** The mapping set in force for a month. */
export function mappingSetFor(
  sets: readonly MappingSet[],
  month: FiscalMonth,
): MappingSet | undefined {
  return sets
    .filter((s) => s.status !== 'draft')
    .filter(
      (s) => s.effectiveFrom <= month && (s.effectiveTo === undefined || month <= s.effectiveTo),
    )
    .sort((a, b) => b.version - a.version)[0];
}

/**
 * Where each entity is in the close.
 *
 * The reason this is a first-class object rather than a boolean on the group figure: a consolidated
 * number built from four closed ledgers and one that has only *submitted* is not wrong, but it is not
 * final either, and the difference is invisible in the figure. Every group total in this product can
 * therefore say how much of itself is closed — which is the honest version of the number a controller
 * would otherwise annotate by hand in an email.
 *
 * `submitted` and `closed` are separate states because they are separate acts. A subsidiary submits a
 * trial balance; the group closes the period. Between the two sit the adjustments that are exactly what
 * a reviewer wants to know are still possible.
 */
export type CloseState =
  /** Nothing has arrived. */
  | 'not_submitted'
  /** A trial balance has landed and is being reviewed. Figures may still move. */
  | 'submitted'
  /** Reviewed, adjusted and locked. Figures will not move except by restatement. */
  | 'closed';

export interface ClosePosition {
  readonly entityId: string;
  readonly month: FiscalMonth;
  readonly state: CloseState;
  /** Who the group is waiting on, where it is waiting. Named, because "pending" is not an owner. */
  readonly owner: string;
  /** Stated, never read from a clock. */
  readonly submittedAt?: string;
  readonly closedAt?: string;
  /** Why it is not closed, in words a reviewer can act on. */
  readonly note?: string;
}

/** The close positions for a month, in entity order. */
export function closePositionsFor(
  positions: readonly ClosePosition[],
  month: FiscalMonth,
): ClosePosition[] {
  return positions.filter((p) => p.month === month);
}

/**
 * What share of a month is closed, by entity count.
 *
 * By count rather than by value, deliberately. A weighting by revenue would let the group report 97%
 * closed while the entity holding the exposure is the open one, and "97% closed" is precisely the kind
 * of figure that stops a question being asked.
 */
export function closeCompleteness(
  positions: readonly ClosePosition[],
  month: FiscalMonth,
): { readonly closed: number; readonly total: number; readonly open: readonly ClosePosition[] } {
  const forMonth = closePositionsFor(positions, month);
  const open = forMonth.filter((p) => p.state !== 'closed');
  return { closed: forMonth.length - open.length, total: forMonth.length, open };
}
