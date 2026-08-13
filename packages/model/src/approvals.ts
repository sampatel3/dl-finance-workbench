/**
 * Commentary approval as a state machine with a vintage-pinned published snapshot.
 *
 * Approval is evidence, not a status dropdown. Every transition records who made it and when; a
 * rejection records why; publication copies the approved content and its data vintage into an
 * immutable-shaped snapshot. Later loads may change the live dashboard, but they cannot change what
 * a named person approved.
 */

import {
  CALENDAR_YEAR,
  addMonths,
  fiscalYearScope,
  halfYearScope,
  monthScope,
  quarterScope,
} from './period.ts';
import type { PeriodScope } from './period.ts';
import type { World } from './seed.ts';
import type { SegmentCode } from './taxonomy.ts';

export type CommentaryState = 'draft' | 'in_review' | 'approved' | 'published' | 'rejected';

export type CommentaryComparatorId =
  | 'prior_period'
  | 'prior_year'
  | 'budget'
  | 'forecast'
  | 'trend';

export interface CommentaryAnchor {
  readonly measureId: string;
  readonly entityId: string;
  readonly segmentId?: SegmentCode;
}

export interface CommentaryProvenance {
  /** References into governed figures; values remain in the fact/measure layer. */
  readonly figureRefs: readonly string[];
  readonly authoredBy: 'model' | 'human' | 'code';
  readonly modelId?: string;
  readonly promptVersion?: string;
  readonly dataVintageId: string;
}

export type CommentaryAction = 'submit' | 'approve' | 'publish' | 'reject' | 'revise';

export interface CommentaryApprovalEvent {
  readonly action: CommentaryAction;
  readonly from: CommentaryState;
  readonly to: CommentaryState;
  readonly actor: string;
  readonly at: string;
  readonly reason?: string;
}

export interface PublishedCommentarySnapshot {
  readonly commentaryId: string;
  readonly revision: number;
  readonly anchor: CommentaryAnchor;
  readonly period: PeriodScope;
  readonly comparatorId: CommentaryComparatorId;
  readonly versionId: string;
  readonly headline: string;
  readonly detail: string;
  readonly dataVintageId: string;
  readonly publishedAt: string;
  readonly publishedBy: string;
}

export interface CommentaryItem {
  readonly id: string;
  readonly revision: number;
  readonly anchor: CommentaryAnchor;
  readonly period: PeriodScope;
  readonly comparatorId: CommentaryComparatorId;
  readonly versionId: string;
  readonly headline: string;
  readonly detail: string;
  readonly author: string;
  readonly createdAt: string;
  readonly provenance: CommentaryProvenance;
  readonly state: CommentaryState;
  readonly approvalHistory: readonly CommentaryApprovalEvent[];
  readonly publishedSnapshot?: PublishedCommentarySnapshot;
}

export interface CommentaryDraftInput {
  readonly id: string;
  readonly anchor: CommentaryAnchor;
  readonly period: PeriodScope;
  readonly comparatorId: CommentaryComparatorId;
  readonly versionId: string;
  readonly headline: string;
  readonly detail: string;
  readonly author: string;
  readonly createdAt: string;
  readonly provenance: CommentaryProvenance;
}

export type CommentaryTransition =
  | { readonly action: 'submit' | 'approve' | 'publish' | 'revise'; readonly actor: string; readonly at: string }
  | {
      readonly action: 'reject';
      readonly actor: string;
      readonly at: string;
      readonly reason: string;
    };

export function createCommentaryDraft(input: CommentaryDraftInput): CommentaryItem {
  if (input.provenance.dataVintageId.trim() === '') {
    throw new Error(`Commentary ${input.id} must name the data vintage it was written from`);
  }
  if (
    input.provenance.authoredBy === 'model' &&
    (input.provenance.modelId === undefined || input.provenance.promptVersion === undefined)
  ) {
    throw new Error(`Model-authored commentary ${input.id} must name its model and prompt version`);
  }
  return {
    ...input,
    revision: 1,
    state: 'draft',
    approvalHistory: [],
  };
}

function targetState(state: CommentaryState, action: CommentaryAction): CommentaryState | undefined {
  switch (state) {
    case 'draft':
      return action === 'submit' ? 'in_review' : undefined;
    case 'in_review':
      return action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : undefined;
    case 'approved':
      return action === 'publish' ? 'published' : undefined;
    case 'rejected':
      return action === 'revise' ? 'draft' : undefined;
    case 'published':
      return undefined;
  }
}

/** Apply one legal transition and return a new record; the input is never changed. */
export function transitionCommentary(
  item: CommentaryItem,
  transition: CommentaryTransition,
): CommentaryItem {
  const to = targetState(item.state, transition.action);
  if (to === undefined) {
    throw new Error(
      `Commentary ${item.id} in state ${item.state} cannot ${transition.action}`,
    );
  }
  if (transition.action === 'reject' && transition.reason.trim() === '') {
    throw new Error(`Rejecting commentary ${item.id} requires a reason`);
  }

  const event: CommentaryApprovalEvent = {
    action: transition.action,
    from: item.state,
    to,
    actor: transition.actor,
    at: transition.at,
    ...(transition.action === 'reject' ? { reason: transition.reason } : {}),
  };

  const revision = transition.action === 'revise' ? item.revision + 1 : item.revision;
  if (transition.action !== 'publish') {
    return {
      ...item,
      revision,
      state: to,
      approvalHistory: [...item.approvalHistory, event],
    };
  }

  const publishedSnapshot: PublishedCommentarySnapshot = {
    commentaryId: item.id,
    revision,
    anchor: item.anchor,
    period: item.period,
    comparatorId: item.comparatorId,
    versionId: item.versionId,
    headline: item.headline,
    detail: item.detail,
    dataVintageId: item.provenance.dataVintageId,
    publishedAt: transition.at,
    publishedBy: transition.actor,
  };
  return {
    ...item,
    revision,
    state: to,
    approvalHistory: [...item.approvalHistory, event],
    publishedSnapshot,
  };
}

function sameAnchor(a: CommentaryAnchor, b: CommentaryAnchor): boolean {
  return (
    a.measureId === b.measureId &&
    a.entityId === b.entityId &&
    a.segmentId === b.segmentId
  );
}

/** The latest earlier published snapshot for the current item's anchor and comparator. */
export function carryForwardCommentary(
  items: readonly CommentaryItem[],
  current: Pick<CommentaryItem, 'anchor' | 'period' | 'comparatorId'>,
): PublishedCommentarySnapshot | undefined {
  return items
    .flatMap((item) => (item.publishedSnapshot === undefined ? [] : [item.publishedSnapshot]))
    .filter((snapshot) => sameAnchor(snapshot.anchor, current.anchor))
    .filter((snapshot) => snapshot.period.type === current.period.type)
    .filter((snapshot) => snapshot.comparatorId === current.comparatorId)
    .filter((snapshot) => snapshot.period.endMonth < current.period.startMonth)
    .sort((a, b) => b.period.endMonth.localeCompare(a.period.endMonth))[0];
}

function modelDraft(
  input: Omit<CommentaryDraftInput, 'provenance' | 'versionId'> & {
    readonly dataVintageId: string;
    readonly versionId?: string;
  },
): CommentaryItem {
  const versionId = input.versionId ?? 'v6';
  return createCommentaryDraft({
    id: input.id,
    anchor: input.anchor,
    period: input.period,
    comparatorId: input.comparatorId,
    versionId,
    headline: input.headline,
    detail: input.detail,
    author: input.author,
    createdAt: input.createdAt,
    provenance: {
      figureRefs: [
        `${input.anchor.measureId}:${input.anchor.entityId}:` +
          `${input.anchor.segmentId ?? 'all-segments'}:${input.period.startMonth}:` +
          `${input.period.endMonth}:comparator=${input.comparatorId}:version=${versionId}`,
      ],
      authoredBy: 'model',
      modelId: 'claude-opus-5',
      promptVersion: 'commentary-headline-v1',
      dataVintageId: input.dataVintageId,
    },
  });
}

/** A deterministic rules-written fallback must never claim that a model ran. */
function codeDraft(
  input: Omit<CommentaryDraftInput, 'provenance'> & { readonly dataVintageId: string },
): CommentaryItem {
  return createCommentaryDraft({
    id: input.id,
    anchor: input.anchor,
    period: input.period,
    comparatorId: input.comparatorId,
    versionId: input.versionId,
    headline: input.headline,
    detail: input.detail,
    author: input.author,
    createdAt: input.createdAt,
    provenance: {
      figureRefs: [
        `${input.anchor.measureId}:${input.anchor.entityId}:` +
          `${input.anchor.segmentId ?? 'all-segments'}:${input.period.startMonth}:` +
          `${input.period.endMonth}:comparator=${input.comparatorId}:version=${input.versionId}`,
      ],
      authoredBy: 'code',
      dataVintageId: input.dataVintageId,
    },
  });
}

const COMMENTARY_COMPARATOR_LABELS: Readonly<Record<CommentaryComparatorId, string>> = {
  prior_period: 'prior period',
  prior_year: 'prior year',
  budget: 'budget',
  forecast: 'forecast',
  trend: 'trend expectation',
};

export interface SelectedCommentaryInput {
  readonly period: PeriodScope;
  readonly comparatorId: CommentaryComparatorId;
  readonly versionId: string;
  readonly entityId: string;
  readonly measureId?: string;
  readonly segmentId?: SegmentCode;
}

/**
 * A deterministic first draft for the selected reporting identity.
 *
 * This is deliberately a new draft rather than a projection of an approved record: changing period
 * or comparator changes the figures, so carrying an earlier approval badge onto it would fabricate
 * governance history. The approval queue remains the evidence that the workflow exists.
 */
function selectedCommentaryDraft(
  world: World,
  input: SelectedCommentaryInput,
  authoredBy: 'code' | 'model',
): CommentaryItem {
  const dataVintage = world.register.currentFor(input.period.endMonth);
  if (dataVintage === undefined) {
    throw new Error(`Commentary requires an accepted vintage through ${input.period.endMonth}`);
  }
  const measureId = input.measureId ?? 'revenue';
  const measureLabel = measureId.replaceAll('_', ' ');
  const comparator = COMMENTARY_COMPARATOR_LABELS[input.comparatorId];
  const draft = {
    id:
      `commentary:selected:${measureId}:${input.entityId}:${input.period.startMonth}:` +
      `${input.period.endMonth}:${input.comparatorId}:${input.versionId}:` +
      `${input.segmentId ?? 'all-segments'}`,
    anchor: {
      measureId,
      entityId: input.entityId,
      ...(input.segmentId === undefined ? {} : { segmentId: input.segmentId }),
    },
    period: input.period,
    comparatorId: input.comparatorId,
    versionId: input.versionId,
    headline: `${input.period.label} ${measureLabel} commentary against ${comparator} is ready for review.`,
    detail:
      `This draft states the ${input.period.startMonth} to ${input.period.endMonth} reporting window ` +
      `and its ${comparator} basis; the supporting chain recomputes both from governed figures.`,
    author:
      authoredBy === 'model' ? 'Finance commentary assistant' : 'Finance commentary rules',
    createdAt: '2026-08-04T08:20:00Z',
    dataVintageId: dataVintage.id,
  };
  return authoredBy === 'model' ? modelDraft(draft) : codeDraft(draft);
}

export function seedSelectedCommentaryDraft(
  world: World,
  input: SelectedCommentaryInput,
): CommentaryItem {
  return selectedCommentaryDraft(world, input, 'code');
}

function publishSeededCommentary(item: CommentaryItem, minute: string): CommentaryItem {
  return transitionCommentary(
    transitionCommentary(
      transitionCommentary(item, {
        action: 'submit',
        actor: 'FP&A Manager',
        at: `2026-08-04T${minute}:00Z`,
      }),
      {
        action: 'approve',
        actor: 'Group Financial Controller',
        at: `2026-08-04T${minute}:30Z`,
      },
    ),
    {
      action: 'publish',
      actor: 'Chief Financial Officer',
      at: `2026-08-04T${minute}:45Z`,
    },
  );
}

/**
 * The deterministic demonstration queue, spread across every approval state.
 *
 * Its vintages are looked up from the supplied world. The prior published item intentionally pins
 * the original June load, so the later restatement changes the live view without rewriting the pack
 * that was approved before it arrived.
 */
export function seedCommentaryQueue(world: World): CommentaryItem[] {
  const currentMonth = world.dataThrough;
  const priorMonth = addMonths(currentMonth, -1);
  const currentVintage = world.register.currentFor(currentMonth);
  const priorOriginalVintage = world.register
    .vintages()
    .filter(
      (vintage) =>
        vintage.fromMonth <= priorMonth &&
        priorMonth <= vintage.toMonth &&
        vintage.restatesVintageId === undefined &&
        vintage.status !== 'rejected',
    )
    .at(-1);
  if (currentVintage === undefined || priorOriginalVintage === undefined) {
    throw new Error('The commentary queue requires current and prior accepted vintages');
  }

  const common = {
    comparatorId: 'forecast' as const,
    author: 'Finance commentary assistant',
  };

  const draft = modelDraft({
    ...common,
    id: `commentary:revenue:${currentMonth}:draft`,
    anchor: { measureId: 'revenue', entityId: 'group' },
    period: monthScope(currentMonth),
    headline: 'Revenue performance is ready for controller review.',
    detail: 'Open the governed revenue movement, its drivers and the source rows behind them.',
    createdAt: '2026-08-04T08:00:00Z',
    dataVintageId: currentVintage.id,
  });

  const marginDraft = modelDraft({
    ...common,
    id: `commentary:gross-margin:${currentMonth}:review`,
    anchor: { measureId: 'gross_margin', entityId: 'group' },
    period: monthScope(currentMonth),
    headline: 'Service delivery costs remain the main pressure on gross margin.',
    detail: 'The evidence chain separates rate, volume and mix before reaching the ledger rows.',
    createdAt: '2026-08-04T08:05:00Z',
    dataVintageId: currentVintage.id,
  });
  const inReview = transitionCommentary(marginDraft, {
    action: 'submit',
    actor: 'FP&A Manager',
    at: '2026-08-04T09:00:00Z',
  });

  const cashDraft = modelDraft({
    ...common,
    id: `commentary:cash:${currentMonth}:approved`,
    anchor: { measureId: 'cash', entityId: 'group' },
    period: monthScope(currentMonth),
    headline: 'July closing cash remains below the approved forecast.',
    detail: 'The governed chain compares July closing cash with forecast v6 and links its source rows.',
    createdAt: '2026-08-04T08:10:00Z',
    dataVintageId: currentVintage.id,
  });
  const approved = transitionCommentary(
    transitionCommentary(cashDraft, {
      action: 'submit',
      actor: 'FP&A Manager',
      at: '2026-08-04T09:05:00Z',
    }),
    {
      action: 'approve',
      actor: 'Group Financial Controller',
      at: '2026-08-04T10:00:00Z',
    },
  );

  const priorDraft = modelDraft({
    ...common,
    id: `commentary:gross-margin:${priorMonth}:published`,
    anchor: { measureId: 'gross_margin', entityId: 'group' },
    period: monthScope(priorMonth),
    headline: 'Contractor rates were the principal pressure on gross margin.',
    detail: 'The approved chain attributes the movement before linking to supporting rows.',
    createdAt: '2026-07-05T08:00:00Z',
    dataVintageId: priorOriginalVintage.id,
  });
  const published = transitionCommentary(
    transitionCommentary(
      transitionCommentary(priorDraft, {
        action: 'submit',
        actor: 'FP&A Manager',
        at: '2026-07-06T09:00:00Z',
      }),
      {
        action: 'approve',
        actor: 'Group Financial Controller',
        at: '2026-07-07T10:00:00Z',
      },
    ),
    {
      action: 'publish',
      actor: 'Chief Financial Officer',
      at: '2026-07-08T11:00:00Z',
    },
  );

  const receivablesDraft = modelDraft({
    ...common,
    id: `commentary:dso:${currentMonth}:rejected`,
    anchor: { measureId: 'dso', entityId: 'group' },
    period: monthScope(currentMonth),
    headline: 'Receivables require management attention.',
    detail: 'The first draft did not distinguish the entities responsible for the movement.',
    createdAt: '2026-08-04T08:15:00Z',
    dataVintageId: currentVintage.id,
  });
  const rejected = transitionCommentary(
    transitionCommentary(receivablesDraft, {
      action: 'submit',
      actor: 'FP&A Manager',
      at: '2026-08-04T09:10:00Z',
    }),
    {
      action: 'reject',
      actor: 'Group Financial Controller',
      at: '2026-08-04T10:05:00Z',
      reason: 'Add the entity-level exposure and name the accountable controller.',
    },
  );

  const quarter = publishSeededCommentary(
    selectedCommentaryDraft(world, {
      period: quarterScope(2026, 2, CALENDAR_YEAR),
      comparatorId: 'prior_period',
      versionId: 'v6',
      entityId: 'group',
    }, 'model'),
    '11:00',
  );
  const halfYear = publishSeededCommentary(
    selectedCommentaryDraft(world, {
      period: halfYearScope(2026, 1, CALENDAR_YEAR),
      comparatorId: 'prior_year',
      versionId: 'v6',
      entityId: 'group',
    }, 'model'),
    '11:10',
  );
  const year = publishSeededCommentary(
    selectedCommentaryDraft(world, {
      period: fiscalYearScope(2025, CALENDAR_YEAR),
      comparatorId: 'prior_year',
      versionId: 'v6',
      entityId: 'group',
    }, 'model'),
    '11:20',
  );

  return [draft, inReview, approved, published, rejected, quarter, halfYear, year];
}
