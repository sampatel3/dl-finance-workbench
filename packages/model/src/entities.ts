/**
 * The entity dimension.
 *
 * An entity is the only dimension that carries its own currency, its own ownership and its own
 * consolidation method, which is why it gets a file and the others are lists in `taxonomy.ts`.
 * It is also the dimension row-level access resolves on: a business-unit controller is granted a
 * subtree, and every measure, every drill and every tool the chat calls is filtered by it.
 *
 * The hierarchy is deliberately the LEGAL one — group, then legal entity — with the division held
 * as a property rather than as a level. Most groups have two trees that do not agree: the legal
 * one that the statutory accounts consolidate along, and the management one that the CFO thinks
 * in. Making the legal tree the parent structure and the management view a re-grouping is the only
 * arrangement in which a management P&L and a statutory one can be reconciled to each other, which
 * is a thing a controller will ask for on the first day.
 */

export type Currency = 'GBP' | 'AED' | 'EUR' | 'USD';

/**
 * How an entity enters the consolidation.
 *
 * `full` consolidates every line and recognises a non-controlling interest where ownership is
 * below 100%. `equity` brings in only a share of profit. Every Kestrel entity is `full`; the
 * `equity` case exists so that the day a pilot has an associate, the model already knows the word.
 */
export type ConsolidationMethod = 'full' | 'equity';

export interface Entity {
  readonly id: string;
  readonly name: string;
  /** Null for the group itself, which is the root. */
  readonly parentId: string | null;
  readonly country: string;
  /** The currency this entity's books are kept in. */
  readonly functional: Currency;
  readonly division: 'products' | 'services' | null;
  /** Share of equity the group holds, as a rate. 1 means wholly owned. */
  readonly ownership: number;
  readonly method: ConsolidationMethod;
  /** False for the group node, which holds no facts of its own. */
  readonly trading: boolean;
}

/** The group's presentation currency: what every consolidated figure is reported in. */
export const PRESENTATION: Currency = 'GBP';

export const GROUP_ID = 'group';

export const ENTITIES: readonly Entity[] = [
  {
    id: GROUP_ID,
    name: 'Kestrel Industrial Group plc',
    parentId: null,
    country: 'United Kingdom',
    functional: 'GBP',
    division: null,
    ownership: 1,
    method: 'full',
    trading: false,
  },
  {
    id: 'manufacturing',
    name: 'Kestrel Manufacturing Ltd',
    parentId: GROUP_ID,
    country: 'United Kingdom',
    functional: 'GBP',
    division: 'products',
    ownership: 1,
    method: 'full',
    trading: true,
  },
  {
    id: 'services',
    name: 'Kestrel Services Ltd',
    parentId: GROUP_ID,
    country: 'United Kingdom',
    functional: 'GBP',
    division: 'services',
    ownership: 1,
    method: 'full',
    trading: true,
  },
  {
    // The entity the demo's working-capital and margin stories happen in, and the one a
    // business-unit controller is granted in the permissions walk-through.
    id: 'gulf',
    name: 'Kestrel Gulf Technical Services FZ-LLC',
    parentId: GROUP_ID,
    country: 'United Arab Emirates',
    functional: 'AED',
    division: 'services',
    ownership: 1,
    method: 'full',
    trading: true,
  },
  {
    id: 'europe',
    name: 'Kestrel Europe GmbH',
    parentId: GROUP_ID,
    country: 'Germany',
    functional: 'EUR',
    division: 'products',
    // Not wholly owned, so the consolidation has a non-controlling interest to carry and the
    // group's retained earnings are not simply the sum of its entities'.
    ownership: 0.85,
    method: 'full',
    trading: true,
  },
  {
    id: 'inc',
    name: 'Kestrel Inc',
    parentId: GROUP_ID,
    country: 'United States',
    functional: 'USD',
    division: 'services',
    ownership: 1,
    method: 'full',
    trading: true,
  },
];

const BY_ID = new Map(ENTITIES.map((e) => [e.id, e]));

export function entity(id: string): Entity {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown entity: ${id}`);
  return found;
}

/** Every entity that holds facts of its own. The group node does not. */
export function tradingEntities(): Entity[] {
  return ENTITIES.filter((e) => e.trading);
}

export function entityIds(): string[] {
  return tradingEntities().map((e) => e.id);
}

/**
 * The entity and everything beneath it.
 *
 * This is the row-level access primitive: a grant names one entity, and the subtree is what the
 * holder may see. Asking for the group returns every trading entity, which is what makes the
 * group CFO's grant the same kind of object as a business-unit controller's rather than a special
 * case that skips the check.
 */
export function subtree(id: string): string[] {
  const root = entity(id);
  if (!root.trading) {
    return ENTITIES.filter((e) => e.trading && isUnder(e, id)).map((e) => e.id);
  }
  return [id];
}

function isUnder(candidate: Entity, ancestorId: string): boolean {
  let cursor: Entity | undefined = candidate;
  while (cursor !== undefined) {
    if (cursor.id === ancestorId) return true;
    cursor = cursor.parentId === null ? undefined : BY_ID.get(cursor.parentId);
  }
  return false;
}

/** Entities in a division — the management view, re-grouped off the legal tree. */
export function entitiesInDivision(division: 'products' | 'services'): string[] {
  return ENTITIES.filter((e) => e.trading && e.division === division).map((e) => e.id);
}

/**
 * Entities whose functional currency is not the presentation currency.
 *
 * Exported because two tests want it and both are about the same thing: translation has to move
 * these and must not move the others. A currency model that quietly returns the same figure for
 * every entity passes every test that does not know which entities are foreign.
 */
export function foreignEntities(): string[] {
  return tradingEntities()
    .filter((e) => e.functional !== PRESENTATION)
    .map((e) => e.id);
}

// ---------------------------------------------------------------------------
// Intercompany
// ---------------------------------------------------------------------------

/**
 * The trading pairs inside the group, and the direction of each.
 *
 * Manufacturing builds and the two service entities install, so the internal flow is real rather
 * than decorative — and it means the group's revenue is meaningfully smaller than the sum of its
 * entities' revenue, which is the first thing a reader notices and the first thing they ask about.
 */
export interface IntercompanyPair {
  readonly sellerId: string;
  readonly buyerId: string;
  /** Share of the buyer's cost of sales bought internally. */
  readonly shareOfBuyerCost: number;
}

export const INTERCOMPANY: readonly IntercompanyPair[] = [
  { sellerId: 'manufacturing', buyerId: 'services', shareOfBuyerCost: 0.34 },
  { sellerId: 'manufacturing', buyerId: 'gulf', shareOfBuyerCost: 0.28 },
  { sellerId: 'manufacturing', buyerId: 'inc', shareOfBuyerCost: 0.22 },
];
