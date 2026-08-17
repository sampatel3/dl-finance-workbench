/**
 * Can we move cash in time, from where, and who must approve it?
 *
 * The review's second CFO question on the cash surface, and the one a thirteen-week chart cannot answer
 * however red it is coloured. A treasurer looking at a breach in week nine does not need to be told the
 * balance is low; they need to know which entity is sitting on money, how much of it can actually leave,
 * and whether the paperwork clears before the week arrives.
 *
 * ## Availability is not the balance
 *
 * An entity with £6.4m of cash does not have £6.4m to send. It has payroll to run and suppliers to pay,
 * and a treasurer who swept the account would create next week's crisis to fix this one. So availability
 * is the balance **less an operating buffer**, and the buffer is stated per entity rather than assumed —
 * a manufacturing business with a monthly payroll and a services entity billing in arrears do not hold
 * the same cushion.
 *
 * ## Lead time is the part that decides
 *
 * Every option here is arithmetically sufficient or it is not, and that is the easy half. The half that
 * decides is whether an approval, a banking cut-off and a currency conversion fit between today and the
 * week the money is needed — which is why each option carries `leadTimeDays` and each is marked
 * `arrivesInTime` or not. A funding plan that ignores lead time is a list of places money exists.
 *
 * The constraints are modelled, and the Controls surface says so. What is not modelled is the *shape*:
 * an approver, a notice period, a cut-off, and a reason a transfer might be blocked outright, because
 * those are the four things that turn "we have the cash" into "we can use the cash".
 */

import type { FiscalMonth } from '@kestrel/model';
import { entity, monthScope, subtree, tradingEntities } from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { computeMeasure } from '@kestrel/measures';

/**
 * What each entity must keep, and what it takes to move the rest.
 *
 * Written down per entity rather than derived, because none of it is arithmetic: a notice period is a
 * banking arrangement, an approval threshold is a delegation of authority, and a restriction is a
 * regulator's. Deriving them from the figures would be inventing them.
 */
export interface FundingConstraint {
  readonly entityId: string;
  /** Kept back for payroll and settlement. Minor units, presentation currency. */
  readonly bufferMinor: number;
  /** Working days from request to cleared funds, including approval. */
  readonly leadTimeDays: number;
  /** Who signs it off. */
  readonly approver: string;
  /** Why it takes as long as it does, in words a treasurer would use. */
  readonly note: string;
  /** True where a transfer needs a currency conversion, which is a cost and a delay. */
  readonly crossCurrency: boolean;
  /** Set where money cannot leave at all, with the reason. */
  readonly blocked?: string;
}

export const FUNDING_CONSTRAINTS: readonly FundingConstraint[] = [
  {
    entityId: 'manufacturing',
    bufferMinor: 150_000_00,
    leadTimeDays: 1,
    approver: 'Group Treasurer',
    note: 'Same-day sterling transfer inside the UK cash pool. Cut-off is 15:00.',
    crossCurrency: false,
  },
  {
    entityId: 'services',
    bufferMinor: 120_000_00,
    leadTimeDays: 1,
    approver: 'Group Treasurer',
    note: 'Same-day sterling transfer inside the UK cash pool. Cut-off is 15:00.',
    crossCurrency: false,
  },
  {
    // The one that makes the panel worth reading: money is there and cannot arrive quickly.
    entityId: 'gulf',
    bufferMinor: 200_000_00,
    leadTimeDays: 7,
    approver: 'Chief Financial Officer and local board',
    note:
      'Outside the sterling pool. Needs a local board resolution, a AED–GBP conversion and two ' +
      'banking days to clear; the resolution is what takes the week.',
    crossCurrency: true,
  },
  {
    entityId: 'europe',
    bufferMinor: 180_000_00,
    leadTimeDays: 3,
    approver: 'Chief Financial Officer',
    note:
      'EUR–GBP conversion and a SEPA transfer. Non-controlling interest at 15%, so a distribution ' +
      'needs minority consent above the intercompany loan limit.',
    crossCurrency: true,
  },
  {
    entityId: 'inc',
    bufferMinor: 100_000_00,
    leadTimeDays: 5,
    approver: 'Chief Financial Officer and US Financial Controller',
    note:
      'USD–GBP conversion, and the ledger for the period is not closed — a distribution from an ' +
      'unclosed period is not signed off, which is why this one is unavailable rather than slow.',
    crossCurrency: true,
    blocked: 'Period not closed at this entity, so no distribution can be approved from it.',
  },
];

export function fundingConstraint(entityId: string): FundingConstraint | undefined {
  return FUNDING_CONSTRAINTS.find((constraint) => constraint.entityId === entityId);
}

export interface FundingOption {
  readonly entityId: string;
  readonly entityName: string;
  /** The entity's own cash at the anchor month. */
  readonly cash: number;
  readonly bufferMinor: number;
  /** Cash less buffer, floored at zero. What could actually leave. */
  readonly available: number;
  readonly leadTimeDays: number;
  readonly approver: string;
  readonly note: string;
  readonly crossCurrency: boolean;
  readonly blocked?: string;
  /** Whether the money clears before the week that needs it. */
  readonly arrivesInTime: boolean;
  /**
   * The last week the request can be raised and still clear in time.
   *
   * The column that earns its place. `arrivesInTime` is a yes for almost everything when the breach is
   * eight weeks out, which makes it a field that always says yes and therefore says nothing — the first
   * version of this panel had exactly that problem. What a treasurer actually needs is the *decision
   * date*: Gulf can fund week nine, and the local board resolution has to be requested by week seven.
   *
   * Null where the entity cannot send at all.
   */
  readonly startByWeek: number | null;
}

export interface FundingPlan {
  /** The shortfall being funded, and the week it lands in. */
  readonly needMinor: number;
  readonly week: number;
  /** Working days from now until that week, which is what lead time is measured against. */
  readonly daysAvailable: number;
  readonly options: readonly FundingOption[];
  /** Options that both clear in time and are not blocked, largest first. */
  readonly usable: readonly FundingOption[];
  /** Total that can arrive in time. */
  readonly reachableMinor: number;
  readonly covered: boolean;
  /** One sentence a treasurer can act on. Code writes it. */
  readonly statement: string;
}

/** Five working days a week, which is what a banking lead time is counted in. */
const WORKING_DAYS_PER_WEEK = 5;

/**
 * Which entities could fund a shortfall in a given week, and which of them could do it in time.
 *
 * Only entities the context can read are considered, so a business-unit session does not get a list of
 * its siblings' balances — the funding panel is a group treasury view, and a controller who cannot see
 * the group cannot see its cash either.
 */
export function fundingPlan(
  ctx: MeasureContext,
  need: number,
  week: number,
  anchor: FiscalMonth = ctx.scope.endMonth,
): FundingPlan {
  const daysAvailable = Math.max(0, (week - 1) * WORKING_DAYS_PER_WEEK);
  const readable = new Set(ctx.entityIds);

  const options = tradingEntities()
    .filter((candidate) => readable.has(candidate.id))
    .map((candidate): FundingOption => {
      const constraint = fundingConstraint(candidate.id);
      const cash =
        computeMeasure('cash', {
          ...ctx,
          scope: monthScope(anchor),
          entityIds: subtree(candidate.id),
        }).value ?? 0;
      const buffer = constraint?.bufferMinor ?? 0;
      const available = Math.max(0, cash - buffer);
      const leadTimeDays = constraint?.leadTimeDays ?? 0;
      /* Rounded up: a transfer needing six working days spans two weeks, and telling a treasurer they
         have until the start of the week it lands in is how a deadline gets missed by a day. */
      const leadWeeks = Math.ceil(leadTimeDays / WORKING_DAYS_PER_WEEK);
      const startByWeek = constraint?.blocked === undefined ? Math.max(1, week - leadWeeks) : null;
      return {
        entityId: candidate.id,
        entityName: entity(candidate.id).name,
        cash,
        bufferMinor: buffer,
        available,
        leadTimeDays,
        approver: constraint?.approver ?? 'Group Treasurer',
        note: constraint?.note ?? '',
        crossCurrency: constraint?.crossCurrency ?? false,
        ...(constraint?.blocked === undefined ? {} : { blocked: constraint.blocked }),
        arrivesInTime: constraint?.blocked === undefined && leadTimeDays <= daysAvailable,
        startByWeek,
      };
    })
    .sort((a, b) => b.available - a.available);

  const usable = options
    .filter((option) => option.arrivesInTime && option.available > 0)
    .sort((a, b) => b.available - a.available);
  const reachableMinor = usable.reduce((total, option) => total + option.available, 0);
  const covered = reachableMinor >= need;

  return {
    needMinor: need,
    week,
    daysAvailable,
    options,
    usable,
    reachableMinor,
    covered,
    statement: statementFor(need, week, daysAvailable, usable, options, covered),
  };
}

function statementFor(
  need: number,
  week: number,
  daysAvailable: number,
  usable: readonly FundingOption[],
  all: readonly FundingOption[],
  covered: boolean,
): string {
  const first = usable[0];
  /* The interesting sentence is about what cannot come, not what can. An entity holding money that
     needs longer notice than the week allows is precisely the thing a treasurer has to know now, and it
     is invisible on any chart of the balance. */
  const tooSlow = all.filter(
    (option) => option.blocked === undefined && !option.arrivesInTime && option.available > 0,
  );
  /* Blocked entities are named whether or not they hold spare cash. "Why is Kestrel Inc not on this
     list?" is the first question a reader asks, and the answer — its ledger is not closed — is a control
     finding rather than a treasury one. Leaving it out because the balance happens to be thin would hide
     the interesting half. A route that is merely slow is only worth naming when there is money on it. */
  const blocked = all.filter((option) => option.blocked !== undefined);

  const lead = ` Week ${week} is ${daysAvailable} working days out.`;

  if (first === undefined) {
    return (
      `No entity can fund week ${week} within its notice period.` +
      lead +
      (tooSlow.length === 0
        ? ''
        : ` ${tooSlow[0]?.entityName} holds funds but needs ${tooSlow[0]?.leadTimeDays} days.`)
    );
  }

  const head = covered
    ? `${first.entityName} can cover week ${week}, approved by ${first.approver}, if the request is raised by week ${first.startByWeek}.`
    : `Reachable funds do not cover the shortfall: ${usable.length} ${usable.length === 1 ? 'entity' : 'entities'} can send in time, and the week is still short.`;

  const caveats = [
    ...tooSlow.map(
      (option) =>
        `${option.entityName} holds funds and needs ${option.leadTimeDays} days, which is longer than the week allows`,
    ),
    /* The reason is a written sentence and already ends in a full stop, so it is trimmed before being
       joined into one — otherwise the statement closes with "approved from it..", which is the kind of
       detail that makes a demo look unfinished for no reason at all. */
    ...blocked.map(
      (option) =>
        `${option.entityName} is unavailable: ${(option.blocked ?? '').replace(/\.$/, '')}`,
    ),
  ];

  const earliest = [...usable].sort((a, b) => (a.startByWeek ?? 0) - (b.startByWeek ?? 0))[0];
  const deadline =
    earliest === undefined || earliest.entityId === first.entityId
      ? ''
      : ` The earliest decision date is ${earliest.entityName}'s, at week ${earliest.startByWeek}.`;

  return (
    head + lead + deadline + (caveats.length === 0 ? '' : ` Not counted: ${caveats.join('; ')}.`)
  );
}

// ---------------------------------------------------------------------------
// The receivables book, aged
// ---------------------------------------------------------------------------

/**
 * Ageing buckets derived from the receivables balance and the collection period.
 *
 * The review asks for *"AR ageing, AP due dates, DSO, DPO and overdue collections"*. Three of those the
 * model already holds. Ageing it did not, and the tempting shortcut — seed a plausible set of buckets —
 * produces a table that does not add up to the balance sheet, which is the one defect a controller finds
 * in the first minute.
 *
 * So the buckets are **derived from the balance and the DSO**, and they sum to the receivables figure
 * exactly. The shape is a stated profile rather than a measurement: a book with a 77-day DSO has more of
 * itself in the older buckets than one at 60, and the profile shifts with the collection period rather
 * than being fixed. That is modelled, and the surface says so — what is not modelled is the total, which
 * is the governed figure.
 *
 * Overdue is everything past the stated terms, which is where the money a treasurer can actually chase
 * lives.
 */
export const PAYMENT_TERMS_DAYS = 30;

export interface AgeingBucket {
  readonly label: string;
  /** Lower bound of the bucket in days past invoice. */
  readonly fromDays: number;
  readonly toDays: number | null;
  readonly amount: number;
  readonly share: number;
  /** True where the bucket is past the stated terms. */
  readonly overdue: boolean;
}

export interface Ageing {
  readonly entityId: string;
  readonly entityName: string;
  readonly receivables: number;
  readonly dso: number;
  readonly buckets: readonly AgeingBucket[];
  /** Everything past terms. The number a collections call is about. */
  readonly overdueMinor: number;
  readonly overdueShare: number;
}

const BUCKETS = [
  { label: 'Current', fromDays: 0, toDays: 30, overdue: false },
  { label: '31–60 days', fromDays: 31, toDays: 60, overdue: true },
  { label: '61–90 days', fromDays: 61, toDays: 90, overdue: true },
  { label: 'Over 90 days', fromDays: 91, toDays: null, overdue: true },
] as const;

/**
 * How the book distributes across the buckets at a given collection period.
 *
 * The age profile of an outstanding book is proportional to the **survival curve** of an invoice —
 * the chance it is still unpaid at age `t`. Steady billing means every age appears in proportion to
 * how long invoices of that age stay outstanding, so the profile decays monotonically from Current
 * and DSO is its **mean** age.
 *
 * Both of those were wrong before. Weighting by distance from the DSO centred the *mode* of the
 * distribution on it, which at 65 days put 41% of the book in 61–90 days and only 14.5% in Current.
 * That is not a shape this ledger can produce: against £12.4m of monthly billing, the Current bucket
 * alone has to be roughly one month of it. The old shape published "85.4% overdue", which is a
 * collections crisis no other surface knew about.
 *
 * `S(t) = exp(-(t/λ)²)` — an invoice becomes more likely to be collected the further past terms it
 * goes, which is what a collections function does — with `λ` set so that `∫S = DSO`.
 */
function weightsFor(dso: number): number[] {
  if (dso <= 0) return [1, 0, 0, 0];
  const lambda = (dso * 2) / Math.sqrt(Math.PI);
  const survival = (t: number): number => Math.exp(-((t / lambda) ** 2));
  /* Simpson's rule across each closed bucket. The open-ended bucket is the balance of the mean:
     ∫₀^∞ S is exactly the DSO, so the tail needs no integration and cannot go negative. */
  const area = (from: number, to: number): number =>
    ((to - from) / 6) * (survival(from) + 4 * survival((from + to) / 2) + survival(to));
  const closed = BUCKETS.filter((bucket) => bucket.toDays !== null).map((bucket) =>
    area(bucket.fromDays === 0 ? 0 : bucket.fromDays - 1, bucket.toDays as number),
  );
  const tail = Math.max(0, dso - closed.reduce((sum, a) => sum + a, 0));
  return [...closed, tail];
}

export function ageingFor(ctx: MeasureContext, entityId: string, anchor?: FiscalMonth): Ageing {
  const scope = monthScope(anchor ?? ctx.scope.endMonth);
  const scoped: MeasureContext = { ...ctx, scope, entityIds: subtree(entityId) };
  const receivables = computeMeasure('receivables', scoped).value ?? 0;
  const dso = computeMeasure('dso', scoped).value ?? 0;

  const weights = weightsFor(dso);
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  /* Integer allocation with the remainder on the last bucket, the same discipline the cost-centre split
     uses — so the buckets sum to the receivables balance to the penny rather than to within rounding. */
  let allocated = 0;
  const buckets = BUCKETS.map((bucket, index) => {
    const last = index === BUCKETS.length - 1;
    const amount = last
      ? receivables - allocated
      : Math.round((receivables * (weights[index] ?? 0)) / total);
    allocated += amount;
    return {
      label: bucket.label,
      fromDays: bucket.fromDays,
      toDays: bucket.toDays,
      amount,
      share: receivables === 0 ? 0 : amount / receivables,
      overdue: bucket.overdue,
    };
  });

  const overdueMinor = buckets
    .filter((bucket) => bucket.overdue)
    .reduce((sum, bucket) => sum + bucket.amount, 0);

  return {
    entityId,
    entityName: entity(entityId).name,
    receivables,
    dso,
    buckets,
    overdueMinor,
    overdueShare: receivables === 0 ? 0 : overdueMinor / receivables,
  };
}
