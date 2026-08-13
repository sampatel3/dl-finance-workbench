'use client';

/**
 * The question box.
 *
 * The whole of the client's job is: post a question, show a pending state, render whatever
 * came back. It renders two shapes and no third — an answer, or a named reason there is not
 * one — because there is no fallback engine behind this box. A demo that quietly answers
 * from a keyword matcher when the model is unavailable is a demo that will one day put a
 * confidently wrong figure on a screen in front of a customer.
 *
 * The answer is rendered as text, never as markup. Model output reaching the DOM as HTML is
 * the one injection route a demo like this actually has.
 *
 * The memory tier does not stream (01-decisions.md §5): answers are short and grounded, so a
 * pending state costs less than a hand-rolled stream and a 300-second function would.
 */

import { useState } from 'react';
import type { ChatReply, UnavailableReply } from '@demo-kit/llm';
import type { PersonaId } from '../lib/permissions';
import type { Params } from '../lib/world';
import { IconArrowOut, IconInfo } from './Icons';

type Reply = ChatReply | UnavailableReply;

export function Ask({
  suggestions,
  principalId,
  viewParams,
}: {
  suggestions: readonly string[];
  principalId: PersonaId;
  viewParams: Params;
}) {
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);

  async function submit(asked: string): Promise<void> {
    const trimmed = asked.trim();
    if (trimmed === '' || pending) return;
    setPending(true);
    setReply(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: trimmed, as: principalId, view: viewParams }),
      });
      setReply((await res.json()) as Reply);
    } catch {
      /* The route itself never throws — it answers with a named failure. Reaching here means
         the network did, so say that rather than borrowing one of the loop's reasons. */
      setReply({
        kind: 'unavailable',
        question: trimmed,
        reason: 'The request did not reach the demo. Check the connection and try again.',
        failure: 'sdk_error',
        suggestions,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(question);
        }}
      >
        <input
          className="ask-input"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about a site, a month, or a comparison"
          aria-label="Ask a question about this demo"
          data-testid="ask-input"
        />
        <button className="ask-send" type="submit" disabled={pending} data-testid="ask-send">
          {pending ? 'Asking' : 'Ask'}
        </button>
      </form>

      <div className="chips">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            className="chip"
            onClick={() => {
              setQuestion(s);
              void submit(s);
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <span className="visually-hidden" role="status" aria-live="polite">
        {pending ? 'Working on your question.' : reply === null ? '' : 'Answer ready.'}
      </span>

      {reply === null ? null : (
        <div
          className={`answer${reply.kind === 'unavailable' ? ' unavailable' : ''}`}
          data-testid="ask-answer"
        >
          <p className="answer-q">{reply.question}</p>
          {reply.kind === 'chat' ? (
            <>
              <p className="answer-a">{reply.answer}</p>
              {reply.used.length === 0 ? null : (
                <div className="cites">
                  {reply.used.map((c) =>
                    c.href === null ? (
                      <span className="cite" key={`${c.label}${c.value}`}>
                        <span className="cite-k">{c.label}</span>
                        <span className="cite-v">{c.value}</span>
                      </span>
                    ) : (
                      <a className="cite" key={`${c.label}${c.value}`} href={c.href}>
                        <span className="cite-k">{c.label}</span>
                        <span className="cite-v">{c.value}</span>
                        <IconArrowOut />
                      </a>
                    ),
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="answer-a">
              <IconInfo /> {reply.reason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
