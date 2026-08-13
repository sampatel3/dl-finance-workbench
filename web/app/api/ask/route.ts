import { ask } from '@demo-kit/llm';
import { liveClient } from '../../../lib/anthropic';
import { resolvePrincipal } from '../../../lib/permissions';
import { ASK_SUBJECTS, SUGGESTIONS, TOOLS, runTool, systemFor } from '../../../lib/tools';
import type { Params } from '../../../lib/world';
import { viewOf } from '../../../lib/world';

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

function record(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function stringAt(value: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : undefined;
}

/** Resolve the finance state the HTTP boundary permits Ask to inherit. */
export function resolveAskView(
  personaRaw: string | undefined,
  requestedView: Readonly<Record<string, unknown>>,
) {
  const { principal } = resolvePrincipal(personaRaw);
  const viewParams: Params = {
    as: principal.id,
    period: stringAt(requestedView, 'period'),
    month: stringAt(requestedView, 'month'),
    comparator: stringAt(requestedView, 'comparator'),
    entity: stringAt(requestedView, 'entity'),
    lens: stringAt(requestedView, 'lens'),
    version: stringAt(requestedView, 'version'),
  };
  // Ask is mounted on the actual-only Overview. Do not let a forged request body turn its tools into
  // an unlabelled budget or forecast reader while their citations resolve back to actual-only pages.
  return viewOf(viewParams);
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const payload = record(body);
  const question =
    typeof payload.question === 'string'
      ? payload.question.trim()
      : '';
  const requestedView = record(payload.view);
  const personaRaw = stringAt(payload, 'as') ?? stringAt(requestedView, 'as');
  const view = resolveAskView(personaRaw, requestedView);

  if (question === '') {
    return Response.json({ error: 'A question is required.' }, { status: 400 });
  }

  const client = await liveClient();
  const reply = await ask({
    question,
    system: systemFor(view),
    tools: TOOLS,
    runTool: (call) => runTool(call, { view }),
    subjects: ASK_SUBJECTS,
    suggestions: SUGGESTIONS,
    ...(client === undefined ? {} : { client }),
  });

  /* A named failure is a successful response describing an unsuccessful lookup, so it is a
     200: the client renders it, it is not an error the browser should retry. */
  return Response.json(reply, { headers: { 'cache-control': 'no-store' } });
}
