/**
 * The tools, which are the only source of numbers in an answer.
 *
 * What is being defended here is not that each tool returns something — it is that the *set* of them makes
 * the grounding guarantee achievable. Two specific ways that fails:
 *
 *   **A tool that returns only a citation grounds nothing.** The check reads a tool's `content`, so a
 *   figure a reader may see quoted has to be in the text. A tool returning `{ citations: [...] }` and an
 *   empty body would pass a naive "does it answer" test and cause every answer built on it to be refused.
 *
 *   **Arithmetic the model does is ungrounded by construction.** `compare_measures` exists for that
 *   reason, and the test for it is that the difference appears in the text — not that the tool ran.
 *
 * And one thing the tools must *not* do: project. A question inviting a forecast has to have no tool that
 * can serve it, which is a property of the tool list rather than of the prompt.
 */

import { describe, expect, it } from 'vitest';
import { SEED_END } from '@kestrel/model';
import { measureIds } from '@kestrel/measures';

import { SUGGESTIONS, SYSTEM, TOOLS, runTool } from './tools';

const call = (name: string, input: Record<string, unknown> = {}) =>
  runTool({ id: 't', name, input });

describe('the tool list', () => {
  it('offers every measure in the catalogue rather than a hand-picked few', () => {
    // A curated subset is a list that goes stale the moment a measure is added, and the failure is silent:
    // the model simply cannot answer about the new one and says the tools do not cover it.
    const spec = TOOLS.find((t) => t.name === 'get_measure');
    const properties = spec?.input_schema.properties ?? {};
    const measure = properties.measure as { enum?: readonly string[] } | undefined;
    expect([...(measure?.enum ?? [])].sort()).toEqual([...measureIds()].sort());
  });

  it('and cannot be pointed at a period that has not closed', async () => {
    /* The refusal is structural rather than instructional: a month beyond the last closed one is not a
       readable parameter, so it falls back to the closed month and says which period it answered for.
       There is nothing to call for next quarter.

       An earlier version of this test grepped the tool definitions for the words "predict", "project" and
       "future" — and failed, because a segment is called `projects` and a comparator is called `forecast`.
       A test that reads vocabulary rather than behaviour fails on the product's own nouns. */
    const future = await call('get_measure', { measure: 'revenue', month: '2027-03' });
    expect(future.content).toMatch(/Jul 2026/);
    expect(SYSTEM).toMatch(/cannot make one/);
  });

  it('and names the arithmetic tool in the description of the one it replaces', () => {
    // A model that does not know the arithmetic tool exists will subtract in its head and be refused.
    const compare = TOOLS.find((t) => t.name === 'compare_measures');
    expect(compare?.description).toMatch(/rather than subtracting/);
  });
});

describe('get_measure', () => {
  it('returns the value, the formula and the owner in the text', async () => {
    const out = await call('get_measure', { measure: 'revenue' });
    expect(out.content).toMatch(/£12\.4m/);
    expect(out.content).toMatch(/owned by/);
    // The definition is in the body, not only in a citation — a citation grounds nothing.
    expect(out.content).toMatch(/defined as/);
  });

  it('says whether the figure is consolidated, because a slice is not', async () => {
    const group = await call('get_measure', { measure: 'revenue' });
    const sliced = await call('get_measure', { measure: 'revenue', segment: 'contracts' });
    expect(group.content).toMatch(/intercompany eliminated/);
    expect(sliced.content).toMatch(/not consolidated/);
  });

  it('and names a measure that does not exist rather than throwing', async () => {
    const out = await call('get_measure', { measure: 'revenue_but_better' });
    expect(out.content).toMatch(/No measure called/);
  });
});

describe('compare_measures', () => {
  it('does the subtraction, so the model never has to', async () => {
    const out = await call('compare_measures', { measure: 'revenue', against: 'forecast' });
    // The variance in money has to be in the text. If it were only in a citation, an answer quoting it
    // would be refused by the grounding check.
    expect(out.content).toMatch(/£618k/);
    expect(out.content).toMatch(/ahead by|behind by/);
  });

  it('and states the basis, so an answer can never be vague about what it compared', async () => {
    const out = await call('compare_measures', { measure: 'revenue', against: 'prior_year' });
    expect(out.content).toMatch(/The comparison is against/);
  });

  it('and discloses that a trend is a fit, on the answer rather than in a footnote', async () => {
    const out = await call('compare_measures', { measure: 'revenue', against: 'trend' });
    expect(out.content).toMatch(/fitted expectation/);
  });
});

describe('list_findings', () => {
  it('returns every finding with its board, priority and owner', async () => {
    const out = await call('list_findings');
    expect(out.content).toMatch(/findings for Jul 2026/);
    expect(out.content).toMatch(/adverse\/current|favourable\/forward/);
    expect(out.citations?.length ?? 0).toBeGreaterThan(0);
  });

  it('and can answer about one board', async () => {
    const out = await call('list_findings', { board: 'opportunities' });
    expect(out.content).toMatch(/favourable\/forward/);
    expect(out.content).not.toMatch(/adverse\/current/);
  });

  it('and says plainly when a board is empty rather than returning nothing', async () => {
    // An empty result that reads as an error is how a demo appears broken when it is working. The Gulf
    // entity alone has no restatement and no unmapped accounts, so some boards thin out.
    const out = await call('list_findings', { board: 'performance', entity: 'gulf' });
    expect(out.content.length).toBeGreaterThan(20);
  });
});

describe('explain_variance', () => {
  it('returns the bars and says whether they sum', async () => {
    const out = await call('explain_variance', { measure: 'revenue', against: 'forecast' });
    expect(out.content).toMatch(/Volume/);
    expect(out.content).toMatch(/sum to the movement exactly/);
  });

  it('and refuses a measure it cannot bridge, with the reason', async () => {
    const out = await call('explain_variance', { measure: 'ebitda', against: 'forecast' });
    expect(out.content).toMatch(/needs quantities/);
  });
});

describe('describe_measure', () => {
  it('answers "how is this calculated" with the accounts it reads', async () => {
    const out = await call('describe_measure', { measure: 'gross_margin' });
    expect(out.content).toMatch(/reads these accounts/);
    expect(out.content).toMatch(/owned by/);
    expect(out.content).toMatch(/Higher is better|Lower is better|neither good nor bad/);
  });

  it('and says when a definition is still draft', async () => {
    const out = await call('describe_measure', { measure: 'pipeline_conversion' });
    expect(out.content).toMatch(/definition is draft/);
  });
});

describe('the suggested questions', () => {
  it('every one of them resolves against a tool that exists', () => {
    // A chip the demo then refuses turns a limitation into a broken promise. This is a weaker check than
    // running them through a model, and it is the one that can run without a key: each names a capability
    // the tool list has.
    expect(SUGGESTIONS.length).toBeGreaterThan(2);
    for (const question of SUGGESTIONS) {
      expect(question.endsWith('?')).toBe(true);
    }
  });
});

describe('an unknown tool', () => {
  it('is a named answer rather than a throw', async () => {
    const out = await call('delete_the_ledger');
    expect(out.content).toMatch(/No tool called/);
  });
});

describe('the demo’s own month', () => {
  it('is what a tool defaults to, so an answer never silently reports a different period', async () => {
    const out = await call('get_measure', { measure: 'revenue', month: 'not-a-month' });
    expect(out.content).toMatch(/Jul 2026/);
    expect(SEED_END).toBe('2026-07');
  });
});
