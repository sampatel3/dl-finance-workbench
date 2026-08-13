/**
 * The deterministic projection behind the Commentary surface.
 *
 * Approval records live in `@kestrel/model`; this file adds only what the page needs to render
 * them safely: permission filtering, role-aware affordances, and an evidence chain computed from
 * the same measure and bridge layers as the rest of the product. Nothing here mutates an approval
 * record. The demo is deliberately a view of a governed workflow, not a pretend workflow engine.
 */

import type {
  AccountCode,
  CommentaryAction,
  CommentaryItem,
  CommentaryState,
  Fact,
  PeriodScope,
  PublishedCommentarySnapshot,
  World,
} from '@kestrel/model';
import {
  account,
  carryForwardCommentary,
  entity,
  seedSelectedCommentaryDraft,
  segment,
} from '@kestrel/model';
import type { BridgeBar, DriverDefinition } from '@kestrel/analysis';
import { attributeBar, buildBridge } from '@kestrel/analysis';
import type {
  ComparatorChoice,
  MeasureContext,
  MeasureInput,
  MeasureWithComparison,
  Unit,
} from '@kestrel/measures';
import {
  compareMeasure,
  computeMeasure,
  contextAtScope,
  formatValue,
  resolveComparator,
} from '@kestrel/measures';

import type { Principal } from './permissions';
import { resolveDimensionScope, resolvePermissionScope } from './permissions';
import type { View } from './world';
import { contextOf, scopeLabel } from './world';

/** The full reporting identity a card prints; never reduce a multi-month record to its last month. */
export function commentaryPeriodLabel(period: PeriodScope): string {
  switch (period.type) {
    case 'MONTH':
      return scopeLabel('month', period);
    case 'QUARTER':
      return scopeLabel('quarter', period);
    case 'HALF_YEAR':
      return scopeLabel('half_year', period);
    case 'FISCAL_YEAR':
      return scopeLabel('year', period);
    case 'YTD':
      return scopeLabel('ytd', period);
    case 'TTM':
      return period.label;
  }
}

/**
 * Build the unapproved draft driven by the shared period and comparator selectors.
 *
 * It is separate from the seeded approval queue because a new reporting identity cannot inherit an
 * old approval. Every selector click therefore changes both the visible identity and the evidence,
 * while the workflow examples below it remain immutable historical records.
 */
export function selectedCommentaryForView(
  model: World,
  view: View,
  options: { readonly measureId?: string; readonly segmentId?: CommentaryItem['anchor']['segmentId'] } = {},
): CommentaryItem {
  return commentarySelectionForView(model, view, options).item;
}

export interface CommentarySelection {
  readonly item: CommentaryItem;
  /** A conflicting deep-link slice is clamped to the mandatory grant and named to the reader. */
  readonly refusal?: string;
}

export function commentarySelectionForView(
  model: World,
  view: View,
  options: { readonly measureId?: string; readonly segmentId?: CommentaryItem['anchor']['segmentId'] } = {},
): CommentarySelection {
  const dimensions = resolveDimensionScope(view.permission, {
    ...(options.segmentId === undefined ? {} : { segmentId: options.segmentId }),
  });
  const filters = dimensions.allowed ? dimensions.filters : view.permission.dimensionFilters;
  const versionId =
    view.comparator.id === 'budget'
      ? (view.comparator.versionId ?? 'budget-fy26')
      : view.comparator.id === 'forecast'
        ? (view.comparator.versionId ?? view.version.id)
        : view.version.id;
  const item = seedSelectedCommentaryDraft(model, {
    period: view.scope,
    comparatorId: view.comparator.id,
    versionId,
    entityId: view.entityId,
    ...(options.measureId === undefined ? {} : { measureId: options.measureId }),
    ...(filters.segmentId === undefined
      ? {}
      : { segmentId: filters.segmentId }),
  });
  return {
    item,
    ...(dimensions.allowed ? {} : { refusal: dimensions.refusal }),
  };
}

export const COMMENTARY_STATES: readonly CommentaryState[] = [
  'draft',
  'in_review',
  'approved',
  'published',
  'rejected',
];

export const COMMENTARY_STATE_LABELS: Readonly<Record<CommentaryState, string>> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  published: 'Published',
  rejected: 'Rejected',
};

export interface CommentaryAffordance {
  readonly action: CommentaryAction;
  readonly label: string;
}

/** Actions this principal could take in the real workflow. The demo renders but never persists them. */
export function commentaryAffordances(
  item: CommentaryItem,
  principal: Principal,
): readonly CommentaryAffordance[] {
  switch (item.state) {
    case 'draft':
      return principal.role === 'analyst' ? [{ action: 'submit', label: 'Submit for review' }] : [];
    case 'in_review':
      return principal.role === 'controller'
        ? [
            { action: 'approve', label: 'Approve' },
            { action: 'reject', label: 'Reject with reason' },
          ]
        : [];
    case 'approved':
      return principal.grant.canPublish ? [{ action: 'publish', label: 'Publish' }] : [];
    case 'rejected':
      return principal.role === 'analyst' ? [{ action: 'revise', label: 'Revise draft' }] : [];
    case 'published':
      return [];
  }
}

/**
 * A commentary anchor is another row-level read. Group commentary is not a summary a narrower
 * principal may see: it was authored from entities outside their subtree, so it is refused whole.
 */
export function canReadCommentary(item: CommentaryItem, view: View): boolean {
  const permission = resolvePermissionScope(view.principal, item.anchor.entityId);
  if (!permission.allowed || item.anchor.entityId !== view.entityId) return false;
  const dimensions = resolveDimensionScope(permission.scope, {
    ...(item.anchor.segmentId === undefined ? {} : { segmentId: item.anchor.segmentId }),
  });
  if (!dimensions.allowed) return false;
  const requiredSegment = permission.scope.dimensionFilters.segmentId;
  return requiredSegment === undefined || item.anchor.segmentId === requiredSegment;
}

export function commentaryForView(
  items: readonly CommentaryItem[],
  view: View,
  state?: CommentaryState,
): CommentaryItem[] {
  return items
    .filter((item) => canReadCommentary(item, view))
    .filter((item) => state === undefined || item.state === state);
}

export function commentaryState(raw: string | string[] | undefined): CommentaryState | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return COMMENTARY_STATES.includes(value as CommentaryState)
    ? (value as CommentaryState)
    : undefined;
}

/** A filter link that cannot drop the figure identity carried by the shared URL. */
export function commentaryFilterHref(
  params: Readonly<Record<string, string | string[] | undefined>>,
  state?: CommentaryState,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'state') continue;
    const one = Array.isArray(value) ? value[0] : value;
    if (one !== undefined) next.set(key, one);
  }
  if (state !== undefined) next.set('state', state);
  const query = next.toString();
  return query === '' ? '/app/commentary' : `/app/commentary?${query}`;
}

export interface CommentaryFactor {
  readonly label: string;
  readonly value: number;
}

export interface CommentaryDriver {
  readonly label: string;
  readonly value: number | null;
  readonly unit: Unit;
  readonly owner: string;
  readonly note?: string;
  readonly accounts: readonly AccountCode[];
  readonly factors: readonly CommentaryFactor[];
}

export interface CommentarySourceRow {
  readonly entityId: string;
  readonly entityLabel: string;
  readonly currency: 'GBP' | 'AED' | 'EUR' | 'USD';
  readonly accountId: AccountCode;
  readonly accountLabel: string;
  readonly month: string;
  readonly segmentLabel?: string;
  readonly costCentreId?: string;
  readonly amountMinor: number;
  readonly quantity: number | null;
  readonly vintageId: string;
}

export interface CommentaryEvidence {
  readonly comparison: MeasureWithComparison;
  /** The amount the detailed driver lines reconcile to. */
  readonly movement: number | null;
  readonly movementUnit: Unit;
  readonly drivers: readonly CommentaryDriver[];
  readonly driverTotal: number | null;
  readonly driversSum: boolean;
  readonly inputs: readonly MeasureInput[];
  readonly sourceRows: readonly CommentarySourceRow[];
  readonly dataVintageId: string;
  readonly pinned: boolean;
}

const SEGMENTED_ACCOUNTS = new Set<AccountCode>(['revenue', 'cost_of_sales']);

function sourceRows(
  model: World,
  ctx: MeasureContext,
  inputs: readonly MeasureInput[],
): CommentarySourceRow[] {
  const rows: (CommentarySourceRow & { readonly sortKey: string })[] = [];
  const seen = new Set<string>();

  for (const input of inputs) {
    for (const entityId of ctx.entityIds) {
      const result = model.store.query({
        entityId,
        accountId: input.accountId,
        scope: ctx.scope,
        scenario: ctx.scenario,
        versionId: ctx.versionId,
        costCentreId: null,
        ...(ctx.segmentId !== undefined
          ? { segmentId: ctx.segmentId }
          : SEGMENTED_ACCOUNTS.has(input.accountId)
            ? {}
            : { segmentId: null }),
        ...(ctx.asOfVintage === undefined ? {} : { asOfVintage: ctx.asOfVintage }),
      });
      for (const row of result.rows) {
        const key = factKey(row);
        if (seen.has(key)) continue;
        seen.add(key);
        const rowEntity = entity(row.entityId);
        rows.push({
          entityId: row.entityId,
          entityLabel: rowEntity.name,
          currency: rowEntity.functional,
          accountId: row.accountId,
          accountLabel: account(row.accountId).label,
          month: row.month,
          ...(row.segmentId === null ? {} : { segmentLabel: segment(row.segmentId).label }),
          ...(row.costCentreId === null ? {} : { costCentreId: row.costCentreId }),
          amountMinor: row.amountMinor,
          quantity: row.quantity,
          vintageId: row.vintageId,
          sortKey: `${row.accountId}|${row.entityId}|${row.month}|${row.segmentId ?? ''}`,
        });
      }
    }
  }

  return rows
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ sortKey: _sortKey, ...row }) => row);
}

function factKey(row: Fact): string {
  return [
    row.entityId,
    row.accountId,
    row.month,
    row.scenario,
    row.versionId,
    row.costCentreId ?? '',
    row.segmentId ?? '',
    row.vintageId,
  ].join('|');
}

function comparatorFor(item: CommentaryItem): ComparatorChoice {
  return item.comparatorId === 'forecast' || item.comparatorId === 'budget'
    ? { id: item.comparatorId, versionId: item.versionId }
    : { id: item.comparatorId };
}

function comparativeContext(ctx: MeasureContext, choice: ComparatorChoice): MeasureContext {
  const resolved = resolveComparator(choice, ctx);
  const historicalTimeComparator =
    ctx.lens === 'constant' &&
    (choice.id === 'prior_period' || choice.id === 'prior_year');
  return {
    ...contextAtScope(ctx, resolved.scope ?? ctx.scope),
    // Keep the evidence chain on the same basis as compareMeasure. Constant currency rebases the
    // current side to the historical window; that historical side is itself reported currency.
    // Rebasing it again would borrow rates from a second year and make its drivers miss the quoted
    // movement.
    ...(historicalTimeComparator
      ? { lens: 'reported' as const, comparativeScope: undefined }
      : {}),
    scenario: resolved.scenario ?? ctx.scenario,
    versionId: resolved.versionId ?? ctx.versionId,
  };
}

function accountsForBridgeBar(bar: BridgeBar, inputs: readonly MeasureInput[]): AccountCode[] {
  if (bar.kind === 'volume' || bar.kind === 'price' || bar.kind === 'mix' || bar.kind === 'rate') {
    return ['revenue'];
  }
  if (bar.kind === 'unsegmented') return ['revenue', 'revenue_ic'];
  return inputs.map((input) => input.accountId);
}

function bridgeDriver(
  bar: BridgeBar,
  ctx: MeasureContext,
  comparative: MeasureContext,
  inputs: readonly MeasureInput[],
): CommentaryDriver {
  const attribution = attributeBar(bar, ctx, comparative);
  const driver: DriverDefinition | undefined = attribution.driver;
  const owner =
    driver?.owner ??
    (bar.kind === 'fx'
      ? 'Group Treasurer'
      : bar.kind === 'unsegmented'
        ? 'Group Financial Controller'
        : 'Group FP&A');
  const factors = [...(bar.bySegment?.entries() ?? [])]
    .map(([code, value]) => ({ label: segment(code).label, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const driverFrom =
    attribution.driverFrom == null
      ? undefined
      : formatValue(attribution.driverFrom, driver?.unit ?? 'count');
  const driverTo =
    attribution.driverTo == null
      ? undefined
      : formatValue(attribution.driverTo, driver?.unit ?? 'count');
  const change =
    driverFrom === undefined || driverTo === undefined
      ? undefined
      : `Operational factor moved from ${driverFrom} to ${driverTo}.`;

  return {
    label: bar.label,
    value: bar.value,
    unit: 'currency',
    owner,
    ...(bar.note === undefined && change === undefined
      ? {}
      : { note: [bar.note, change].filter(Boolean).join(' ') }),
    accounts: accountsForBridgeBar(bar, inputs),
    factors,
  };
}

function grossMarginDrivers(
  ctx: MeasureContext,
  comparative: MeasureContext,
): CommentaryDriver[] | undefined {
  const currentRevenue = computeMeasure('revenue', ctx).value;
  const currentCost = computeMeasure('cost_of_sales', ctx).value;
  const priorRevenue = computeMeasure('revenue', comparative).value;
  const priorCost = computeMeasure('cost_of_sales', comparative).value;
  if (
    currentRevenue === null ||
    currentRevenue === 0 ||
    currentCost === null ||
    priorRevenue === null ||
    priorRevenue === 0 ||
    priorCost === null
  ) {
    return undefined;
  }

  const opening = (priorRevenue - priorCost) / priorRevenue;
  const afterRevenue = (currentRevenue - priorCost) / currentRevenue;
  const closing = (currentRevenue - currentCost) / currentRevenue;
  return [
    {
      label: 'Revenue denominator',
      value: (afterRevenue - opening) * 10_000,
      unit: 'bps',
      owner: 'Commercial Director',
      note: 'Revenue moved first while cost of sales was held at the comparator amount.',
      accounts: ['revenue', 'revenue_ic'],
      factors: [],
    },
    {
      label: 'Delivery cost',
      value: (closing - afterRevenue) * 10_000,
      unit: 'bps',
      owner: 'Operations Director',
      note: 'Cost of sales then moved at current revenue. The order is stated because attribution order matters.',
      accounts: ['cost_of_sales', 'cost_of_sales_ic'],
      factors: [],
    },
  ];
}

function genericDriver(
  item: CommentaryItem,
  comparison: MeasureWithComparison,
  value = comparison.movement,
  unit = comparison.movementUnit,
): CommentaryDriver {
  const label =
    item.anchor.measureId === 'cash'
      ? 'Closing cash versus forecast'
      : item.anchor.measureId === 'dso'
        ? 'Receivables and revenue relationship'
        : `${comparison.current.label} movement`;
  return {
    label,
    value,
    unit,
    owner: comparison.current.owner,
    note: 'A single governed driver is shown where the measure has no additive bridge; no split is invented.',
    accounts: comparison.current.inputs.map((input) => input.accountId),
    factors: [],
  };
}

/** Compute the two-level chain without trusting prose for any amount. */
export function commentaryEvidence(
  item: CommentaryItem,
  view: View,
  model: World,
): CommentaryEvidence {
  if (!canReadCommentary(item, view)) {
    throw new Error(`Commentary ${item.id} is outside ${view.principal.label}'s resolved scope`);
  }

  const dataVintageId = item.publishedSnapshot?.dataVintageId ?? item.provenance.dataVintageId;
  const dimensions = resolveDimensionScope(view.permission, {
    ...(item.anchor.segmentId === undefined ? {} : { segmentId: item.anchor.segmentId }),
  });
  if (!dimensions.allowed) throw new Error(dimensions.refusal);
  const ctx: MeasureContext = {
    ...contextAtScope(contextOf(view), item.period),
    asOfVintage: dataVintageId,
    ...dimensions.filters,
  };
  const choice = comparatorFor(item);
  const comparison = compareMeasure(item.anchor.measureId, ctx, choice);
  const comparative = comparativeContext(ctx, choice);

  let movement = comparison.movement;
  let movementUnit = comparison.movementUnit;
  let drivers: CommentaryDriver[];

  if (item.anchor.measureId === 'revenue' && choice.id !== 'trend') {
    const bridge = buildBridge({ measureId: 'revenue', ctx, comparator: choice });
    movement = bridge.total;
    movementUnit = 'currency';
    drivers = bridge.bars
      .filter((bar) => bar.kind !== 'opening' && bar.kind !== 'closing')
      .map((bar) => bridgeDriver(bar, ctx, comparative, comparison.current.inputs));
  } else if (item.anchor.measureId === 'gross_margin' && choice.id !== 'trend') {
    drivers = grossMarginDrivers(ctx, comparative) ?? [genericDriver(item, comparison)];
  } else if (
    item.anchor.measureId === 'cash' &&
    comparison.current.value !== null &&
    comparison.comparativeValue !== null
  ) {
    movement = comparison.current.value - comparison.comparativeValue;
    movementUnit = 'currency';
    drivers = [genericDriver(item, comparison, movement, movementUnit)];
  } else {
    drivers = [genericDriver(item, comparison)];
  }

  const values = drivers.map((driver) => driver.value);
  const driverTotal = values.some((value) => value === null)
    ? null
    : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const driversSum =
    movement === null || driverTotal === null
      ? movement === driverTotal
      : Math.abs(movement - driverTotal) < 0.01;

  return {
    comparison,
    movement,
    movementUnit,
    drivers,
    driverTotal,
    driversSum,
    inputs: comparison.current.inputs,
    sourceRows: sourceRows(model, ctx, comparison.current.inputs),
    dataVintageId,
    pinned: item.publishedSnapshot !== undefined,
  };
}

export function carriedCommentary(
  queue: readonly CommentaryItem[],
  item: CommentaryItem,
): PublishedCommentarySnapshot | undefined {
  return carryForwardCommentary(queue, item);
}
