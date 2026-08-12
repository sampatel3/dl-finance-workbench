/**
 * The tools, and the property the whole chat rests on: a tool's text carries the figure.
 *
 * `@demo-kit/llm` grounds an answer by checking every numeral in it against the text the
 * tools returned. A tool that answers with a citation and no figure in its prose therefore
 * grounds nothing, and every answer quoting it is refused — which looks like a broken model
 * and is actually a broken tool.
 */

import { describe, expect, test } from 'vitest';
import { units } from './format';
import { SUGGESTIONS, TOOLS, runTool } from './tools';
import { LATEST_MONTH, monthOf, siteByName, world } from './world';

const call = (name: string, input: Record<string, unknown>) => runTool({ id: 't1', name, input });

describe('site_series', () => {
  test('states every monthly figure as text', async () => {
    const outcome = await call('site_series', { site: 'East' });
    const east = siteByName(world(), 'East');
    for (const row of east?.months ?? []) {
      expect(outcome.content).toContain(units(row.volume));
    }
  });

  test('names the sites when asked for one that does not exist', async () => {
    const outcome = await call('site_series', { site: 'Westgate' });
    expect(outcome.content).toContain('North');
    expect(outcome.content).toContain('Central');
  });
});

describe('compare_sites', () => {
  test('does the arithmetic so the model does not have to', async () => {
    const outcome = await call('compare_sites', { a: 'Central', b: 'North', month: LATEST_MONTH.id });
    const at = (name: string) => {
      const site = siteByName(world(), name);
      return site === undefined ? undefined : monthOf(site, LATEST_MONTH.id);
    };
    const central = at('Central');
    const north = at('North');
    const gap = (central?.volume ?? 0) - (north?.volume ?? 0);

    expect(outcome.content).toContain(units(central?.volume ?? 0));
    expect(outcome.content).toContain(units(north?.volume ?? 0));
    // The difference itself is in the text, so an answer quoting it stays grounded.
    expect(outcome.content).toContain(units(Math.abs(gap)));
  });

  test('defaults to the latest month', async () => {
    const outcome = await call('compare_sites', { a: 'East', b: 'South' });
    expect(outcome.content).toContain(LATEST_MONTH.label);
  });

  test('cites both sites, each pointing at where the figure is shown', async () => {
    const outcome = await call('compare_sites', { a: 'East', b: 'South' });
    expect(outcome.citations).toHaveLength(2);
    for (const citation of outcome.citations ?? []) {
      expect(citation.href).toBe('/app?focus=section-series');
    }
  });
});

describe('the manifest', () => {
  test('every tool the model is offered is a tool that runs', async () => {
    for (const tool of TOOLS) {
      const outcome = await runTool({ id: 't', name: tool.name, input: {} });
      expect(outcome.content).not.toContain('No tool called');
    }
  });

  test('an unknown tool is an answer, not a throw', async () => {
    await expect(call('nonexistent', {})).resolves.toMatchObject({
      content: expect.stringContaining('No tool called'),
    });
  });

  test('every suggested question is about something the tools can reach', () => {
    // A suggestion chip that cannot resolve is worse than no chip: it is the demo offering a
    // question it will then refuse.
    const names = world().sites.map((s) => s.name);
    for (const suggestion of SUGGESTIONS) {
      expect(names.some((n) => suggestion.includes(n))).toBe(true);
    }
  });
});
