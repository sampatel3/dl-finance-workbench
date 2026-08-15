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
 * And one thing the tools must *not* do: choose a future or scenario assumption. Stored-version
 * comparison and the single governed 8% sensitivity are deterministic reads; neither turns Ask into a
 * second forecast engine.
 */

import { describe, expect, it } from 'vitest';
import { SEED_END } from '@kestrel/model';
import {
  buildBridge,
  cashSensitivity,
  grossProfitBridge,
  runDetectors,
} from '@kestrel/analysis';
import { compareMeasure, computeMeasure, formatValue, measureIds } from '@kestrel/measures';

import { exploreState } from './explore';
import { principalById } from './permissions';
import { ASK_SUBJECTS, SUGGESTIONS, SYSTEM, TOOLS, runTool, systemFor } from './tools';
import { contextOf, detectorContextOf, paramsForView, viewOf } from './world';

const call = (name: string, input: Record<string, unknown> = {}) =>
  runTool({ id: 't', name, input });

function paramsFrom(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, 'https://demo.invalid').searchParams.entries());
}

describe('the tool list', () => {
  it('offers every measure in the catalogue rather than a hand-picked few', () => {
    // A curated subset is a list that goes stale the moment a measure is added, and the failure is silent:
    // the model simply cannot answer about the new one and says the tools do not cover it.
    const spec = TOOLS.find((t) => t.name === 'get_measure');
    const properties = spec?.input_schema.properties ?? {};
    const measure = properties.measure as { enum?: readonly string[] } | undefined;
    expect([...(measure?.enum ?? [])].sort()).toEqual([...measureIds()].sort());
  });

  it('attributes figures to canonical complete entity names', () => {
    expect(ASK_SUBJECTS).toContain('Kestrel Industrial Group plc');
    expect(ASK_SUBJECTS).toContain('Kestrel Gulf Technical Services FZ-LLC');
    expect(ASK_SUBJECTS).not.toContain('Kestrel');
  });

  it('and cannot be pointed at a period that has not closed', async () => {
    /* The refusal is structural rather than instructional: a month beyond the last closed one is not a
       readable parameter, so it falls back to the closed month and says which period it answered for.
       There is nothing to call for next quarter.

       An earlier version of this test grepped the tool definitions for the words "predict", "project" and
       "future" — and failed, because a segment is called `projects` and a comparator is called `forecast`.
       A test that reads vocabulary rather than behaviour fails on the product's own nouns. */
    const future = await call('get_measure', { measure: 'revenue', month: '2027-03' });
    expect(future.content).toMatch(/Jul 26/);
    expect(SYSTEM).toMatch(/cannot/);
  });

  it('and names the arithmetic tool in the description of the one it replaces', () => {
    // A model that does not know the arithmetic tool exists will subtract in its head and be refused.
    const compare = TOOLS.find((t) => t.name === 'compare_measures');
    expect(compare?.description).toMatch(/rather than subtracting/);
  });

  it('keeps the scenario set closed instead of letting the model choose an assumption', () => {
    const sensitivity = TOOLS.find((tool) => tool.name === 'cash_sensitivity');
    const properties = sensitivity?.input_schema.properties ?? {};
    const input = properties.revenue_change_percent as
      | { enum?: readonly number[] }
      | undefined;
    expect(input?.enum).toEqual([-8]);
  });
});

describe('the selected page view', () => {
  const selected = viewOf({
    as: 'gulf-controller',
    period: 'quarter',
    month: '2026-04',
    comparator: 'prior_year',
    entity: 'gulf',
    lens: 'constant',
    version: 'v7',
  });

  it('is the default for period, month, comparator, entity, lens, version and persona', async () => {
    const out = await runTool(
      { id: 't', name: 'compare_measures', input: { measure: 'revenue' } },
      { view: selected },
    );

    expect(out.content).toMatch(/Kestrel Gulf Technical Services/);
    expect(out.content).toMatch(/Q2 FY26 QTD to Apr 26/);
    expect(out.content).toMatch(/Apr 25 Actual/);
    const href = new URL(out.citations?.[0]?.href ?? '', 'https://demo.invalid');
    expect(href.searchParams.get('as')).toBe('gulf-controller');
    expect(href.searchParams.get('period')).toBe('quarter');
    expect(href.searchParams.get('month')).toBe('2026-04');
    expect(href.searchParams.get('comparator')).toBe('prior_year');
    expect(href.searchParams.get('lens')).toBe('constant');
    expect(href.searchParams.get('version')).toBe('v7');

    const forecast = await runTool(
      { id: 't', name: 'compare_measures', input: { measure: 'revenue' } },
      { view: viewOf({ ...paramsForView(selected), comparator: 'forecast' }) },
    );
    expect(forecast.content).toMatch(/Forecast v7/);
  });

  it('states the same context to the model, so "this period" is not reinterpreted', () => {
    const system = systemFor(selected);
    expect(system).toMatch(/Business-unit controller/);
    expect(system).toMatch(/Q2 FY26 QTD to Apr 26/);
    expect(system).toMatch(/Kestrel Gulf Technical Services/);
    expect(system).toMatch(/prior year/);
    expect(system).toMatch(/constant currency lens/);
    expect(system).toMatch(/version v7/);
  });

  it('cannot be widened by pairing that principal with a broader forged view', async () => {
    const out = await runTool(
      { id: 't', name: 'get_measure', input: { measure: 'revenue' } },
      { principal: principalById('gulf-controller'), view: viewOf() },
    );
    expect(out.content).toMatch(/Kestrel Gulf Technical Services/);
    expect(out.content).not.toMatch(/Kestrel Industrial Group plc/);
    expect(out.content).not.toMatch(/£12\.4m/);
  });

  it('cannot be switched from actuals by a forged Explore scenario', async () => {
    const actual = viewOf({ version: 'v5' });
    const forgedBudget = viewOf(
      { scenario: 'budget', version: 'v5' },
      { allowDataScenario: true },
    );
    const forgedForecast = viewOf(
      { scenario: 'forecast', version: 'v5' },
      { allowDataScenario: true },
    );
    const calls = [
      { name: 'cash_sensitivity', input: { revenue_change_percent: -8 } },
      { name: 'list_findings', input: { board: 'risks' } },
    ];

    for (const tool of calls) {
      const expected = await runTool({ id: 'a', ...tool }, { view: actual });
      for (const forged of [forgedBudget, forgedForecast]) {
        const resolved = await runTool({ id: 'b', ...tool }, { view: forged });
        expect(resolved.content).toBe(expected.content);
        expect(resolved.citations).toEqual(expected.citations);
        for (const citation of resolved.citations ?? []) {
          if (citation.href === null) continue;
          expect(new URL(citation.href, 'https://demo.invalid').searchParams.has('scenario')).toBe(
            false,
          );
        }
      }
    }
  });
});

describe('get_measure', () => {
  it('returns the value, the formula and the owner in the text', async () => {
    const out = await call('get_measure', { measure: 'revenue' });
    expect(out.content).toMatch(/£12\.4m/);
    expect(out.content).toMatch(/owned by/);
    // The definition is in the body, not only in a citation — a citation grounds nothing.
    expect(out.content).toMatch(/defined as/);
    const evidence = new URL(out.citations?.[0]?.href ?? '', 'https://demo.invalid');
    expect(evidence.pathname).toBe('/explore');
    expect(evidence.searchParams.get('measure')).toBe('revenue');
    expect(evidence.searchParams.get('focus')).toBe('section-cited-measure');
  });

  it('says whether the figure is consolidated, because a slice is not', async () => {
    const group = await call('get_measure', { measure: 'revenue' });
    const sliced = await call('get_measure', { measure: 'revenue', segment: 'contracts' });
    expect(group.content).toMatch(/intercompany eliminated/);
    expect(sliced.content).toMatch(/not consolidated/);
  });

  it('cites the exact segment value rather than the unsliced group measure', async () => {
    const out = await call('get_measure', { measure: 'revenue', segment: 'contracts' });
    const href = out.citations?.[0]?.href;
    expect(href).toBeTruthy();
    if (href === null || href === undefined) return;

    const evidence = exploreState(paramsFrom(href));
    const exact = computeMeasure('revenue', evidence.ctx);
    expect(evidence.segmentId).toBe('contracts');
    expect(out.citations?.[0]?.value).toBe(formatValue(exact.value, exact.unit));
    expect(out.content).toContain(formatValue(exact.value, exact.unit));
    expect(exact.value).not.toBe(computeMeasure('revenue', contextOf(evidence.view)).value);
  });

  it('and names a measure that does not exist rather than throwing', async () => {
    const out = await call('get_measure', { measure: 'revenue_but_better' });
    expect(out.content).toMatch(/No measure called/);
  });

  it('refuses a group lookup for the Gulf controller instead of answering from Gulf', async () => {
    const out = await runTool(
      { id: 't', name: 'get_measure', input: { measure: 'revenue', entity: 'group' } },
      { principal: principalById('gulf-controller') },
    );

    expect(out.content).toMatch(/Access refused/);
    expect(out.content).toMatch(/cannot read group figures/);
    expect(out.content).not.toMatch(/£12\.4m/);
  });

  it('defaults the Gulf controller to their own entity when no entity is requested', async () => {
    const out = await runTool(
      { id: 't', name: 'get_measure', input: { measure: 'revenue' } },
      { principal: principalById('gulf-controller') },
    );

    expect(out.content).toMatch(/Kestrel Gulf Technical Services/);
    expect(out.content).not.toMatch(/Kestrel Industrial Group plc/);
  });
});

describe('compare_measures', () => {
  it('does the subtraction, so the model never has to', async () => {
    const out = await call('compare_measures', { measure: 'revenue', against: 'forecast' });
    // The variance in money has to be in the text. If it were only in a citation, an answer quoting it
    // would be refused by the grounding check.
    expect(out.content).toMatch(/£618k/);
    expect(out.content).toMatch(/ahead by|behind by/);
    const evidence = new URL(out.citations?.[0]?.href ?? '', 'https://demo.invalid');
    expect(evidence.pathname).toBe('/explore');
    expect(evidence.searchParams.get('measure')).toBe('revenue');
  });

  it('and states the basis, so an answer can never be vague about what it compared', async () => {
    const out = await call('compare_measures', { measure: 'revenue', against: 'prior_year' });
    expect(out.content).toMatch(/The comparison is against/);
  });

  it('cites the comparator it actually used, with the same current and comparative values', async () => {
    const out = await runTool(
      {
        id: 't',
        name: 'compare_measures',
        input: { measure: 'revenue', against: 'prior_year' },
      },
      { view: viewOf({ comparator: 'forecast', version: 'v6' }) },
    );
    const href = out.citations?.[0]?.href;
    expect(href).toBeTruthy();
    if (href === null || href === undefined) return;

    const evidence = exploreState(paramsFrom(href));
    const exact = compareMeasure('revenue', evidence.ctx, evidence.view.comparator);
    expect(evidence.view.comparator.id).toBe('prior_year');
    expect(out.citations?.[0]?.value).toBe(
      formatValue(exact.current.value, exact.current.unit),
    );
    expect(out.content).toContain(formatValue(exact.current.value, exact.current.unit));
    expect(out.content).toContain(formatValue(exact.comparativeValue, exact.current.unit));
  });

  it('and discloses that a trend is a fit, on the answer rather than in a footnote', async () => {
    const out = await call('compare_measures', { measure: 'revenue', against: 'trend' });
    expect(out.content).toMatch(/fitted expectation/);
  });
});

describe('list_findings', () => {
  it('returns every finding with its board, priority and owner', async () => {
    const out = await call('list_findings');
    expect(out.content).toMatch(/findings for Jul 26/);
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

  it('never carries group-only control metadata into a Gulf finding response', async () => {
    const out = await runTool(
      { id: 't', name: 'list_findings', input: {} },
      { principal: principalById('gulf-controller') },
    );
    const rendered = `${out.content} ${JSON.stringify(out.citations ?? [])}`;

    expect(rendered).not.toMatch(/unmapped|intercompany|restat/i);
    expect(rendered).not.toContain('Kestrel Inc');
    expect(rendered).not.toContain('58420');
    for (const citation of out.citations ?? []) {
      if (citation.href === null) continue;
      const url = new URL(citation.href, 'https://demo.invalid');
      expect(url.searchParams.get('as')).toBe('gulf-controller');
    }
  });

  it('links every cited finding to the detector figure set, not its separate action', async () => {
    const out = await call('list_findings', { board: 'risks' });
    expect(out.citations?.length ?? 0).toBeGreaterThan(0);

    for (const citation of out.citations ?? []) {
      expect(citation.href).not.toBeNull();
      if (citation.href === null) continue;
      const params = paramsFrom(citation.href);
      expect(params.focus).toBe('section-finding-evidence');
      const evidenceView = viewOf(params);
      const finding = runDetectors(detectorContextOf(evidenceView)).findings.find(
        (candidate) => candidate.fingerprint === params.finding,
      );
      expect(finding).toBeDefined();
      if (finding === undefined) continue;
      expect(finding.title).toBe(citation.label);
      expect(finding.figures.map((figure) => formatValue(figure.value, figure.unit))).toContain(
        citation.value,
      );
      expect(out.content).toContain(finding.statement);
      expect(citation.href).not.toBe(finding.action.href);
    }
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

  it('carries a tool-level comparator into every bridge evidence link', async () => {
    for (const call of [
      { name: 'explain_variance', input: { measure: 'revenue', against: 'prior_year' } },
      { name: 'explain_ebitda', input: { against: 'prior_year' } },
    ]) {
      const out = await runTool({ id: 't', ...call }, {
        view: viewOf({ comparator: 'forecast', version: 'v6' }),
      });
      for (const citation of out.citations ?? []) {
        if (citation.href === null) continue;
        expect(viewOf(paramsFrom(citation.href)).comparator.id).toBe('prior_year');
      }
    }
  });

  it('uses bridge values that the linked waterfall actually renders', async () => {
    const variance = await call('explain_variance', {
      measure: 'revenue',
      against: 'prior_year',
    });
    const varianceHref = variance.citations?.[0]?.href;
    expect(varianceHref).toBeTruthy();
    if (varianceHref !== null && varianceHref !== undefined) {
      const evidenceView = viewOf(paramsFrom(varianceHref));
      const bridge = buildBridge({
        measureId: 'revenue',
        ctx: contextOf(evidenceView),
        comparator: evidenceView.comparator,
      });
      expect(variance.citations?.[0]?.value).toBe(formatValue(bridge.to, 'currency'));
    }

    const ebitda = await call('explain_ebitda', { against: 'prior_year' });
    const marginCitation = ebitda.citations?.find((citation) =>
      citation.href?.includes('section-margin'),
    );
    expect(marginCitation?.href).toBeTruthy();
    if (marginCitation?.href !== null && marginCitation?.href !== undefined) {
      const evidenceView = viewOf(paramsFrom(marginCitation.href));
      const bridge = grossProfitBridge({
        ctx: contextOf(evidenceView),
        comparator: evidenceView.comparator,
      });
      expect(marginCitation.value).toBe(formatValue(bridge.to, 'currency'));
    }
  });
});

describe('the four illustrative CFO questions', () => {
  it('answers the EBITDA premise honestly with an exact bridge', async () => {
    const out = await call('explain_ebitda', { against: 'forecast' });
    expect(out.content).toMatch(/EBITDA .* against/);
    expect(out.content).toMatch(/behind, not ahead|is ahead|exactly on/);
    expect(out.content).toMatch(/Volume (?:added|reduced EBITDA)/);
    expect(out.content).toMatch(/Operating expense (?:added|reduced EBITDA)/);
    expect(out.content).toMatch(/sum to the EBITDA movement exactly/);
    expect(out.citations?.some((citation) => citation.href?.includes('section-margin'))).toBe(true);
  });

  it('answers the governed revenue-down-8% cash sensitivity without choosing an assumption', async () => {
    const out = await call('cash_sensitivity', { revenue_change_percent: -8 });
    expect(out.content).toMatch(/8\.0%/);
    expect(out.content).toMatch(/revenue falls by/);
    expect(out.content).toMatch(/lost margin reduces cash by/);
    expect(out.content).toMatch(/receivable release adds/);
    expect(out.content).toMatch(/Over 13 weeks/);
    expect(out.content).toMatch(/not a forecast or an assumption chosen by the model/);
    expect(out.citations?.[0]?.href).toContain('section-sensitivity');
    const href = out.citations?.[0]?.href;
    expect(href).toBeTruthy();
    if (href !== null && href !== undefined) {
      const evidenceView = viewOf(paramsFrom(href));
      const exact = cashSensitivity(contextOf(evidenceView), -0.08);
      expect(out.citations?.[0]?.value).toBe(formatValue(exact.netCashEffect, 'currency'));
    }

    const refused = await call('cash_sensitivity', { revenue_change_percent: -7 });
    expect(refused.content).toMatch(/contains the governed revenue-down-8% sensitivity only/);
    expect(refused.content).toMatch(/cannot choose or invent/);
  });

  it('returns the closed v6-to-v7 driver diff and exact total impacts', async () => {
    const out = await call('compare_versions', { from: 'v6', to: 'v7' });
    expect(out.content).toMatch(/Forecast v6 to Forecast v7/);
    expect(out.content).toMatch(/Volume moved/);
    expect(out.content).toMatch(/Subcontract rate moved up/);
    expect(out.content).toMatch(/Revenue moved from/);
    expect(out.content).toMatch(/Gross margin moved from/);
    expect(out.content).toMatch(/marginal run/);
    expect(out.citations?.[0]?.href).toContain('from=v6');
    expect(out.citations?.[0]?.href).toContain('version=v7');

    const refused = await call('compare_versions', { from: 'v6', to: 'v8' });
    expect(refused.content).toMatch(/No stored forecast version called "v8"/);
  });

  it('grounds a July risks-and-opportunities draft in detector output and citations', async () => {
    const risks = await call('list_findings', { month: '2026-07', board: 'risks' });
    const opportunities = await call('list_findings', {
      month: '2026-07',
      board: 'opportunities',
    });
    expect(risks.content).toMatch(/findings for Jul 26/);
    expect(risks.content).toMatch(/adverse\/forward/);
    expect(opportunities.content).toMatch(/findings for Jul 26/);
    expect(opportunities.content).toMatch(/favourable\/forward/);
    expect(risks.citations?.length ?? 0).toBeGreaterThan(0);
    expect(opportunities.citations?.length ?? 0).toBeGreaterThan(0);
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
  it('are the PRD’s four questions, each backed by the deterministic tools above', () => {
    expect(SUGGESTIONS).toEqual([
      'Why is EBITDA ahead of forecast?',
      'What happens to cash if revenue falls 8%?',
      'Which drivers changed since forecast v6?',
      'Draft July Board commentary with risks and opportunities.',
    ]);
    expect(TOOLS.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'explain_ebitda',
        'cash_sensitivity',
        'compare_versions',
        'list_findings',
      ]),
    );
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
    expect(out.content).toMatch(/Jul 26/);
    expect(SEED_END).toBe('2026-07');
  });
});
