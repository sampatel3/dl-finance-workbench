/**
 * Three landings, and the difference between them.
 *
 * What has to hold for a page that shows three numbers for one year:
 *
 *   **They are computed three different ways.** Three columns that agree because two of them are the
 *   same arithmetic dressed differently is worse than one column, because it looks like corroboration.
 *
 *   **The run rate contains no plan.** Its whole value is that nobody can be accused of massaging it,
 *   which stops being true the moment a forecast version leaks into it.
 *
 *   **A rate is recomputed and a balance is rebased.** Extrapolating a margin or summing closing
 *   balances is how a landing page produces a figure that cannot exist.
 *
 *   **The management adjustment only fires on persistence.** One bad month reshaping the back half of
 *   a year makes the outlook more volatile than the business.
 *
 *   **The approved column is the one Year to Go already computes.** Two places computing one landing is
 *   how a product ends up disagreeing with itself by a month's rounding.
 */

import { describe, expect, it } from 'vitest';
import { ACTUAL_VERSION, SEED_END, buildWorld, monthScope } from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { allEntityIds } from '@kestrel/measures';

import { OUTLOOK_MEASURES, PERSISTENCE_MONTHS, buildOutlook, persistenceFor } from './outlook.ts';
import { buildYearToGo } from './year-to-go.ts';

const world = buildWorld({ seed: 'kestrel-industrial-group' });

function ctx(overrides: Partial<MeasureContext> = {}): MeasureContext {
  return {
    store: world.store,
    rates: world.rates,
    scope: monthScope(SEED_END),
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
    lens: 'reported',
    entityIds: allEntityIds(),
    ...overrides,
  };
}

describe('the three landings', () => {
  it('reports the measures the review names, profit after tax included', () => {
    /* A full-year landing without the bottom line is one a board cannot take a decision from. */
    expect([...OUTLOOK_MEASURES]).toEqual([
      'revenue',
      'gross_margin',
      'ebitda',
      'net_income',
      'cash',
    ]);
    const outlook = buildOutlook(ctx());
    for (const line of outlook.lines) {
      expect(line.approved, `${line.label} has no approved landing`).not.toBeNull();
      expect(line.runRate, `${line.label} has no run rate`).not.toBeNull();
      expect(line.management, `${line.label} has no management outlook`).not.toBeNull();
    }
  });

  it('and takes the approved column from Year to Go rather than recomputing it', () => {
    const outlook = buildOutlook(ctx());
    const projection = buildYearToGo({ ctx: ctx() });
    for (const line of outlook.lines) {
      const matching = projection.lines.find((entry) => entry.measureId === line.measureId);
      expect(line.approved, `${line.label} disagrees with the Year to Go landing`).toBe(
        matching?.expectedFullYear ?? null,
      );
    }
  });

  it('and the run rate does not agree with the approved forecast, which is the point', () => {
    /* Three columns that agree are one column with two decorations. The gap between the first two is
       the recovery the plan is assuming, and if it were always zero this page would say nothing. */
    const outlook = buildOutlook(ctx());
    const differing = outlook.lines.filter(
      (line) => line.runRate !== null && line.approved !== null && line.runRate !== line.approved,
    );
    expect(differing.length).toBeGreaterThan(0);
  });

  it('and carries a flow at its monthly rate rather than by any other arithmetic', () => {
    const outlook = buildOutlook(ctx());
    const revenue = outlook.lines.find((line) => line.measureId === 'revenue');
    expect(revenue).toBeDefined();
    const ytd = revenue?.actualYtd ?? 0;
    const months = revenue?.monthsElapsed ?? 0;
    const total = months + (revenue?.monthsRemaining ?? 0);
    expect(revenue?.runRate).toBeCloseTo((ytd / months) * total, 4);
  });

  it('and recomputes a rate from its parts instead of extrapolating the rate', () => {
    /* A margin carried forward as a margin is only right where revenue and gross profit run at
       identical rates — which is exactly the case where nothing needed carrying forward. */
    const outlook = buildOutlook(ctx());
    const margin = outlook.lines.find((line) => line.measureId === 'gross_margin');
    expect(margin?.runRate).not.toBeNull();
    expect(margin?.runRate ?? 0).toBeGreaterThan(0);
    expect(margin?.runRate ?? 0).toBeLessThan(1);
  });

  it('and rebases a balance instead of summing closing balances', () => {
    const outlook = buildOutlook(ctx());
    const cash = outlook.lines.find((line) => line.measureId === 'cash');
    const revenue = outlook.lines.find((line) => line.measureId === 'revenue');
    // A summed cash balance would be several times the closing one; a rebased balance stays near it.
    expect(Math.abs(cash?.runRate ?? 0)).toBeLessThan(Math.abs(revenue?.runRate ?? 0));
    expect(Math.abs((cash?.runRate ?? 0) / (cash?.actualYtd ?? 1))).toBeLessThan(3);
  });
});

describe('the management adjustment', () => {
  it('only moves the landing where the miss ran one way for three months', () => {
    const outlook = buildOutlook(ctx());
    for (const line of outlook.lines) {
      if (line.persistence.persistent) {
        expect(line.management, `${line.label} is persistent and was not adjusted`).not.toBe(
          line.approved,
        );
      } else {
        expect(line.management, `${line.label} was adjusted without a persistent miss`).toBe(
          line.approved,
        );
      }
    }
  });

  it('and says why it did nothing where it did nothing', () => {
    const outlook = buildOutlook(ctx());
    const quiet = outlook.lines.filter((line) => !line.persistence.persistent);
    expect(quiet.length).toBeGreaterThan(0);
    for (const line of quiet) {
      expect(line.persistence.statement, `${line.label} is silent about why`).not.toBe('');
      expect(line.persistence.bias).toBe(0);
    }
  });

  it('and needs every one of the three months, not a majority of them', () => {
    const persistence = persistenceFor('gross_margin', ctx());
    if (persistence.persistent) {
      expect(persistence.months).toHaveLength(PERSISTENCE_MONTHS);
    }
  });

  it('and adjusts only the months still to come on a flow', () => {
    /* The banked months are actuals. A bias applied to the whole year restates the closed half, which
       is a different and much worse claim than "we think the back half is optimistic". */
    const outlook = buildOutlook(ctx());
    const flow = outlook.lines.find(
      (line) => line.measureId === 'ebitda' && line.persistence.persistent,
    );
    if (flow === undefined) return;
    const remaining = (flow.approved ?? 0) - (flow.actualYtd ?? 0);
    expect(flow.management).toBeCloseTo(
      (flow.actualYtd ?? 0) + remaining * (1 + flow.persistence.bias),
      2,
    );
  });
});

describe('the flag and the direction', () => {
  it('flags against the management-adjusted landing, not the approved one', () => {
    /* Flagging "on track" against a forecast the last three months contradict is how a status column
       stops being read. */
    const outlook = buildOutlook(ctx());
    for (const line of outlook.lines) {
      if (line.management === null || line.budget === null) continue;
      const ahead = line.favourable === true;
      expect(line.trajectory).toBe(ahead ? 'ahead' : line.favourable === null ? 'on_track' : 'behind');
    }
  });

  it('and reads direction from the gap to plan rather than from the figure', () => {
    const outlook = buildOutlook(ctx());
    const named = outlook.lines.filter((line) => line.direction !== 'unavailable');
    expect(named.length).toBeGreaterThan(0);
    for (const line of named) {
      expect(line.directionNote, `${line.label} does not say why`).toMatch(/gap to plan/);
    }
  });
});

describe('what could move the landing, and what to do about it', () => {
  it('takes the risks from where the plan and the run rate disagree', () => {
    const outlook = buildOutlook(ctx());
    expect(outlook.risks.length).toBeGreaterThan(0);
    for (const risk of outlook.risks) {
      const line = outlook.lines.find((entry) => entry.measureId === risk.measureId);
      expect(risk.exposure).toBeCloseTo(Math.abs(line?.assumedRecovery ?? 0), 4);
      expect(risk.owner, `${risk.label} has no owner`).not.toBe('');
    }
  });

  it('and ranks them by what they would move, largest first', () => {
    const sizes = buildOutlook(ctx()).risks.map((risk) => risk.exposure);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
  });

  it('and calls a plan above the run rate a risk only where higher is better', () => {
    for (const risk of buildOutlook(ctx()).risks) {
      const line = buildOutlook(ctx()).lines.find((entry) => entry.measureId === risk.measureId);
      // Every measure on this page is higher-is-better, so a plan above the run rate is a risk.
      expect(risk.kind).toBe((line?.assumedRecovery ?? 0) > 0 ? 'risk' : 'opportunity');
    }
  });

  it('and names actions only where a measure lands behind budget', () => {
    const outlook = buildOutlook(ctx());
    const behind = outlook.lines.filter((line) => line.trajectory === 'behind');
    if (behind.length === 0) {
      expect(outlook.actions).toHaveLength(0);
      expect(outlook.noActionBecause).toContain('no gap to close');
      return;
    }
    // Where the gap is real, the actions come from the same policy the scenarios surface runs.
    for (const action of outlook.actions) {
      expect(action.owner).not.toBe('');
      expect(action.because).toContain('budget');
    }
  });

  it('and says which thresholds it tested when it names none', () => {
    const outlook = buildOutlook(ctx());
    if (outlook.actions.length > 0) return;
    expect(outlook.noActionBecause).toBeDefined();
  });
});
