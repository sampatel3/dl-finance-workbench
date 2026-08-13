import { describe, expect, it } from 'vitest';

import {
  ask,
  type AnthropicCreateParams,
  type AnthropicLike,
  type AnthropicMessageResult,
} from '@demo-kit/llm';

import { ASK_SUBJECTS, SUGGESTIONS, TOOLS, runTool, systemFor } from './tools';
import { viewOf } from './world';

function answer(text: string): AnthropicMessageResult {
  return { content: [{ type: 'text', text }], stop_reason: 'end_turn' };
}

function toolCalls(
  calls: readonly { id: string; name: string; input: Record<string, unknown> }[],
): AnthropicMessageResult {
  return {
    content: calls.map((call) => ({ type: 'tool_use' as const, ...call })),
    stop_reason: 'tool_use',
  };
}

function fakeClient(responses: readonly AnthropicMessageResult[]): AnthropicLike {
  let index = 0;
  return {
    messages: {
      create: async () => {
        const response = responses[index];
        index += 1;
        if (response === undefined) throw new Error('scripted client ran out of responses');
        return response;
      },
    },
  };
}

const selectedView = viewOf();

async function runQuestion(
  question: string,
  responses: readonly AnthropicMessageResult[],
) {
  return ask({
    question,
    system: systemFor(selectedView),
    tools: TOOLS,
    runTool: (call) => runTool(call, { view: selectedView }),
    subjects: ASK_SUBJECTS,
    suggestions: SUGGESTIONS,
    client: fakeClient(responses),
    log: () => {},
  });
}

describe('Ask runs the four illustrated questions through the guarded loop', () => {
  it.each([
    {
      question: SUGGESTIONS[0] ?? '',
      calls: [{ id: 'ebitda', name: 'explain_ebitda', input: { against: 'forecast' } }],
      final: 'EBITDA is behind the selected plan. The cited bridge lists the exact contributors.',
      expectedCalls: 1,
    },
    {
      question: SUGGESTIONS[1] ?? '',
      calls: [
        {
          id: 'cash',
          name: 'cash_sensitivity',
          input: { revenue_change_percent: -8 },
        },
      ],
      final:
        'Revenue falls in the governed sensitivity. Cash falls after the margin and receivables effects shown in the cited result.',
      expectedCalls: 1,
    },
    {
      question: SUGGESTIONS[2] ?? '',
      calls: [
        { id: 'versions', name: 'compare_versions', input: { from: 'v6', to: 'v7' } },
      ],
      final:
        'The stored versions contain changed assumptions. Their governed total effects are in the cited comparison.',
      expectedCalls: 1,
    },
    {
      question: SUGGESTIONS[3] ?? '',
      calls: [
        {
          id: 'risks',
          name: 'list_findings',
          input: { month: '2026-07', board: 'risks' },
        },
        {
          id: 'opportunities',
          name: 'list_findings',
          input: { month: '2026-07', board: 'opportunities' },
        },
      ],
      final:
        'The July Board draft contains the returned risks and opportunities for the selected reporting view.',
      expectedCalls: 2,
    },
  ])('$question', async ({ question, calls, final, expectedCalls }) => {
    const reply = await runQuestion(question, [toolCalls(calls), answer(final)]);

    expect(reply.kind).toBe('chat');
    if (reply.kind !== 'chat') return;
    expect(reply.answer).toBe(final);
    expect(reply.toolCalls).toBe(expectedCalls);
    expect(reply.used.length).toBeGreaterThan(0);
    expect(
      reply.used.every(
        (citation) =>
          citation.href !== null &&
          new URL(citation.href, 'https://demo.invalid').pathname.startsWith('/app'),
      ),
    ).toBe(true);
  });
});

describe('Ask applies the current demo-kit answer guards to finance subjects', () => {
  it('refuses a real subsidiary figure restated as a group figure', async () => {
    let turn = 0;
    let gulfFigure = '';
    const client: AnthropicLike = {
      messages: {
        create: async (params: AnthropicCreateParams) => {
          turn += 1;
          if (turn === 1) {
            return toolCalls([
              { id: 'gulf-revenue', name: 'get_measure', input: { measure: 'revenue', entity: 'gulf' } },
            ]);
          }
          if (gulfFigure === '') {
            const results = JSON.stringify(params.messages.at(-1)?.content ?? '');
            gulfFigure = results.match(/£[\d,.]+[mk]?/i)?.[0] ?? '';
            if (gulfFigure === '') {
              throw new Error('Gulf result did not contain a rendered figure');
            }
          }
          return answer(`Kestrel Industrial Group plc revenue is ${gulfFigure}.`);
        },
      },
    };

    const reply = await ask({
      question: 'What was Gulf revenue?',
      system: systemFor(selectedView),
      tools: TOOLS,
      runTool: (call) => runTool(call, { view: selectedView }),
      subjects: ASK_SUBJECTS,
      suggestions: SUGGESTIONS,
      client,
      log: () => {},
    });

    expect(reply.kind).toBe('unavailable');
    if (reply.kind !== 'unavailable') return;
    expect(reply.failure).toBe('misattributed');
  });

  it('lets the product state that an invented future prediction is absent', async () => {
    const reply = await runQuestion('What will EBITDA be in 2028?', [
      answer('The governed data does not hold a prediction for that future period.'),
    ]);

    expect(reply.kind).toBe('chat');
    if (reply.kind !== 'chat') return;
    expect(reply.toolCalls).toBe(0);
    expect(reply.answer).toMatch(/does not hold a prediction/);
  });
});
