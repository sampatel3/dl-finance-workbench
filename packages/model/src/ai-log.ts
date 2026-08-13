/**
 * Append-only audit records for material model use.
 *
 * This is not a token counter. A useful audit row says why a model ran, which model and prompt ran,
 * which governed figures it could see, which vintage fixed those figures, what it wrote and what a
 * named human did next. Reviews return new rows rather than mutating the original log, so history can
 * be retained by the persistence tier when one is added.
 */

import type { CommentaryItem } from './approvals.ts';

export type AiPurpose = 'commentary_headline' | 'question_answer' | 'risk_draft';

export type AiReview =
  | { readonly outcome: 'pending' }
  | { readonly outcome: 'accepted'; readonly actor: string; readonly at: string }
  | {
      readonly outcome: 'edited';
      readonly actor: string;
      readonly at: string;
      readonly finalOutput: string;
    }
  | {
      readonly outcome: 'rejected';
      readonly actor: string;
      readonly at: string;
      readonly reason: string;
    };

export type AiHumanReview = Exclude<AiReview, { readonly outcome: 'pending' }>;

export interface AiUsageEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly purpose: AiPurpose;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly dataVintageId: string;
  /** Stable governed references; the finance values remain in their source rows. */
  readonly figureRefs: readonly string[];
  readonly output: string;
  readonly outputObjectId?: string;
  readonly review: AiReview;
}

/** Append one unique interaction without changing the prior array. */
export function appendAiUsage(
  log: readonly AiUsageEntry[],
  entry: AiUsageEntry,
): readonly AiUsageEntry[] {
  if (log.some((existing) => existing.id === entry.id)) {
    throw new Error(`AI usage entry ${entry.id} already exists`);
  }
  return [...log, entry];
}

/** Record the first human disposition. A later correction is a new audit event, not an overwrite. */
export function recordAiReview(
  log: readonly AiUsageEntry[],
  id: string,
  review: AiHumanReview,
): readonly AiUsageEntry[] {
  const current = log.find((entry) => entry.id === id);
  if (current === undefined) throw new Error(`Unknown AI usage entry: ${id}`);
  if (current.review.outcome !== 'pending') {
    throw new Error(`AI usage entry ${id} is already reviewed`);
  }
  return log.map((entry) => (entry.id === id ? { ...entry, review } : entry));
}

function reviewFor(item: CommentaryItem): AiReview {
  const rejection = [...item.approvalHistory]
    .reverse()
    .find((event) => event.action === 'reject');
  if (rejection !== undefined) {
    return {
      outcome: 'rejected',
      actor: rejection.actor,
      at: rejection.at,
      reason: rejection.reason ?? 'Rejected without a recorded reason',
    };
  }
  const approval = [...item.approvalHistory]
    .reverse()
    .find((event) => event.action === 'approve');
  return approval === undefined
    ? { outcome: 'pending' }
    : { outcome: 'accepted', actor: approval.actor, at: approval.at };
}

/** Audit rows for the deterministic commentary queue, one per model-authored item. */
export function aiUsageLogForCommentary(items: readonly CommentaryItem[]): AiUsageEntry[] {
  return items.flatMap((item) => {
    if (item.provenance.authoredBy !== 'model') return [];
    const modelId = item.provenance.modelId;
    const promptVersion = item.provenance.promptVersion;
    if (modelId === undefined || promptVersion === undefined) {
      throw new Error(`Model-authored commentary ${item.id} has incomplete provenance`);
    }
    return [
      {
        id: `ai:${item.id}:r${item.revision}`,
        occurredAt: item.createdAt,
        purpose: 'commentary_headline' as const,
        modelId,
        promptVersion,
        dataVintageId: item.provenance.dataVintageId,
        figureRefs: item.provenance.figureRefs,
        output: `${item.headline}\n${item.detail}`,
        outputObjectId: item.id,
        review: reviewFor(item),
      },
    ];
  });
}
