import { ask } from '@demo-kit/llm';
import { liveClient } from '../../../lib/anthropic';
import { SUGGESTIONS, SYSTEM, TOOLS, runTool } from '../../../lib/tools';

/**
 * The chat route: one question, one grounded answer, or one named reason there is not one.
 *
 * `maxDuration` is a segment export rather than a `vercel.json` entry — the setting belongs
 * beside the code whose runtime it bounds, and a duration written in a file at the repo root
 * is a duration nobody editing this route will think to check. Sixty seconds is enough for
 * six short turns at 900 max_tokens; the postgres tier's streaming route needs more, and
 * reads its own from one exported constant so the number and the comment cannot disagree.
 *
 * `nodejs`, because the loop runs the demo's own tools over the memoised world.
 *
 * The route never throws. Everything that can go wrong — no key, a transport failure, too
 * many turns, a figure that fails the grounding check — comes back as a named failure with
 * suggestions, because the reader is owed a reason and the operator is owed a log line.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const question =
    typeof body === 'object' && body !== null && 'question' in body && typeof body.question === 'string'
      ? body.question.trim()
      : '';

  if (question === '') {
    return Response.json({ error: 'A question is required.' }, { status: 400 });
  }

  const client = await liveClient();
  const reply = await ask({
    question,
    system: SYSTEM,
    tools: TOOLS,
    runTool,
    suggestions: SUGGESTIONS,
    ...(client === undefined ? {} : { client }),
  });

  /* A named failure is a successful response describing an unsuccessful lookup, so it is a
     200: the client renders it, it is not an error the browser should retry. */
  return Response.json(reply, { headers: { 'cache-control': 'no-store' } });
}
