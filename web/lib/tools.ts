/**
 * What the model is allowed to look up.
 *
 * Eight tools, and between them they are the only source of numbers in an answer. That is the grounding
 * guarantee, and it is structural rather than instructional: the model cannot produce a figure, it can
 * only ask for one, and `@demo-kit/llm` then checks every numeral in the finished answer against
 * everything the tools returned.
 *
 * ## Why `compare_measures` exists
 *
 * Because of the second half of that rule. A subtraction the model does in its head is a figure no tool
 * returned, so it fails the grounding check and the whole answer is refused — correctly, and uselessly,
 * since "how does revenue compare to forecast" is the commonest question there is. Moving the arithmetic
 * into a tool is what makes comparison answerable at all. Every difference, every percentage and every
 * variance in an answer was computed by the measure layer, not by a language model.
 *
 * ## Why the tools return prose and not JSON
 *
 * A tool's `content` is what grounds the answer, so anything a reader may see quoted has to be in the
 * text. It also solves a problem the grounding check cannot: the check compares unsigned numerals, so it
 * cannot catch a *direction* error — a model saying revenue fell 5.4% when it rose 5.4% passes. Returning
 * the movement already worded gives the model a sentence to quote rather than a sign to interpret.
 *
 * ## What the tools refuse
 *
 * Findings come only from detectors that fired; versions come only from the stored version set; and a
 * future period is not a readable parameter. The one sensitivity tool accepts only the explicitly
 * requested, governed revenue-down-8% case. It does not let the model select an assumption. So the loop
 * may explain a stored forecast or run that closed sensitivity and must refuse to invent a prediction.
 */

import type { ToolCall, ToolOutcome, ToolSpec } from '@demo-kit/llm';
import { MONTHS, SEGMENTS, entity, tradingEntities } from '@kestrel/model';
import type { SegmentCode } from '@kestrel/model';
import {
  COMPARATORS,
  MEASURES,
  compareMeasure,
  computeMeasure,
  formatValue,
  measureIds,
} from '@kestrel/measures';
import type { ComparatorChoice, ComparatorId } from '@kestrel/measures';
import {
  buildBridge,
  cashSensitivity,
  grossProfitBridge,
  principalDriver,
  runDetectors,
  versionDiff,
} from '@kestrel/analysis';

import type { Principal } from './permissions';
import {
  DEFAULT_PERSONA_ID,
  principalById,
  resolveDimensionScope,
  resolvePermissionScope,
} from './permissions';
import {
  LATEST_MONTH,
  contextOf,
  detectorContextOf,
  hrefFor,
  paramsForView,
  scopeLabel,
  viewOf,
} from './world';
import type { View } from './world';

const MEASURE_IDS = measureIds();
const ENTITY_IDS = ['group', ...tradingEntities().map((e) => e.id)];
const SEGMENT_CODES = SEGMENTS.map((s) => s.code);
const FORECAST_VERSION_IDS = ['v4', 'v5', 'v6', 'v7'] as const;

/**
 * Canonical reporting subjects for the demo-kit's attribution guard.
 *
 * Keep these as complete entity names: overlapping fragments such as "Kestrel" would let a
 * group figure appear to have come from any subsidiary whose name shares that word.
 */
export const ASK_SUBJECTS: readonly string[] = [
  entity('group').name,
  ...tradingEntities().map((item) => item.name),
];

export const TOOLS: readonly ToolSpec[] = [
  {
    name: 'get_measure',
    description:
      'One measure for one period, for the signed-in principal’s permitted root or one entity beneath it, optionally sliced to a segment. Returns the value, what it is made of, and who owns the definition. Use this for any "what was X" question.',
    input_schema: {
      type: 'object',
      properties: {
        measure: { type: 'string', enum: [...MEASURE_IDS], description: 'The measure id.' },
        month: {
          type: 'string',
          description: `A month, e.g. "${LATEST_MONTH}". Defaults to the latest closed month.`,
        },
        entity: {
          type: 'string',
          enum: ENTITY_IDS,
          description: 'Defaults to the signed-in principal’s permitted entity root.',
        },
        segment: {
          type: 'string',
          enum: [...SEGMENT_CODES],
          description: 'Optional segment slice.',
        },
      },
      required: ['measure'],
    },
  },
  {
    name: 'compare_measures',
    description:
      'One measure against a comparator, with the variance already calculated. Use this rather than subtracting two figures yourself — a difference you worked out is a figure no tool returned, and the answer will be refused.',
    input_schema: {
      type: 'object',
      properties: {
        measure: { type: 'string', enum: [...MEASURE_IDS] },
        against: {
          type: 'string',
          enum: [...COMPARATORS],
          description:
            'Defaults to the comparator selected on the page. Otherwise prior_period, prior_year, budget, forecast, or trend. Trend is a fitted line and nothing is material against it.',
        },
        month: { type: 'string' },
        entity: { type: 'string', enum: ENTITY_IDS },
        segment: { type: 'string', enum: [...SEGMENT_CODES] },
      },
      required: ['measure'],
    },
  },
  {
    name: 'list_findings',
    description:
      'Everything the detectors found for a period, with each finding’s board, priority and the figures behind it. Use this for "what should I look at", "what went wrong" or "what are the risks".',
    input_schema: {
      type: 'object',
      properties: {
        month: { type: 'string' },
        entity: { type: 'string', enum: ENTITY_IDS },
        board: {
          type: 'string',
          enum: ['attention', 'performance', 'risks', 'opportunities'],
          description: 'Optional: one board rather than all four.',
        },
      },
      required: [],
    },
  },
  {
    name: 'explain_variance',
    description:
      'The bridge behind a revenue or cost-of-sales variance: price, volume, mix, currency and the unsegmented remainder, summing to the total. Use this for any "why" question about revenue or cost.',
    input_schema: {
      type: 'object',
      properties: {
        measure: { type: 'string', enum: ['revenue', 'cost_of_sales'] },
        against: { type: 'string', enum: ['prior_period', 'prior_year', 'budget', 'forecast'] },
        month: { type: 'string' },
        entity: { type: 'string', enum: ENTITY_IDS },
      },
      required: ['measure'],
    },
  },
  {
    name: 'describe_measure',
    description:
      'What a measure means: its formula, its owner, whether the definition is approved or still draft, and which accounts it reads. Use this for "how is X calculated" or "who owns X".',
    input_schema: {
      type: 'object',
      properties: { measure: { type: 'string', enum: [...MEASURE_IDS] } },
      required: ['measure'],
    },
  },
  {
    name: 'explain_ebitda',
    description:
      'An exact EBITDA bridge: the governed gross-profit price/volume/mix bridge plus the operating-expense movement. Use this for "why is EBITDA ahead of forecast?" It first says whether the premise is true, then returns components that sum to the monetary movement.',
    input_schema: {
      type: 'object',
      properties: {
        against: {
          type: 'string',
          enum: ['prior_period', 'prior_year', 'budget', 'forecast'],
          description: 'Defaults to the comparator selected on the page unless that is trend.',
        },
      },
      required: [],
    },
  },
  {
    name: 'cash_sensitivity',
    description:
      'The deterministic thirteen-week cash effect of the explicitly requested 8% revenue fall, split into margin effect and working-capital release. This is a closed sensitivity the product holds, not a prediction or an assumption selected by the model.',
    input_schema: {
      type: 'object',
      properties: {
        revenue_change_percent: {
          type: 'number',
          enum: [-8],
          description: '-8 for the governed revenue-down-8% sensitivity.',
        },
      },
      required: ['revenue_change_percent'],
    },
  },
  {
    name: 'compare_versions',
    description:
      'The governed assumption changes and total measure impacts between two stored forecast versions. Use this for "which drivers changed since v6?"; it compares forecasts the product already holds and makes no prediction.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', enum: [...FORECAST_VERSION_IDS] },
        to: { type: 'string', enum: [...FORECAST_VERSION_IDS] },
      },
      required: ['from', 'to'],
    },
  },
];

/**
 * The questions offered whenever the loop cannot answer.
 *
 * Every one has to genuinely resolve against the tools above. A chip the demo then refuses is worse than
 * no chip — it turns a limitation into a broken promise.
 */
export const SUGGESTIONS: readonly string[] = [
  'Why is EBITDA ahead of forecast?',
  'What happens to cash if revenue falls 8%?',
  'Which drivers changed since forecast v6?',
  'Draft July Board commentary with risks and opportunities.',
];

export const SYSTEM = [
  'You answer questions about a group finance workbench: five entities, a governed measure layer, and',
  'twelve detectors that run over it.',
  'Every figure you state must come from a tool call in this conversation. Never calculate, combine or',
  'estimate a number yourself — ask for it. `compare_measures` does the arithmetic for you.',
  'You may explain a stored forecast, compare stored versions, or calculate a bounded scenario with a',
  'tool. If asked to invent a prediction or choose assumptions yourself, say plainly that you cannot.',
  'Quote the movement in the words the tool used, so a direction is never yours to interpret.',
  'Two to four sentences. British English. No preamble.',
].join('\n');

/** Bind the model's words to the same resolved finance view the tools enforce. */
export function systemFor(view: View): string {
  return [
    SYSTEM,
    `You are answering as ${view.principal.label}.`,
    `The selected view is ${scopeLabel(view.periodKind, view.scope)} for ${entity(view.entityId).name},`,
    `against ${view.comparator.id.replaceAll('_', ' ')}, using the ${view.lens} currency lens and version ${view.version.id}.`,
    'Treat that selected view as the default for every tool call. Change a field only when the reader',
    'explicitly asks about a different period, comparator or permitted entity.',
    'The tools enforce this principal’s entity and dimension scope. If a tool refuses access, repeat',
    'that refusal plainly and do not retry the question against a different or broader entity.',
  ].join('\n');
}

function readString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  return typeof value === 'string' ? value : '';
}

function readNumber(input: Record<string, unknown>, key: string): number | null {
  const value = input[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The view a tool call resolves against, so a tool reads exactly what that principal's page would. */
function viewFor(input: Record<string, unknown>, base: View): View {
  const month = readString(input, 'month');
  const entityId = readString(input, 'entity');
  return viewOf(
    {
      ...paramsForView(base),
      as: base.principal.id,
      ...(MONTHS.includes(month) ? { month } : {}),
      ...(ENTITY_IDS.includes(entityId) ? { entity: entityId } : {}),
    },
    { allowDataScenario: true },
  );
}

function sectionHref(
  path: string,
  section: string,
  view: View,
  changes: Parameters<typeof hrefFor>[2] = {},
): string {
  const base = hrefFor(path, view, changes);
  return `${base}${base.includes('?') ? '&' : '?'}focus=${encodeURIComponent(section)}`;
}

/** An Ask citation that renders this exact measure, reporting scope, comparator and formula. */
function measureEvidenceHref(
  measureId: string,
  view: View,
  options: { readonly comparatorId?: ComparatorId; readonly segmentId?: SegmentCode } = {},
): string {
  const origin = 'https://finance-workbench.invalid';
  const url = new URL(
    hrefFor(
      '/app/explore',
      view,
      options.comparatorId === undefined ? {} : { comparator: options.comparatorId },
    ),
    origin,
  );
  url.searchParams.set('rows', 'measure');
  url.searchParams.set('cols', 'period');
  url.searchParams.set('measure', measureId);
  if (options.segmentId !== undefined) url.searchParams.set('segment', options.segmentId);
  url.searchParams.set('focus', 'section-cited-measure');
  return `${url.pathname}${url.search}`;
}

/** Evidence for a finding is its closed figure set; its action remains a separate decision link. */
function findingEvidenceHref(fingerprint: string, view: View): string {
  const origin = 'https://finance-workbench.invalid';
  const url = new URL(hrefFor('/app', view), origin);
  url.searchParams.set('finding', fingerprint);
  url.searchParams.set('focus', 'section-finding-evidence');
  return `${url.pathname}${url.search}`;
}

function comparatorChoice(id: string, view: View): ComparatorChoice | null {
  switch (id) {
    case 'forecast':
      return { id: 'forecast', versionId: view.version.id };
    case 'budget':
      return { id: 'budget', versionId: 'budget-fy26' };
    case 'prior_period':
    case 'prior_year':
    case 'trend':
      return { id };
    default:
      return null;
  }
}

/** Phrase a signed money contribution so the model never has to interpret a sign. */
function contribution(label: string, value: number): string {
  return value < 0
    ? `${label} reduced EBITDA by ${formatValue(Math.abs(value), 'currency')}`
    : `${label} added ${formatValue(value, 'currency')} to EBITDA`;
}

function getMeasure(input: Record<string, unknown>, base: View): ToolOutcome {
  const id = readString(input, 'measure');
  if (!MEASURE_IDS.includes(id)) {
    return { content: `No measure called "${id}".` };
  }
  const view = viewFor(input, base);
  const requestedSegment = readString(input, 'segment');
  const dimensions = resolveDimensionScope(
    view.permission,
    SEGMENT_CODES.includes(requestedSegment as (typeof SEGMENT_CODES)[number])
      ? { segmentId: requestedSegment as (typeof SEGMENT_CODES)[number] }
      : {},
  );
  if (!dimensions.allowed) return { content: dimensions.refusal };
  const segment = dimensions.filters.segmentId;
  const ctx = {
    ...contextOf(view),
    ...dimensions.filters,
  };
  const value = computeMeasure(id, ctx);
  const where = entity(view.entityId).name;
  const slice = segment === undefined ? '' : ` for the ${segment} segment`;

  return {
    content:
      `${value.label} for ${where}${slice} in ${scopeLabel(view.periodKind, view.scope)} is ` +
      `${formatValue(value.value, value.unit)}. It is defined as ${value.formula}, owned by ` +
      `${value.owner}${value.status === 'draft' ? ', and the definition is still draft' : ''}. ` +
      `${value.consolidated ? 'Consolidated, with intercompany eliminated.' : 'A combined slice, not consolidated.'}`,
    citations: [
      {
        label: `${value.label}, ${scopeLabel(view.periodKind, view.scope)}`,
        value: formatValue(value.value, value.unit),
        href: measureEvidenceHref(id, view, { segmentId: segment }),
      },
    ],
  };
}

function compareMeasures(input: Record<string, unknown>, base: View): ToolOutcome {
  const id = readString(input, 'measure');
  const view = viewFor(input, base);
  const against = readString(input, 'against') || view.comparator.id;
  if (!MEASURE_IDS.includes(id)) return { content: `No measure called "${id}".` };
  if (!COMPARATORS.includes(against as (typeof COMPARATORS)[number])) {
    return { content: `No comparator called "${against}". They are ${COMPARATORS.join(', ')}.` };
  }

  const requestedSegment = readString(input, 'segment');
  const dimensions = resolveDimensionScope(
    view.permission,
    SEGMENT_CODES.includes(requestedSegment as (typeof SEGMENT_CODES)[number])
      ? { segmentId: requestedSegment as (typeof SEGMENT_CODES)[number] }
      : {},
  );
  if (!dimensions.allowed) return { content: dimensions.refusal };
  const ctx = {
    ...contextOf(view),
    ...dimensions.filters,
  };
  const choice = comparatorChoice(against, view);
  if (choice === null) return { content: `No comparator called "${against}".` };

  const c = compareMeasure(id, ctx, choice);
  // The difference is calculated HERE so the model never has to. See the header.
  const money =
    c.current.value === null || c.comparativeValue === null
      ? null
      : c.current.value - c.comparativeValue;
  const direction =
    c.favourable === null ? 'a movement of' : c.favourable ? 'ahead by' : 'behind by';
  const slice = dimensions.filters.segmentId;
  const sliceWords = slice === undefined ? '' : ` for the ${slice} segment`;

  return {
    content:
      `${c.current.label} for ${entity(view.entityId).name}${sliceWords} in ${scopeLabel(view.periodKind, view.scope)} is ` +
      `${formatValue(c.current.value, c.current.unit)} against ` +
      `${formatValue(c.comparativeValue, c.current.unit)} — ${direction} ` +
      `${formatValue(money === null ? null : Math.abs(money), c.current.unit)}, ` +
      `${formatValue(c.movement === null ? null : Math.abs(c.movement), c.movementUnit)} in relative terms. ` +
      `The comparison is against ${c.comparator.basis}.` +
      (c.comparator.admissibleForMateriality
        ? ''
        : ' This is a fitted expectation rather than a plan anybody committed to, so nothing is measured as material against it.'),
    citations: [
      {
        label: `${c.current.label} vs ${c.comparator.label}`,
        value: formatValue(c.current.value, c.current.unit),
        href: measureEvidenceHref(id, view, {
          comparatorId: choice.id,
          segmentId: slice,
        }),
      },
    ],
  };
}

function listFindings(input: Record<string, unknown>, base: View): ToolOutcome {
  const view = viewFor(input, base);
  const board = readString(input, 'board');
  const run = runDetectors(detectorContextOf(view));
  const wanted =
    board === ''
      ? run.findings
      : run.findings.filter((f) => {
          const id =
            f.direction === 'adverse'
              ? f.horizon === 'current'
                ? 'attention'
                : 'risks'
              : f.horizon === 'current'
                ? 'performance'
                : 'opportunities';
          return id === board;
        });

  if (wanted.length === 0) {
    return {
      content: `Nothing cleared the materiality policy for ${scopeLabel(view.periodKind, view.scope)}${board === '' ? '' : ` on the ${board} board`}.`,
    };
  }

  const lines = wanted.map(
    (f) =>
      `${f.title} (${f.priority} priority, ${f.direction}/${f.horizon}, owner ${f.action.owner}): ${f.statement}`,
  );
  return {
    content: `${wanted.length} findings for ${scopeLabel(view.periodKind, view.scope)}. ${lines.join(' ')}`,
    citations: wanted.slice(0, 4).map((f) => {
      const figure = f.figures.find((candidate) => candidate.value !== null);
      return {
        label: f.title,
        value:
          figure === undefined ? f.priority : formatValue(figure.value, figure.unit),
        href: findingEvidenceHref(f.fingerprint, view),
      };
    }),
  };
}

function explainVariance(input: Record<string, unknown>, base: View): ToolOutcome {
  const id = readString(input, 'measure');
  if (id !== 'revenue' && id !== 'cost_of_sales') {
    return {
      content:
        'Only revenue and cost of sales can be bridged: a decomposition into price, volume and mix needs ' +
        'quantities, and the other measures are not held by segment with a unit.',
    };
  }
  const view = viewFor(input, base);
  const against = readString(input, 'against') || view.comparator.id;
  if (against === 'trend') {
    return {
      content:
        'A fitted trend cannot be bridged because it has no recorded quantities or version behind it. ' +
        'Choose prior period, prior year, budget or forecast for an attributable variance.',
    };
  }
  const choice = comparatorChoice(against, view);
  if (choice === null || choice.id === 'trend') {
    return { content: `No attributable comparator called "${against}".` };
  }

  const bridge = buildBridge({ measureId: id, ctx: contextOf(view), comparator: choice });
  const mainDriver = principalDriver(bridge);
  const bars = bridge.bars
    .filter((b) => b.kind !== 'opening' && b.kind !== 'closing')
    .map(
      (b) => `${b.label} ${b.value < 0 ? '−' : '+'}${formatValue(Math.abs(b.value), 'currency')}`,
    );

  return {
    content:
      `${bridge.label} moved from ${formatValue(bridge.from, 'currency')} to ` +
      `${formatValue(bridge.to, 'currency')} against ${bridge.comparator.basis}. ` +
      `The decomposition is: ${bars.join(', ')}. ` +
      (mainDriver === undefined
        ? ''
        : `The largest single component is ${mainDriver.label.toLowerCase()} at ${formatValue(Math.abs(mainDriver.value), 'currency')}. `) +
      (bridge.sums
        ? 'These sum to the movement exactly.'
        : 'These do not sum to the movement, so the decomposition is incomplete.'),
    citations: [
      {
        label: `${bridge.label}, current`,
        value: formatValue(bridge.to, 'currency'),
        href: sectionHref('/app/performance', 'section-bridge', view, {
          comparator: choice.id,
        }),
      },
    ],
  };
}

function explainEbitda(input: Record<string, unknown>, base: View): ToolOutcome {
  const view = viewFor(input, base);
  const against = readString(input, 'against') || view.comparator.id;
  const choice = comparatorChoice(against, view);
  if (choice === null || choice.id === 'trend') {
    return {
      content:
        'A fitted trend cannot explain EBITDA because it has no recorded quantities or version behind ' +
        'it. Choose prior period, prior year, budget or forecast for an exact bridge.',
    };
  }

  const ctx = contextOf(view);
  const ebitda = compareMeasure('ebitda', ctx, choice);
  const opex = compareMeasure('opex', ctx, choice);
  const grossProfit = grossProfitBridge({ ctx, comparator: choice });
  const money =
    ebitda.current.value === null || ebitda.comparativeValue === null
      ? null
      : ebitda.current.value - ebitda.comparativeValue;
  const opexContribution =
    opex.current.value === null || opex.comparativeValue === null
      ? 0
      : opex.comparativeValue - opex.current.value;
  const components = grossProfit.bars
    .filter(
      (bar) =>
        bar.kind !== 'opening' && bar.kind !== 'closing' && Math.round(bar.value) !== 0,
    )
    .map((bar) => ({ label: bar.label, value: bar.value }));
  components.push({ label: 'Operating expense', value: opexContribution });
  const componentTotal = components.reduce((sum, item) => sum + item.value, 0);
  const sums = money !== null && Math.round(componentTotal) === Math.round(money);
  const premise =
    money === null
      ? 'has no comparable value'
      : money < 0
        ? `is behind, not ahead, by ${formatValue(Math.abs(money), 'currency')}`
        : money > 0
          ? `is ahead by ${formatValue(money, 'currency')}`
          : 'is exactly on the comparator';

  return {
    content:
      `EBITDA for ${entity(view.entityId).name} in ${scopeLabel(view.periodKind, view.scope)} is ` +
      `${formatValue(ebitda.current.value, 'currency')} against ` +
      `${formatValue(ebitda.comparativeValue, 'currency')}, so it ${premise}. ` +
      `The comparison is against ${ebitda.comparator.basis}. ` +
      `The exact contributors are: ${components.map((item) => contribution(item.label, item.value)).join('; ')}. ` +
      (sums
        ? money !== null && money < 0
          ? `Together they reduce EBITDA by ${formatValue(Math.abs(componentTotal), 'currency')} and sum to the EBITDA movement exactly.`
          : `Together they add ${formatValue(Math.abs(componentTotal), 'currency')} to EBITDA and sum to the EBITDA movement exactly.`
        : 'The components do not sum to the EBITDA movement, so the explanation is incomplete.'),
    citations: [
      {
        label: `EBITDA vs ${ebitda.comparator.label}`,
        value: formatValue(money, 'currency'),
        href: measureEvidenceHref('ebitda', view, { comparatorId: choice.id }),
      },
      {
        label: 'Gross profit bridge',
        value: formatValue(grossProfit.to, 'currency'),
        href: sectionHref('/app/performance', 'section-margin', view, {
          comparator: choice.id,
        }),
      },
    ],
  };
}

function cashSensitivityAnswer(input: Record<string, unknown>, base: View): ToolOutcome {
  const requestedPercent = readNumber(input, 'revenue_change_percent');
  if (requestedPercent !== -8) {
    return {
      content:
        'This closed fact set contains the governed revenue-down-8% sensitivity only. It cannot ' +
        'choose or invent a different assumption.',
    };
  }

  const sensitivity = cashSensitivity(contextOf(base), requestedPercent / 100);
  const revenueWords =
    sensitivity.revenueChange < 0
      ? `revenue falls by ${formatValue(Math.abs(sensitivity.revenueChange), 'currency')}`
      : `revenue rises by ${formatValue(sensitivity.revenueChange, 'currency')}`;
  const marginWords =
    sensitivity.marginEffect < 0
      ? `the lost margin reduces cash by ${formatValue(Math.abs(sensitivity.marginEffect), 'currency')}`
      : `the margin adds ${formatValue(sensitivity.marginEffect, 'currency')} to cash`;
  const workingCapitalWords =
    sensitivity.workingCapitalRelease < 0
      ? `working capital reduces cash by ${formatValue(Math.abs(sensitivity.workingCapitalRelease), 'currency')}`
      : `the receivable release adds ${formatValue(sensitivity.workingCapitalRelease, 'currency')} to cash`;
  const netWords =
    sensitivity.netCashEffect < 0
      ? `cash falls by ${formatValue(Math.abs(sensitivity.netCashEffect), 'currency')}`
      : `cash rises by ${formatValue(sensitivity.netCashEffect, 'currency')}`;

  return {
    content:
      `For ${entity(base.entityId).name} in ${scopeLabel(base.periodKind, base.scope)}, the explicit ` +
      `${formatValue(requestedPercent / 100, 'percent')} revenue sensitivity means ${revenueWords}. ` +
      `Over ${sensitivity.horizonWeeks} weeks, ${marginWords}; ${workingCapitalWords}; net, ${netWords}. ` +
      'This is a deterministic sensitivity using the selected view’s measured gross margin and ' +
      'collection days, not a forecast or an assumption chosen by the model.',
    citations: [
      {
        label: `${sensitivity.horizonWeeks}-week cash sensitivity`,
        value: formatValue(sensitivity.netCashEffect, 'currency'),
        href: sectionHref('/app/cash', 'section-sensitivity', base),
      },
    ],
  };
}

function compareVersions(input: Record<string, unknown>, base: View): ToolOutcome {
  const fromId = readString(input, 'from');
  const toId = readString(input, 'to');
  if (!FORECAST_VERSION_IDS.includes(fromId as (typeof FORECAST_VERSION_IDS)[number])) {
    return { content: `No stored forecast version called "${fromId}".` };
  }
  if (!FORECAST_VERSION_IDS.includes(toId as (typeof FORECAST_VERSION_IDS)[number])) {
    return { content: `No stored forecast version called "${toId}".` };
  }

  const diff = versionDiff(fromId, toId, contextOf(base));
  const changes = diff.changes.map((change) => {
    const moves = change.moves.length === 0 ? 'no governed driver edge' : change.moves.join(', ');
    return (
      `${change.label} moved ${change.direction} from ${formatValue(change.from, change.unit)} to ` +
      `${formatValue(change.to, change.unit)}; owner ${change.owner}; moves ${moves}`
    );
  });
  const impacts = diff.impact.map(
    (impact) =>
      `${impact.label} moved from ${formatValue(impact.from, impact.unit)} to ` +
      `${formatValue(impact.to, impact.unit)}, a total movement of ` +
      `${formatValue(impact.movement, impact.movementUnit)}`,
  );

  const hrefBase = hrefFor('/app/forecast', base, { version: toId });
  const hrefParams = new URLSearchParams();
  hrefParams.set('from', fromId);
  hrefParams.set('focus', 'section-diff');
  const href = `${hrefBase}${hrefBase.includes('?') ? '&' : '?'}${hrefParams.toString()}`;

  return {
    content:
      `${diff.from.label} to ${diff.to.label} for ${entity(base.entityId).name} in ` +
      `${scopeLabel(base.periodKind, base.scope)} changed ${diff.changes.length} assumptions. ` +
      `${changes.length === 0 ? 'No assumption changed.' : changes.join('. ')}. ` +
      `The exact total effects of all changes together are: ${impacts.join('; ')}. ` +
      diff.attributionNote,
    citations: [
      {
        label: `${diff.from.label} to ${diff.to.label}`,
        value: `${diff.changes.length} assumptions`,
        href,
      },
      ...diff.impact.map((impact) => ({
        label: `${impact.label}, ${diff.from.id} to ${diff.to.id}`,
        value: formatValue(impact.movement, impact.movementUnit),
        href,
      })),
    ],
  };
}

function describeMeasure(input: Record<string, unknown>, base: View): ToolOutcome {
  const id = readString(input, 'measure');
  const definition = MEASURES.find((m) => m.id === id);
  if (definition === undefined) return { content: `No measure called "${id}".` };

  const view = base;
  const value = computeMeasure(id, contextOf(view));
  const accounts = value.inputs.map((i) => i.accountId).join(', ');

  return {
    content:
      `${definition.label} is ${definition.formula}. It is owned by ${definition.owner} and the ` +
      `definition is ${definition.status}. ` +
      `${definition.polarity === 'neutral' ? 'It is neither good nor bad on its own.' : definition.polarity === 'higher_is_better' ? 'Higher is better.' : 'Lower is better.'} ` +
      `It reads these accounts: ${accounts}.` +
      (definition.note === undefined ? '' : ` ${definition.note}`),
    citations: [
      {
        label: definition.label,
        value: definition.formula,
        href: measureEvidenceHref(id, view),
      },
    ],
  };
}

export interface ToolAccess {
  readonly principal?: Principal;
  /** The selected finance view Ask inherited from the page. */
  readonly view?: View;
}

/** The one entry point `ask` calls. An unknown name is a named answer, never a throw. */
export async function runTool(call: ToolCall, access: ToolAccess = {}): Promise<ToolOutcome> {
  const principal =
    access.principal ?? access.view?.principal ?? principalById(DEFAULT_PERSONA_ID);
  // Re-resolve every supplied view through the actual-only boundary. Callers can construct an Explore
  // view in memory, so clamping only the HTTP route would leave `runTool` itself as a wider read path.
  const base =
    access.view === undefined
      ? viewOf({ as: principal.id })
      : viewOf({ ...paramsForView(access.view), as: principal.id });
  const requestedEntityId = readString(call.input, 'entity');
  if (ENTITY_IDS.includes(requestedEntityId)) {
    const permission = resolvePermissionScope(principal, requestedEntityId);
    if (!permission.allowed) return { content: permission.refusal };
  }

  switch (call.name) {
    case 'get_measure':
      return getMeasure(call.input, base);
    case 'compare_measures':
      return compareMeasures(call.input, base);
    case 'list_findings':
      return listFindings(call.input, base);
    case 'explain_variance':
      return explainVariance(call.input, base);
    case 'describe_measure':
      return describeMeasure(call.input, base);
    case 'explain_ebitda':
      return explainEbitda(call.input, base);
    case 'cash_sensitivity':
      return cashSensitivityAnswer(call.input, base);
    case 'compare_versions':
      return compareVersions(call.input, base);
    default:
      return { content: `No tool called "${call.name}".` };
  }
}
