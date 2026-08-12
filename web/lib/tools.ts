/**
 * What the model is allowed to look up.
 *
 * Two tools, and between them they are the only source of numbers in an answer. That is the
 * grounding guarantee, and it is structural rather than instructional: the model cannot
 * produce a figure, it can only ask for one, and `@demo-kit/llm` then checks every numeral
 * in the finished answer against everything the tools returned.
 *
 * `compare_sites` exists because of the second half of that rule. Subtraction the model does
 * in its head is a figure no tool returned, so it fails the grounding check and the whole
 * answer is refused — correctly. Moving the arithmetic into a tool is what makes comparison
 * a question the demo can answer at all.
 *
 * A tool's `content` is what grounds the answer, so anything the reader may see quoted has
 * to be in the text. A citation on its own grounds nothing.
 */

import type { ToolCall, ToolOutcome, ToolSpec } from '@demo-kit/llm';
import { money, percent, units } from './format';
import { LATEST_MONTH, MONTHS, monthOf, siteByName, world } from './world';

const SITE_NAMES = ['North', 'South', 'East', 'Central'];

export const TOOLS: readonly ToolSpec[] = [
  {
    name: 'site_series',
    description:
      'Monthly dispatched volume and cost for one site, across all twelve months held by the demo. Use this for any question about how one site has moved.',
    input_schema: {
      type: 'object',
      properties: {
        site: { type: 'string', enum: SITE_NAMES, description: 'The site name.' },
      },
      required: ['site'],
    },
  },
  {
    name: 'compare_sites',
    description:
      'Two sites side by side in one month, with the difference already calculated. Use this rather than subtracting figures yourself — a difference you worked out is a figure no tool returned, and the answer will be refused.',
    input_schema: {
      type: 'object',
      properties: {
        a: { type: 'string', enum: SITE_NAMES, description: 'The first site.' },
        b: { type: 'string', enum: SITE_NAMES, description: 'The second site.' },
        month: {
          type: 'string',
          description: `A month id, e.g. "${LATEST_MONTH.id}". Defaults to the latest month held.`,
        },
      },
      required: ['a', 'b'],
    },
  },
];

/**
 * The questions offered whenever the loop cannot answer.
 *
 * Each one has to genuinely resolve, which with these two tools means naming the site it is
 * about — a chip the demo will then refuse is worse than no chip.
 */
export const SUGGESTIONS: readonly string[] = [
  'How has East moved over the year?',
  'Compare Central and North in the latest month.',
  'Which dispatched more in June, East or South?',
];

export const SYSTEM = [
  'You answer questions about a small operations demo covering four sites over twelve months.',
  'Every figure you state must come from a tool call in this conversation. Never calculate,',
  'combine or estimate a number yourself — ask for it. If the tools cannot answer the',
  'question, say so plainly and stop.',
  'Two or three sentences. British English. No preamble.',
].join('\n');

function readString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  return typeof value === 'string' ? value : '';
}

/** The href a reader follows to see the same figure on the page it is shown on. */
const seriesHref = '/app?focus=section-series';

function siteSeries(input: Record<string, unknown>): ToolOutcome {
  const site = siteByName(world(), readString(input, 'site'));
  if (site === undefined) {
    return { content: `No site called that. The sites are ${SITE_NAMES.join(', ')}.` };
  }
  const rows = site.months.map((row) => {
    const label = MONTHS.find((m) => m.id === row.month)?.label ?? row.month;
    return `${label}: ${units(row.volume)} units, ${money(row.cost)}`;
  });
  const first = site.months[0];
  const last = site.months[site.months.length - 1];
  const change =
    first === undefined || last === undefined
      ? ''
      : ` Across the twelve months the change is ${percent((last.volume - first.volume) / first.volume)}.`;

  return {
    content: `${site.name}, month by month — ${rows.join('; ')}.${change}`,
    citations: [
      { label: `${site.name}, ${LATEST_MONTH.label}`, value: `${units(last?.volume ?? 0)} units`, href: seriesHref },
    ],
  };
}

function compareSites(input: Record<string, unknown>): ToolOutcome {
  const monthId = readString(input, 'month') || LATEST_MONTH.id;
  const month = MONTHS.find((m) => m.id === monthId);
  if (month === undefined) {
    return { content: `No month called "${monthId}". The demo holds ${MONTHS[0]?.id} to ${LATEST_MONTH.id}.` };
  }

  const a = siteByName(world(), readString(input, 'a'));
  const b = siteByName(world(), readString(input, 'b'));
  if (a === undefined || b === undefined) {
    return { content: `Both sites must be named. The sites are ${SITE_NAMES.join(', ')}.` };
  }

  const rowA = monthOf(a, month.id);
  const rowB = monthOf(b, month.id);
  if (rowA === undefined || rowB === undefined) {
    return { content: `No figures for ${month.label}.` };
  }

  // The difference is calculated HERE so the model never has to. See the header.
  const gap = rowA.volume - rowB.volume;
  const rate = rowB.volume === 0 ? 0 : gap / rowB.volume;

  return {
    content:
      `In ${month.label}, ${a.name} dispatched ${units(rowA.volume)} units at ${money(rowA.cost)} and ` +
      `${b.name} dispatched ${units(rowB.volume)} units at ${money(rowB.cost)}. ` +
      `${a.name} is ahead by ${units(Math.abs(gap))} units, ${percent(rate)} against ${b.name}.`,
    citations: [
      { label: `${a.name}, ${month.label}`, value: `${units(rowA.volume)} units`, href: seriesHref },
      { label: `${b.name}, ${month.label}`, value: `${units(rowB.volume)} units`, href: seriesHref },
    ],
  };
}

/** The one entry point `ask` calls. An unknown name is a named answer, never a throw. */
export async function runTool(call: ToolCall): Promise<ToolOutcome> {
  switch (call.name) {
    case 'site_series':
      return siteSeries(call.input);
    case 'compare_sites':
      return compareSites(call.input);
    default:
      return { content: `No tool called "${call.name}".` };
  }
}
