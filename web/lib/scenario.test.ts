/**
 * Scenarios: the steps, the governance stamp, and the route into commentary.
 *
 * This surface had no test at all, which is how the defect below survived. A step was an **absolute**
 * assumption while every label around it described a **movement against plan** — so the chip reading
 * "−10%" set volume to 0.9 against a Forecast v6 that assumes 0.946, a 4.9% cut, and the saved scenario
 * pointing at it was called *Revenue down 10%*. Nothing rendered wrong. Nothing threw. The only way to
 * see it was to recompute v6's assumption by hand, which nobody does.
 *
 * So the first thing asserted here is the arithmetic a reader would otherwise have to do themselves:
 * **a step means what its label says against the approved forecast.**
 */

import { describe, expect, it } from 'vitest';
import { VERSIONS } from '@kestrel/model';
import { activeApprovedForecast } from '@kestrel/analysis';

import {
  LEVERS,
  LIBRARY,
  assumptionsFrom,
  commentaryDraft,
  governanceOf,
  libraryEntryFor,
  neutralStep,
  runScenario,
  scenarioHref,
  stepLabel,
} from './scenario';
import { viewOf } from './world';

const view = () => viewOf();

describe('a step is a movement against the approved forecast', () => {
  it('applies a factor to the approved value rather than replacing it', () => {
    const approved = activeApprovedForecast().assumptions;
    const { assumptions, moved, steps } = assumptionsFrom({ volume: '0.9' });
    expect(moved).toEqual(['volume']);
    expect(steps['volume']).toBe(0.9);
    /* The whole point: 0.9 means ten per cent below plan, not an assumption of 0.9. */
    expect(assumptions.volume).toBeCloseTo(approved.volume * 0.9, 10);
    expect(assumptions.volume).not.toBe(0.9);
  });

  it('and adds days rather than multiplying them', () => {
    const approved = activeApprovedForecast().assumptions;
    const { assumptions } = assumptionsFrom({ dsoDays: '10' });
    expect(assumptions.dsoDays).toBe(approved.dsoDays + 10);
  });

  it('and labels every step as the movement it is', () => {
    expect(stepLabel('volume', 0.9)).toBe('-10%');
    expect(stepLabel('volume', 1.05)).toBe('+5%');
    expect(stepLabel('dsoDays', 10)).toBe('+10d');
  });

  it('and treats the neutral step as no change at all', () => {
    for (const lever of LEVERS) {
      const neutral = neutralStep(lever.key);
      expect(lever.steps as readonly number[]).toContain(neutral);
      const { moved } = assumptionsFrom({ [lever.key]: String(neutral) });
      expect(moved, `${lever.key} at its neutral step is a change`).toEqual([]);
    }
  });

  it('and refuses a step the lever does not offer', () => {
    /* A hand-edited URL asking for volume × 40 is not a scenario, it is a way to make the model print
       nonsense in front of a client. */
    const { moved, assumptions } = assumptionsFrom({ volume: '40' });
    expect(moved).toEqual([]);
    expect(assumptions.volume).toBe(activeApprovedForecast().assumptions.volume);
  });

  it('and every saved scenario names a step its lever actually offers', () => {
    for (const entry of LIBRARY) {
      for (const [key, value] of Object.entries(entry.params)) {
        const lever = LEVERS.find((candidate) => candidate.key === key);
        expect(lever, `${entry.name} moves an unknown lever ${key}`).toBeDefined();
        expect(
          lever?.steps as readonly number[],
          `${entry.name} sets ${key} to a step that does not exist`,
        ).toContain(Number(value));
      }
    }
  });

  it('and a saved scenario called "down 10%" is down 10% on the plan', () => {
    /* The claim the library entry makes in its own name, checked against the arithmetic. */
    const entry = LIBRARY.find((candidate) => candidate.name === 'Revenue down 10%');
    expect(entry).toBeDefined();
    const { assumptions } = assumptionsFrom(entry?.params ?? {});
    const approved = activeApprovedForecast().assumptions;
    expect(assumptions.volume / approved.volume).toBeCloseTo(0.9, 10);
  });
});

describe('the governance stamp', () => {
  it('is never approved, and names the version that is', () => {
    const result = runScenario(view(), { volume: '0.9' });
    const governance = governanceOf(view(), result, '/scenarios?volume=0.9');
    expect(governance.approved).toBe(false);
    expect(governance.label).toContain('Not the approved forecast');
    expect(governance.label).toContain(activeApprovedForecast().label);
  });

  it('and claims an author and a date only where a saved record exists', () => {
    /* Stamping a name and a timestamp on a lever drag would be inventing a governance record rather
       than keeping one. An unsaved run says so. */
    const adhoc = runScenario(view(), { price: '0.98' });
    const unsaved = governanceOf(view(), adhoc, '/scenarios?price=0.98');
    expect(unsaved.saved).toBe(false);
    expect(unsaved.preparedAt).toBeUndefined();
    expect(unsaved.author).toContain('this session');

    const saved = runScenario(view(), { dsoDays: '10' });
    const stamped = governanceOf(view(), saved, '/scenarios?dsoDays=10');
    expect(stamped.saved).toBe(true);
    expect(stamped.preparedAt).toBeDefined();
    expect(stamped.author).toBe('Group Treasurer');
    expect(stamped.standing).toBeDefined();
  });

  it('and matches a run back to its saved scenario only on the whole assumption set', () => {
    expect(libraryEntryFor({ dsoDays: 10 })?.name).toBe('Collections slip 10 days');
    // A superset is a different scenario, not the saved one with a note.
    expect(libraryEntryFor({ dsoDays: 10, volume: 0.9 })).toBeUndefined();
    expect(libraryEntryFor({})).toBeUndefined();
  });

  it('and every saved scenario carries a preparer, a date and a standing', () => {
    for (const entry of LIBRARY) {
      expect(entry.author, `${entry.name} has no author`).not.toBe('');
      expect(entry.preparedAt, `${entry.name} has no date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.history, `${entry.name} has no history`).not.toBe('');
    }
  });
});

describe('what a scenario reports', () => {
  it('holds the budget beside the approved forecast on every line', () => {
    /* The review asks for side-by-side against Forecast v6 and Budget. A scenario below the approved
       forecast may still be above budget, and those two facts start opposite conversations. */
    const result = runScenario(view(), { volume: '0.9' });
    const budget = VERSIONS.find((v) => v.scenario === 'BUDGET' && v.status === 'approved');
    expect(result.budget.id).toBe(budget?.id);
    for (const line of result.lines) {
      expect(line.budgetValue, `${line.label} has no budget figure`).not.toBeNull();
    }
  });

  it('and reports revenue, EBITDA, profit after tax and cash, which is what the review names', () => {
    const ids = runScenario(view(), {}).lines.map((line) => line.measureId);
    for (const required of ['revenue', 'ebitda', 'net_income', 'cash']) {
      expect(ids, `${required} is missing from the scenario table`).toContain(required);
    }
  });

  it('and carries the same measures across the fiscal year', () => {
    const result = runScenario(view(), { volume: '0.9' });
    expect(result.yearLines.map((l) => l.measureId)).toEqual(result.lines.map((l) => l.measureId));
    const monthRevenue = result.lines.find((l) => l.measureId === 'revenue')?.scenarioValue ?? 0;
    const yearRevenue = result.yearLines.find((l) => l.measureId === 'revenue')?.scenarioValue ?? 0;
    expect(yearRevenue).toBeGreaterThan(monthRevenue);
  });

  it('and records every moved assumption with the value it moved from', () => {
    const result = runScenario(view(), { volume: '0.95', price: '1.02' });
    expect(result.trail.map((row) => row.key).sort()).toEqual(['price', 'volume']);
    for (const row of result.trail) {
      expect(row.from).toBe(activeApprovedForecast().assumptions[row.key]);
      expect(row.to).toBe(result.assumptions[row.key]);
      expect(row.owner, `${row.label} has no owner`).not.toBe('');
      expect(row.precedent.statement).not.toBe('');
    }
  });

  it('and the collections scenario is the one that reaches cash without touching profit', () => {
    /* The demo's load-bearing case, and the reason cash is modelled rather than derived. */
    const result = runScenario(view(), { dsoDays: '10' });
    const revenue = result.lines.find((line) => line.measureId === 'revenue');
    const ebitda = result.lines.find((line) => line.measureId === 'ebitda');
    expect(revenue?.movement).toBe(0);
    expect(ebitda?.movement).toBe(0);
    expect(result.scenarioHeadroom).toBeLessThan(result.baseHeadroom);
  });
});

describe('the route into commentary', () => {
  it('offers no paragraph where nothing moved', () => {
    const draft = commentaryDraft(view(), runScenario(view(), {}));
    expect(draft.text).toBeNull();
  });

  it('and composes one that names the decision and says it is not the approved forecast', () => {
    const result = runScenario(view(), { dsoDays: '10' });
    const draft = commentaryDraft(view(), result);
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(draft.text).toContain('not the approved forecast');
    expect(draft.text).toContain(result.confidence.label);
  });

  it('and offers the draft action only to a principal who could raise one', () => {
    /* The same rule the commentary queue applies, rather than a second looser one on this page. */
    const executive = viewOf({ as: 'group-executive' });
    const analyst = viewOf({ as: 'group-fpa' });
    expect(commentaryDraft(executive, runScenario(executive, { dsoDays: '10' })).mayDraft).toBe(
      false,
    );
    expect(commentaryDraft(analyst, runScenario(analyst, { dsoDays: '10' })).mayDraft).toBe(true);
  });
});

describe('the link is the record', () => {
  it('carries the assumptions, so a scenario can be sent', () => {
    const href = scenarioHref(view(), { volume: '0.9' }, { price: '1.02' });
    expect(href).toContain('volume=0.9');
    expect(href).toContain('price=1.02');
  });

  it('and drops a lever returned to plan', () => {
    const href = scenarioHref(view(), { volume: '0.9' }, { volume: '' });
    expect(href).not.toContain('volume');
  });
});
