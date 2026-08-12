/**
 * Materiality — as a governed object, not a constant.
 *
 * The client's PRD asks, in its own open questions, what threshold makes a variance material. The
 * answer belongs in the product where it can be owned, versioned and argued about, because "why did
 * this appear on the board's list?" has to have an answer that names a policy and a person rather
 * than a magic number in a file nobody can find.
 *
 * **Two thresholds, and both must be cleared.** One of each fails in a way that is easy to predict:
 *
 *   relative only — every small account screams. A £900 line that moved 40% is not board business.
 *   absolute only — a 40% miss on a small line is invisible while a 0.3% wobble on revenue is not.
 *
 * So a variance is material when it is large in money **and** large in proportion. A reader who wants
 * one of them alone can lower the other; a product that only offers one cannot be fixed by lowering
 * anything.
 *
 * And a fitted comparator can never raise anything. See `admissibleForMateriality`.
 */

import type { Statement } from '@kestrel/model';

import type { MeasureWithComparison } from './comparator.ts';
import { formatValue } from './units.ts';

/** Which family of thresholds an account group falls under. */
export type MaterialityClass = Statement | 'operational';

export interface MaterialityThreshold {
  /** Presentation currency, minor units. Non-monetary measures are judged on the relative test only. */
  readonly absoluteMinor: number;
  /** As a rate. `0.02` is two per cent. */
  readonly relative: number;
}

export interface MaterialityPolicy {
  readonly id: string;
  readonly version: number;
  readonly owner: string;
  readonly status: 'approved' | 'draft';
  readonly effectiveFrom: string;
  readonly thresholds: Readonly<Record<MaterialityClass, MaterialityThreshold>>;
  /** One line the Controls surface prints under the policy. */
  readonly rationale: string;
}

/**
 * The policy in force.
 *
 * The figures are a starting point a pilot would replace on its first day; the *object* is the answer
 * to the open question. Profit and loss is tighter than the balance sheet because a £50k swing in
 * monthly profit matters and a £50k swing in receivables is a Tuesday.
 */
export const POLICY: MaterialityPolicy = {
  id: 'materiality-fy26',
  version: 2,
  owner: 'Group Financial Controller',
  status: 'approved',
  effectiveFrom: '2026-01',
  thresholds: {
    pl: { absoluteMinor: 5_000_000, relative: 0.02 },
    bs: { absoluteMinor: 25_000_000, relative: 0.05 },
    cf: { absoluteMinor: 10_000_000, relative: 0.03 },
    operational: { absoluteMinor: 0, relative: 0.05 },
  },
  rationale:
    'A variance is material when it clears both an absolute floor and a relative threshold. Either ' +
    'alone fails: relative-only makes every small account scream, absolute-only hides a large miss ' +
    'on a small line.',
};

export interface MaterialityVerdict {
  readonly material: boolean;
  /** Always populated, including when the answer is no. "Why is this not on the list?" is a question. */
  readonly reason: string;
  readonly threshold?: MaterialityThreshold;
}

/**
 * Is this comparison material?
 *
 * `classOf` is passed in rather than derived from the measure, because a measure does not know which
 * statement it belongs to — `cash` is a balance-sheet figure and `revenue_per_head` is operational,
 * and the catalogue deliberately does not carry a statement so that a measure can be composed from
 * accounts on more than one.
 */
export function assessMateriality(
  comparison: MeasureWithComparison,
  classOf: MaterialityClass,
  policy: MaterialityPolicy = POLICY,
): MaterialityVerdict {
  if (!comparison.comparator.admissibleForMateriality) {
    return {
      material: false,
      reason: `${comparison.comparator.label} is a fitted expectation rather than a plan, so nothing is measured as material against it`,
    };
  }

  const { current, comparativeValue, movement } = comparison;
  if (current.value === null || comparativeValue === null || movement === null) {
    return { material: false, reason: 'no comparative figure, so there is no variance to measure' };
  }

  const threshold = policy.thresholds[classOf];
  const absolute = Math.abs(current.value - comparativeValue);
  const relative = comparativeValue === 0 ? Infinity : absolute / Math.abs(comparativeValue);

  const monetary = current.unit === 'currency' || current.unit === 'rate';
  const clearsAbsolute = !monetary || absolute >= threshold.absoluteMinor;
  const clearsRelative = relative >= threshold.relative;

  if (clearsAbsolute && clearsRelative) {
    return {
      material: true,
      reason: monetary
        ? `${formatValue(absolute, 'currency')} and ${(relative * 100).toFixed(1)}%, against a floor of ${formatValue(threshold.absoluteMinor, 'currency')} and ${(threshold.relative * 100).toFixed(0)}%`
        : `${(relative * 100).toFixed(1)}%, against a threshold of ${(threshold.relative * 100).toFixed(0)}%`,
      threshold,
    };
  }

  const failed = !clearsAbsolute
    ? `${formatValue(absolute, 'currency')} is below the ${formatValue(threshold.absoluteMinor, 'currency')} floor`
    : `${(relative * 100).toFixed(1)}% is below the ${(threshold.relative * 100).toFixed(0)}% threshold`;
  return { material: false, reason: failed, threshold };
}

/**
 * Priority, for a board item that has already cleared materiality.
 *
 * How far past the threshold it is, not how large it is: a £2m variance on revenue and a £2m variance
 * on cash are not equally urgent, and ranking by absolute size puts the biggest number at the top of
 * every list forever.
 */
export type Priority = 'high' | 'medium' | 'low';

export function priorityOf(
  comparison: MeasureWithComparison,
  classOf: MaterialityClass,
  policy: MaterialityPolicy = POLICY,
): Priority {
  const { current, comparativeValue } = comparison;
  if (current.value === null || comparativeValue === null || comparativeValue === 0) return 'low';
  const multiple = Math.abs((current.value - comparativeValue) / comparativeValue) / policy.thresholds[classOf].relative;
  if (multiple >= 3) return 'high';
  if (multiple >= 1.5) return 'medium';
  return 'low';
}
