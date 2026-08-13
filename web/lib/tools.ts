/**
 * What the model is allowed to look up.
 *
 * Five tools, and between them they are the only source of numbers in an answer. That is the grounding
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
 * `explain_finding` will answer about a finding that fired and will not invent one. And nothing here
 * projects: there is no tool that takes a future period, so a question inviting a forecast has no tool
 * that can serve it and the loop says so in words. That refusal is a designed capability, not a gap —
 * the product's own position is that a model may explain a forecast and may not make one.
 */

import type { ToolCall, ToolOutcome, ToolSpec } from '@demo-kit/llm';
import { MONTHS, SEGMENTS, entity, tradingEntities } from '@kestrel/model';
import {
  COMPARATORS,
  MEASURES,
  compareMeasure,
  computeMeasure,
  formatValue,
  measureIds,
} from '@kestrel/measures';
import { buildBridge, principalDriver, runDetectors } from '@kestrel/analysis';

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
  hrefForTarget,
  monthLabel,
  viewOf,
} from './world';

const MEASURE_IDS = measureIds();
const ENTITY_IDS = ['group', ...tradingEntities().map((e) => e.id)];
const SEGMENT_CODES = SEGMENTS.map((s) => s.code);

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
            'prior_period, prior_year, budget, forecast, or trend. Trend is a fitted line and nothing is material against it.',
        },
        month: { type: 'string' },
        entity: { type: 'string', enum: ENTITY_IDS },
        segment: { type: 'string', enum: [...SEGMENT_CODES] },
      },
      required: ['measure', 'against'],
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
      required: ['measure', 'against'],
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
];

/**
 * The questions offered whenever the loop cannot answer.
 *
 * Every one has to genuinely resolve against the tools above. A chip the demo then refuses is worse than
 * no chip — it turns a limitation into a broken promise.
 */
export const SUGGESTIONS: readonly string[] = [
  'What should I look at first this month?',
  'Why is revenue ahead of forecast?',
  'How is gross margin calculated, and who owns it?',
  'What is the cash position, and are there any risks to it?',
];

export const SYSTEM = [
  'You answer questions about a group finance workbench: five entities, a governed measure layer, and',
  'twelve detectors that run over it.',
  'Every figure you state must come from a tool call in this conversation. Never calculate, combine or',
  'estimate a number yourself — ask for it. `compare_measures` does the arithmetic for you.',
  'If a question asks you to forecast, project or predict, say plainly that you can explain a forecast',
  'the product holds but cannot make one, and stop.',
  'Quote the movement in the words the tool used, so a direction is never yours to interpret.',
  'Two to four sentences. British English. No preamble.',
].join('\n');

/** Bind the model's words to the same principal the tools enforce. */
export function systemFor(principal: Principal): string {
  return [
    SYSTEM,
    `You are answering as ${principal.label}.`,
    'The tools enforce this principal’s entity and dimension scope. If a tool refuses access, repeat',
    'that refusal plainly and do not retry the question against a different or broader entity.',
  ].join('\n');
}

function readString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  return typeof value === 'string' ? value : '';
}

/** The view a tool call resolves against, so a tool reads exactly what that principal's page would. */
function viewFor(input: Record<string, unknown>, principal: Principal) {
  const month = readString(input, 'month');
  const entityId = readString(input, 'entity');
  return viewOf({
    as: principal.id,
    ...(MONTHS.includes(month) ? { month } : {}),
    ...(ENTITY_IDS.includes(entityId) ? { entity: entityId } : {}),
  });
}

function focusHref(section: string, view: ReturnType<typeof viewOf>): string {
  const base = hrefFor('/app', view);
  return `${base}${base.includes('?') ? '&' : '?'}focus=${encodeURIComponent(section)}`;
}

function getMeasure(input: Record<string, unknown>, principal: Principal): ToolOutcome {
  const id = readString(input, 'measure');
  if (!MEASURE_IDS.includes(id)) {
    return { content: `No measure called "${id}".` };
  }
  const view = viewFor(input, principal);
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
      `${value.label} for ${where}${slice} in ${monthLabel(view.scope.endMonth)} is ` +
      `${formatValue(value.value, value.unit)}. It is defined as ${value.formula}, owned by ` +
      `${value.owner}${value.status === 'draft' ? ', and the definition is still draft' : ''}. ` +
      `${value.consolidated ? 'Consolidated, with intercompany eliminated.' : 'A combined slice, not consolidated.'}`,
    citations: [
      {
        label: `${value.label}, ${monthLabel(view.scope.endMonth)}`,
        value: formatValue(value.value, value.unit),
        href: focusHref('section-headline', view),
      },
    ],
  };
}

function compareMeasures(input: Record<string, unknown>, principal: Principal): ToolOutcome {
  const id = readString(input, 'measure');
  const against = readString(input, 'against');
  if (!MEASURE_IDS.includes(id)) return { content: `No measure called "${id}".` };
  if (!COMPARATORS.includes(against as (typeof COMPARATORS)[number])) {
    return { content: `No comparator called "${against}". They are ${COMPARATORS.join(', ')}.` };
  }

  const view = viewFor(input, principal);
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
  const choice =
    against === 'forecast'
      ? { id: 'forecast' as const, versionId: view.version.id }
      : against === 'budget'
        ? { id: 'budget' as const, versionId: 'budget-fy26' }
        : { id: against as 'prior_period' | 'prior_year' | 'trend' };

  const c = compareMeasure(id, ctx, choice);
  // The difference is calculated HERE so the model never has to. See the header.
  const money =
    c.current.value === null || c.comparativeValue === null
      ? null
      : c.current.value - c.comparativeValue;
  const direction =
    c.favourable === null ? 'a movement of' : c.favourable ? 'ahead by' : 'behind by';

  return {
    content:
      `${c.current.label} for ${entity(view.entityId).name} in ${monthLabel(view.scope.endMonth)} is ` +
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
        href: focusHref('section-headline', view),
      },
    ],
  };
}

function listFindings(input: Record<string, unknown>, principal: Principal): ToolOutcome {
  const view = viewFor(input, principal);
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
      content: `Nothing cleared the materiality policy for ${monthLabel(view.scope.endMonth)}${board === '' ? '' : ` on the ${board} board`}.`,
    };
  }

  const lines = wanted.map(
    (f) =>
      `${f.title} (${f.priority} priority, ${f.direction}/${f.horizon}, owner ${f.action.owner}): ${f.statement}`,
  );
  return {
    content: `${wanted.length} findings for ${monthLabel(view.scope.endMonth)}. ${lines.join(' ')}`,
    citations: wanted.slice(0, 4).map((f) => ({
      label: f.title,
      value: f.priority,
      href: hrefForTarget(f.action.href, view),
    })),
  };
}

function explainVariance(input: Record<string, unknown>, principal: Principal): ToolOutcome {
  const id = readString(input, 'measure');
  if (id !== 'revenue' && id !== 'cost_of_sales') {
    return {
      content:
        'Only revenue and cost of sales can be bridged: a decomposition into price, volume and mix needs ' +
        'quantities, and the other measures are not held by segment with a unit.',
    };
  }
  const against = readString(input, 'against');
  const view = viewFor(input, principal);
  const choice =
    against === 'forecast'
      ? { id: 'forecast' as const, versionId: view.version.id }
      : against === 'budget'
        ? { id: 'budget' as const, versionId: 'budget-fy26' }
        : {
            id: (against === 'prior_year' ? 'prior_year' : 'prior_period') as
              'prior_year' | 'prior_period',
          };

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
        label: `${bridge.label} bridge`,
        value: formatValue(bridge.to - bridge.from, 'currency'),
        href: hrefFor('/app/performance', view),
      },
    ],
  };
}

function describeMeasure(input: Record<string, unknown>, principal: Principal): ToolOutcome {
  const id = readString(input, 'measure');
  const definition = MEASURES.find((m) => m.id === id);
  if (definition === undefined) return { content: `No measure called "${id}".` };

  const view = viewOf({ as: principal.id });
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
        href: focusHref('section-headline', view),
      },
    ],
  };
}

export interface ToolAccess {
  readonly principal?: Principal;
}

/** The one entry point `ask` calls. An unknown name is a named answer, never a throw. */
export async function runTool(call: ToolCall, access: ToolAccess = {}): Promise<ToolOutcome> {
  const principal = access.principal ?? principalById(DEFAULT_PERSONA_ID);
  const requestedEntityId = readString(call.input, 'entity');
  if (ENTITY_IDS.includes(requestedEntityId)) {
    const permission = resolvePermissionScope(principal, requestedEntityId);
    if (!permission.allowed) return { content: permission.refusal };
  }

  switch (call.name) {
    case 'get_measure':
      return getMeasure(call.input, principal);
    case 'compare_measures':
      return compareMeasures(call.input, principal);
    case 'list_findings':
      return listFindings(call.input, principal);
    case 'explain_variance':
      return explainVariance(call.input, principal);
    case 'describe_measure':
      return describeMeasure(call.input, principal);
    default:
      return { content: `No tool called "${call.name}".` };
  }
}
