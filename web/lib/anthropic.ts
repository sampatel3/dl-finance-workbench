/**
 * The one place this demo constructs the real Anthropic SDK.
 *
 * `@demo-kit/llm` types the vendor surface structurally and never imports it, so the kit
 * builds and tests with the SDK absent. The demo is the layer that has the SDK as a real
 * dependency, so the demo is where it is constructed — and the whole of that contact is the
 * six lines below.
 *
 * Two decisions in them:
 *
 *   **The import is dynamic, with a literal specifier.** Literal, so the compiler resolves
 *   the SDK's types and the assignment below is genuinely checked rather than asserted —
 *   the structural `AnthropicLike` is satisfied by the SDK's own client with no adapter and
 *   no cast, and if a future SDK release changes that, this file stops compiling, which is
 *   the point. Dynamic, so a demo with no key never loads the SDK at all.
 *
 *   **No key is a legitimate answer, not an error.** It returns `undefined`, and every
 *   caller turns that into a named, visible failure. A keyless demo is a supported demo.
 */

import { hasApiKey, type AnthropicLike } from '@demo-kit/llm';

let pending: Promise<AnthropicLike | undefined> | undefined;

async function construct(): Promise<AnthropicLike | undefined> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey === undefined || apiKey.trim() === '') return undefined;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: apiKey.trim() });
}

/** The client, or undefined. Memoised: one import and one construction per process. */
export function liveClient(): Promise<AnthropicLike | undefined> {
  return (pending ??= construct());
}

/** Whether this demo can reach a model at all. Derived on the server, never from a request. */
export function isLive(): boolean {
  return hasApiKey();
}
