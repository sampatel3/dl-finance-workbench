/**
 * The world, and the one place a URL becomes a measure context.
 *
 * Two jobs, and they belong together.
 *
 * **The world is memoised.** `buildWorld` walks 43 months × 5 entities × 5 versions, and it is a pure
 * function of its seed, so it is built once per process and never invalidated — there is nothing to
 * invalidate. Every surface in a request reads the same object, which is what makes server rendering
 * with no loading state possible: nothing on these pages fetches, so nothing can be caught half-drawn
 * by a screenshot or a deck slide.
 *
 * **A view is resolved from the URL, and only from the URL.** Period, comparator, entity, currency lens
 * and forecast version all arrive as search params, and every surface reads the same resolver. That is
 * the mechanism behind two of the plan's harder commitments:
 *
 *   *Any view's URL reproduces it in a clean browser.* There is no client state to fall out of step
 *   with the address bar, because there is no client state. A screenshot, a deck slide, a tour step and
 *   a link pasted into a message all resolve through this one function.
 *
 *   *Expanding a commentary headline leaves the period, version and comparator byte-identical.* Drill
 *   is a property of a computed figure rather than a page that refetches, so expanding cannot change
 *   the context — the context *is* the URL, and expanding does not navigate.
 *
 * An unreadable parameter falls back to a safe resolved value rather than throwing, and `fellBack`
 * records that it happened. A demo that 500s because somebody hand-edited a query string dies on stage;
 * one that silently shows June when the URL said `month=Jorbuary` is how a screenshot gets the wrong
 * caption. An unknown explicit persona is the exception to an ordinary default: it receives the
 * smallest seeded grant, never the opening Group CFO grant.
 */

import { memoise } from '@demo-kit/data';
/* From the package's routes entry rather than its index: `scripts/narrate.ts` imports this
   module under plain Node, which cannot load the components the index pulls in. */
import { PRODUCT } from '@demo-kit/shell/routes';
import type { CurrencyLens, FiscalMonth, PeriodScope, VersionSpec } from '@kestrel/model';
import {
  ACTUAL_VERSION,
  CALENDAR_YEAR,
  MONTHS,
  SEED_END,
  VERSIONS,
  buildWorld,
  entity,
  fiscalHalfOf,
  fiscalQuarterOf,
  fiscalYearScope,
  fiscalYearOf,
  halfYearScope,
  monthScope,
  quarterScope,
  tradingEntities,
  ytdScope,
} from '@kestrel/model';
import type { ComparatorChoice, ComparatorId, MeasureContext } from '@kestrel/measures';
import { COMPARATORS } from '@kestrel/measures';
import type { Boards, Brief, DetectorContext } from '@kestrel/analysis';
import { activeApprovedForecast, brief, priorityBoards } from '@kestrel/analysis';

import { DEMO_SEED } from './demo';
import type { PermissionScope, PersonaId, Principal } from './permissions';
import {
  DEFAULT_PERSONA_ID,
  principalById,
  resolvePermissionScope,
  resolvePrincipal,
} from './permissions';

/** The world, built once per process. */
export const world = memoise(() => buildWorld({ seed: DEMO_SEED }));

/** The last closed month. Written down in the model, never counted back from a clock. */
export const LATEST_MONTH: FiscalMonth = SEED_END;

export const ALL_MONTHS: readonly FiscalMonth[] = MONTHS;

/** The months a selector offers: the closing year, newest first. Not all forty-three. */
export const SELECTABLE_MONTHS: readonly FiscalMonth[] = [...MONTHS].slice(-12).reverse();

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

/**
 * The period shapes a reader can choose.
 *
 * The four reporting grains required by FW-AI-005, plus year to date because it remains useful on
 * the executive surfaces. Trailing twelve months stays an analyst-only grain.
 */
export const PERIOD_KINDS = ['month', 'quarter', 'half_year', 'year', 'ytd'] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export const PERIOD_LABELS: Readonly<Record<PeriodKind, string>> = {
  month: 'Month',
  quarter: 'Quarter',
  half_year: 'Half-year',
  year: 'Year',
  ytd: 'Year to date',
};

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** `2026-07` → `Jul 2026`. What a header prints; never a locale call, which would vary by machine. */
export function monthLabel(month: FiscalMonth): string {
  const [year, index] = month.split('-');
  return `${MONTH_NAMES[Number(index) - 1] ?? month} ${year}`;
}

/** `2026-07` → `Jul 26`. For an axis, where the century is noise. */
export function shortMonthLabel(month: FiscalMonth): string {
  const [year, index] = month.split('-');
  return `${MONTH_NAMES[Number(index) - 1] ?? month} ${(year ?? '').slice(2)}`;
}

export function scopeFor(kind: PeriodKind, through: FiscalMonth): PeriodScope {
  switch (kind) {
    case 'month':
      return monthScope(through);
    case 'quarter': {
      const fiscalYear = fiscalYearOf(through, CALENDAR_YEAR);
      const fiscalQuarter = fiscalQuarterOf(through, CALENDAR_YEAR);
      const quarter = quarterScope(fiscalYear, fiscalQuarter, CALENDAR_YEAR);
      // `Through` is a hard reporting boundary. An unfinished quarter is quarter-to-date; padding it
      // with future months would both read data that has not closed and mislabel the resulting figure.
      if (quarter.endMonth === through) return quarter;
      return {
        ...quarter,
        endMonth: through,
        label: `Q${fiscalQuarter} FY${String(fiscalYear).slice(-2)} QTD to ${shortMonthLabel(through)}`,
      };
    }
    case 'half_year': {
      const fiscalYear = fiscalYearOf(through, CALENDAR_YEAR);
      const fiscalHalf = fiscalHalfOf(through, CALENDAR_YEAR);
      const half = halfYearScope(fiscalYear, fiscalHalf, CALENDAR_YEAR);
      if (half.endMonth === through) return half;
      return {
        ...half,
        endMonth: through,
        label: `H${fiscalHalf} FY${String(fiscalYear).slice(-2)} to ${shortMonthLabel(through)}`,
      };
    }
    case 'year': {
      const fiscalYear = fiscalYearOf(through, CALENDAR_YEAR);
      const year = fiscalYearScope(fiscalYear, CALENDAR_YEAR);
      if (year.endMonth === through) return year;
      return {
        ...year,
        endMonth: through,
        label: `FY${String(fiscalYear).slice(-2)} YTD to ${shortMonthLabel(through)}`,
      };
    }
    case 'ytd': {
      const scope = ytdScope(through, CALENDAR_YEAR);
      const fiscalYear = fiscalYearOf(through, CALENDAR_YEAR);
      return {
        ...scope,
        label: `FY${String(fiscalYear).slice(-2)} YTD to ${shortMonthLabel(through)}`,
      };
    }
  }
}

/**
 * What the header prints for a resolved scope.
 *
 * The window in full rather than the shape's name. "YTD" alone is a label a reader has to decode, and
 * decoding it wrongly by one month is exactly the mistake this product exists not to make.
 */
export function scopeLabel(kind: PeriodKind, scope: PeriodScope): string {
  switch (kind) {
    case 'month':
      return shortMonthLabel(scope.endMonth);
    case 'quarter': {
      const fiscalYear = fiscalYearOf(scope.endMonth, CALENDAR_YEAR);
      const fiscalQuarter = fiscalQuarterOf(scope.endMonth, CALENDAR_YEAR);
      const quarter = quarterScope(fiscalYear, fiscalQuarter, CALENDAR_YEAR);
      const label = `Q${fiscalQuarter} FY${String(fiscalYear).slice(-2)}`;
      return scope.endMonth === quarter.endMonth
        ? label
        : `${label} QTD to ${shortMonthLabel(scope.endMonth)}`;
    }
    case 'half_year': {
      const fiscalYear = fiscalYearOf(scope.endMonth, CALENDAR_YEAR);
      const fiscalHalf = fiscalHalfOf(scope.endMonth, CALENDAR_YEAR);
      const half = halfYearScope(fiscalYear, fiscalHalf, CALENDAR_YEAR);
      const label = `H${fiscalHalf} FY${String(fiscalYear).slice(-2)}`;
      return scope.endMonth === half.endMonth
        ? label
        : `${label} to ${shortMonthLabel(scope.endMonth)}`;
    }
    case 'year': {
      const fiscalYear = fiscalYearOf(scope.endMonth, CALENDAR_YEAR);
      const year = fiscalYearScope(fiscalYear, CALENDAR_YEAR);
      const label = `FY${String(fiscalYear).slice(-2)}`;
      return scope.endMonth === year.endMonth
        ? label
        : `${label} YTD to ${shortMonthLabel(scope.endMonth)}`;
    }
    case 'ytd': {
      const fiscalYear = fiscalYearOf(scope.endMonth, CALENDAR_YEAR);
      return `FY${String(fiscalYear).slice(-2)} YTD to ${shortMonthLabel(scope.endMonth)}`;
    }
  }
}

// ---------------------------------------------------------------------------
// A view
// ---------------------------------------------------------------------------

export interface View {
  readonly principal: Principal;
  /** The selected entity after the principal's subtree grant has been applied. */
  readonly permission: PermissionScope;
  /** Present when a known entity was requested but the principal may not read it. */
  readonly deniedEntityId?: string;
  readonly periodKind: PeriodKind;
  readonly through: FiscalMonth;
  readonly scope: PeriodScope;
  readonly comparator: ComparatorChoice;
  readonly entityId: string;
  readonly lens: CurrencyLens;
  /** The forecast version this view reads, and the one a `forecast` comparator compares against. */
  readonly version: VersionSpec;
  /** The dataset Explore inspects; ordinary finance surfaces default to actual. */
  readonly dataScenario: 'ACTUAL' | 'BUDGET' | 'FORECAST';
  /** The current demo-kit embedded product treatment, retained by every internal URL. */
  readonly inner: boolean;
  /** Free-mode inner views keep a compact product navigator while guided frames stay presentation-only. */
  readonly surfaceNav: boolean;
  /** True where a parameter was unreadable and a default was used. Surfaced, never swallowed. */
  readonly fellBack: boolean;
}

/** What search params arrive as in Next 15. */
export type Params = Readonly<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export interface ViewOptions {
  /** Dataset switching is an Explore/Ask concern; other surfaces always report closed actuals. */
  readonly allowDataScenario?: boolean;
}

/** Resolve only stored forecast versions; budget is a separate scenario, never a forecast alias. */
export function forecastVersionById(id: string | undefined): VersionSpec | undefined {
  return VERSIONS.find((version) => version.scenario === 'FORECAST' && version.id === id);
}

/** Keep hand-edited forecast comparisons inside the forecast version set. */
export function forecastVersionIdOr(id: string | undefined, fallback: string): string {
  return forecastVersionById(id)?.id ?? fallback;
}

export function viewOf(params: Params = {}, options: ViewOptions = {}): View {
  let fellBack = false;
  /** Record that a parameter was present and unreadable, then use the default. */
  const fallback = <T>(value: T): T => {
    fellBack = true;
    return value;
  };

  const principalResolution = resolvePrincipal(first(params.as));
  const principal = principalResolution.principal;
  if (principalResolution.fellBack) fellBack = true;

  const periodRaw = first(params.period);
  const periodKind: PeriodKind = PERIOD_KINDS.includes(periodRaw as PeriodKind)
    ? (periodRaw as PeriodKind)
    : periodRaw === undefined
      ? 'month'
      : fallback<PeriodKind>('month');

  const monthRaw = first(params.month);
  const through: FiscalMonth = MONTHS.includes(monthRaw ?? '')
    ? (monthRaw as FiscalMonth)
    : monthRaw === undefined
      ? LATEST_MONTH
      : fallback(LATEST_MONTH);

  const approved = activeApprovedForecast();
  const versionRaw = first(params.version);
  const found = forecastVersionById(versionRaw);
  const version = found ?? (versionRaw === undefined ? approved : fallback<VersionSpec>(approved));

  const scenarioRaw = options.allowDataScenario ? first(params.scenario) : undefined;
  const dataScenario: 'ACTUAL' | 'BUDGET' | 'FORECAST' =
    scenarioRaw === 'actual'
      ? 'ACTUAL'
      : scenarioRaw === 'budget'
        ? 'BUDGET'
        : scenarioRaw === 'forecast'
          ? 'FORECAST'
          : scenarioRaw === undefined
            ? 'ACTUAL'
            : fallback<'ACTUAL'>('ACTUAL');

  const comparatorRaw = first(params.comparator);
  const comparatorId: ComparatorId = COMPARATORS.includes(comparatorRaw as ComparatorId)
    ? (comparatorRaw as ComparatorId)
    : comparatorRaw === undefined
      ? 'forecast'
      : fallback<ComparatorId>('forecast');

  // Only the two version-bearing comparators carry a version. Attaching one to "prior year" would put a
  // parameter in the URL that the resolver ignores, and an ignored parameter is a claim about what is on
  // screen that is not true.
  const comparator: ComparatorChoice =
    comparatorId === 'forecast'
      ? { id: 'forecast', versionId: version.id }
      : comparatorId === 'budget'
        ? { id: 'budget', versionId: 'budget-fy26' }
        : { id: comparatorId };

  const entityRaw = first(params.entity);
  const known = ['group', ...tradingEntities().map((e) => e.id)];
  const requestedEntityId: string = known.includes(entityRaw ?? '')
    ? (entityRaw as string)
    : entityRaw === undefined
      ? principal.grant.entityRootId
      : fallback(principal.grant.entityRootId);

  const requestedPermission = resolvePermissionScope(principal, requestedEntityId);
  let entityId: string;
  let permission: PermissionScope;
  let deniedEntityId: string | undefined;
  if (requestedPermission.allowed) {
    entityId = requestedEntityId;
    permission = requestedPermission.scope;
  } else {
    deniedEntityId = requestedEntityId;
    entityId = fallback(principal.grant.entityRootId);
    const ownPermission = resolvePermissionScope(principal);
    if (!ownPermission.allowed) {
      throw new Error(`The seeded principal ${principal.id} cannot resolve its own grant.`);
    }
    permission = ownPermission.scope;
  }

  const lensRaw = first(params.lens);
  const lens: CurrencyLens =
    lensRaw === 'constant' || lensRaw === 'reported'
      ? lensRaw
      : lensRaw === undefined
        ? 'reported'
        : fallback<CurrencyLens>('reported');

  const inner = first(params.view) === 'inner';
  const surfaceNav = inner && first(params.shell) === 'free';

  return {
    principal,
    permission,
    ...(deniedEntityId === undefined ? {} : { deniedEntityId }),
    periodKind,
    through,
    scope: scopeFor(periodKind, through),
    comparator,
    entityId,
    lens,
    version,
    dataScenario,
    inner,
    surfaceNav,
    fellBack,
  };
}

/**
 * The measure context a view resolves to.
 *
 * `comparativeScope` is set only for the constant-currency lens, because that is the one lens whose
 * definition needs a second window: the reporting lens holds rates at the like-for-like prior-year
 * window, independent of the selected performance comparator. With no rate-basis window there is
 * nothing to hold constant and the lens quietly returns the reported figure. That happened while
 * building the currency detector — every
 * constant-currency figure read identical to reported, and every one of them looked plausible.
 */
export function contextOf(view: View): MeasureContext {
  const versionId =
    view.dataScenario === 'ACTUAL'
      ? ACTUAL_VERSION
      : view.dataScenario === 'BUDGET'
        ? 'budget-fy26'
        : view.version.id;
  return {
    store: world().store,
    rates: world().rates,
    scope: view.scope,
    scenario: view.dataScenario,
    versionId,
    lens: view.lens,
    entityIds: view.permission.entityIds,
    ...view.permission.dimensionFilters,
    ...(view.lens === 'constant' ? { comparativeScope: priorYearOf(view.scope) } : {}),
  };
}

/** The canonical URL fields needed to reconstruct a view at a non-navigation boundary such as Ask. */
export function paramsForView(view: View): Params {
  return {
    as: view.principal.id,
    period: view.periodKind,
    month: view.through,
    comparator: view.comparator.id,
    entity: view.entityId,
    lens: view.lens,
    version: view.version.id,
    scenario: view.dataScenario.toLowerCase(),
  };
}

/**
 * Resolve one entity row through the active principal before computing it.
 *
 * A page used to change only `view.entityId` and pass the object back to `contextOf`. Once the
 * permission scope became the authority, that produced the principal's whole permitted total on
 * every entity row. This helper changes the selected entity and its permission together, so a
 * detail table is neither wider than the principal nor accidentally repeated.
 */
export function contextForEntity(view: View, entityId: string): MeasureContext {
  const resolved = resolvePermissionScope(view.principal, entityId);
  if (!resolved.allowed) throw new Error(resolved.refusal);
  return contextOf({ ...view, entityId, permission: resolved.scope });
}

/** The same window a year earlier. Local so `contextOf` does not depend on import order. */
function priorYearOf(scope: PeriodScope): PeriodScope {
  const shift = (m: FiscalMonth): FiscalMonth => {
    const [year, month] = m.split('-');
    return `${Number(year) - 1}-${month}`;
  };
  return { ...scope, startMonth: shift(scope.startMonth), endMonth: shift(scope.endMonth) };
}

export function detectorContextOf(view: View): DetectorContext {
  return { world: world(), ctx: contextOf(view), comparator: view.comparator };
}

/** The four boards for a view, uncapped. */
export function boardsFor(view: View): Boards {
  return priorityBoards(detectorContextOf(view));
}

/** The capped brief: what an executive surface shows above the fold, and what it left out. */
export function briefFor(view: View, capPerBoard = 3): Brief {
  return brief(detectorContextOf(view), capPerBoard);
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

/**
 * A URL for a view, with one dimension changed.
 *
 * Built here rather than in each surface, so a selector, a board item's deep link and a tour step all
 * produce the same address for the same view — which is what makes "any URL reproduces its view"
 * testable rather than aspirational.
 *
 * Defaults are omitted, so the tidy URL and the explicit one resolve identically and a reader is never
 * shown `?period=month&lens=reported&entity=group`. It also means the canonical address for the demo's
 * opening view is the bare path, which is the one a deck slide should carry.
 */
export function hrefFor(
  path: string,
  view: View,
  changes: Partial<{
    period: PeriodKind;
    month: FiscalMonth;
    comparator: ComparatorId;
    entity: string;
    lens: CurrencyLens;
    version: string;
    scenario: 'actual' | 'budget' | 'forecast';
    persona: PersonaId;
  }> = {},
): string {
  const personaId = changes.persona ?? view.principal.id;
  const targetPrincipal = principalById(personaId);
  const personaChanged = personaId !== view.principal.id;
  const canKeepSelectedEntity =
    personaChanged && resolvePermissionScope(targetPrincipal, view.entityId).allowed;
  const merged = {
    period: changes.period ?? view.periodKind,
    month: changes.month ?? view.through,
    comparator: changes.comparator ?? view.comparator.id,
    entity:
      changes.entity ??
      (personaChanged
        ? canKeepSelectedEntity
          ? view.entityId
          : targetPrincipal.grant.entityRootId
        : view.entityId),
    lens: changes.lens ?? view.lens,
    version: changes.version ?? view.version.id,
    scenario: changes.scenario ?? view.dataScenario.toLowerCase(),
  };
  const params = new URLSearchParams();
  if (personaId !== DEFAULT_PERSONA_ID) params.set('as', personaId);
  if (merged.period !== 'month') params.set('period', merged.period);
  if (merged.month !== LATEST_MONTH) params.set('month', merged.month);
  if (merged.comparator !== 'forecast') params.set('comparator', merged.comparator);
  if (merged.entity !== targetPrincipal.grant.entityRootId) params.set('entity', merged.entity);
  if (merged.lens !== 'reported') params.set('lens', merged.lens);
  if (merged.version !== activeApprovedForecast().id) params.set('version', merged.version);
  if (path === '/explore' && merged.scenario !== 'actual') {
    params.set('scenario', merged.scenario);
  }
  if (view.inner) params.set('view', 'inner');
  if (view.surfaceNav) params.set('shell', 'free');
  const query = params.toString();
  const url = productPath(path);
  return query === '' ? url : `${url}?${query}`;
}

/**
 * A surface's logical path, as the URL it is actually served at.
 *
 * Every caller names a surface the way the product thinks of it — `/`, `/performance`,
 * `/cash` — and that vocabulary is the one `SURFACES`, `surfaceFor` and each page's own
 * `path` prop share. Where those surfaces are MOUNTED is a different question, and the kit
 * answers it: `PRODUCT` is the product's root, and the demo shell owns `/`. Keeping the two
 * apart is what lets the whole app go on talking about `/cash` while the browser sees
 * `/app/cash`, and it is why moving the product under the shell touched one function.
 */
export function productPath(path: string): string {
  return path === '/' ? PRODUCT : `${PRODUCT}${path}`;
}

/**
 * Resolve an engine-owned action through the active view.
 *
 * The action may add a focus, comparator or a permitted entity drill, but it cannot replace the
 * principal or escape the demo-kit's embedded treatment. This keeps one click from silently changing
 * either who is looking or the shell the product is running inside.
 */
export function hrefForTarget(target: string, view: View): string {
  const origin = 'https://finance-workbench.invalid';
  const requested = new URL(target, origin);
  const resolved = new URL(hrefFor(requested.pathname, view), origin);

  for (const [key, value] of requested.searchParams) {
    if (key === 'as' || key === 'view' || key === 'shell') continue;
    if (key === 'scenario' && requested.pathname !== '/explore') continue;
    if (key === 'entity' && !resolvePermissionScope(view.principal, value).allowed) continue;
    resolved.searchParams.set(key, value);
  }
  if (view.principal.id === DEFAULT_PERSONA_ID) resolved.searchParams.delete('as');
  else resolved.searchParams.set('as', view.principal.id);
  if (view.inner) resolved.searchParams.set('view', 'inner');
  else resolved.searchParams.delete('view');
  if (view.surfaceNav) resolved.searchParams.set('shell', 'free');
  else resolved.searchParams.delete('shell');

  return `${resolved.pathname}${resolved.search}${requested.hash}`;
}

/** The entities a selector offers, group first. */
export function selectableEntities(
  principal: Principal = principalById(DEFAULT_PERSONA_ID),
): readonly { readonly id: string; readonly name: string }[] {
  return [
    { id: 'group', name: entity('group').name },
    ...tradingEntities().map((e) => ({ id: e.id, name: e.name })),
  ].filter((entry) => resolvePermissionScope(principal, entry.id).allowed);
}
