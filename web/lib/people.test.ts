/**
 * Headcount and people cost.
 *
 * What has to be true for a people page to be worth a chief financial officer's time:
 *
 *   **Headcount and cost per head are separable.** A staff cost 6% over plan means one thing at flat
 *   headcount and another at 6% more people. A page carrying only the cost has reported that something
 *   happened without reporting what.
 *
 *   **Every rate is computed, not stored.** The same rule that made the group's net promoter score
 *   render as 19,319. Cost per FTE, contractor share and the vacancy rate all resolve more than one
 *   account, and this file asserts it mechanically rather than trusting the catalogue.
 *
 *   **The department share is against what this session may read.** A percentage of a group a reader
 *   cannot see is a leak wearing a percent sign.
 *
 *   **The loop is in the data.** Attrition, vacancies and the contractor mix are seeded from the same
 *   term as the margin, so the page's own paragraph is a reading of the figures rather than a claim
 *   about them. Asserted by checking the entity with the worst turnover also carries the heaviest
 *   contractor mix.
 */

import { describe, expect, it } from 'vitest';
import { computeMeasure, measure } from '@kestrel/measures';

import { PEOPLE_MEASURES, WORKFORCE_MEASURES, buildPeople } from './people';
import { contextOf, viewOf } from './world';

const view = () => viewOf();

describe('the cost of the workforce', () => {
  it('carries the lines the review names', () => {
    const ids = buildPeople(view()).lines.map((line) => line.measureId);
    for (const required of [
      'staff_cost',
      'headcount',
      'cost_per_fte',
      'contractor_share',
      'open_roles',
    ]) {
      expect(ids, `${required} is missing from the people page`).toContain(required);
    }
  });

  it('and every measure it declares resolves', () => {
    for (const id of [...PEOPLE_MEASURES, ...WORKFORCE_MEASURES]) {
      expect(() => measure(id), `${id} is not in the catalogue`).not.toThrow();
    }
  });

  it('and quotes the figure the measure layer produced, on the window it says it used', () => {
    const people = buildPeople(view());
    const ctx = contextOf(view());
    for (const line of people.lines) {
      expect(line.value, `${line.label} was not read from the measure layer`).toBe(
        computeMeasure(line.measureId, ctx).value,
      );
    }

    /* The workforce half is read year to date, and that has to be the *stated* window rather than an
       undocumented widening — a rate quoted over one period under a heading naming another is the
       quietest way for a page to be wrong. */
    const yearToDate = {
      ...ctx,
      scope: {
        type: 'YTD' as const,
        startMonth: `${ctx.scope.endMonth.slice(0, 4)}-01` as typeof ctx.scope.endMonth,
        endMonth: ctx.scope.endMonth,
        label: people.workforceWindow,
      },
    };
    expect(people.workforceWindow).toMatch(/^Year to date/);
    for (const line of people.workforce) {
      expect(line.value, `${line.label} is not the year-to-date figure`).toBe(
        computeMeasure(line.measureId, yearToDate).value,
      );
    }
  });

  it('and does not let a rounded leaver at the smallest entity top the group', () => {
    /* The defect this window exists to fix, pinned. Over one month Kestrel Inc reported 3.2% turnover
       — the highest in the group — from a single departure rounding up on 31 people, while the entity
       actually under pressure sat at 1.7%. */
    const entities = buildPeople(viewOf({ as: 'group-executive' })).entities;
    const smallest = [...entities].sort((a, b) => (a.headcount ?? 0) - (b.headcount ?? 0))[0];
    const worst = [...entities].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))[0];
    expect(smallest?.entityId).not.toBe(worst?.entityId);
  });

  it('and separates headcount from cost per head, which is the point of the table', () => {
    const people = buildPeople(view());
    const heads = people.lines.find((line) => line.measureId === 'headcount');
    const perFte = people.lines.find((line) => line.measureId === 'cost_per_fte');
    const cost = people.lines.find((line) => line.measureId === 'staff_cost');
    expect(heads?.value).not.toBeNull();
    expect(perFte?.value).not.toBeNull();
    expect(cost?.value).not.toBeNull();
    // Annualised, so a monthly view's cost per FTE is far larger than that month's payroll per head.
    expect(perFte?.value ?? 0).toBeGreaterThan((cost?.value ?? 0) / (heads?.value ?? 1));
  });

  it('and holds no rate as a stored figure', () => {
    /* The rule that broke once already, asserted here rather than remembered: a percent measure whose
       compute reads one account is a rate that was stored, and a stored rate sums across entities. */
    for (const id of [...PEOPLE_MEASURES, ...WORKFORCE_MEASURES]) {
      const definition = measure(id);
      if (definition.unit !== 'percent') continue;
      const source = definition.compute.toString();
      expect(source, `${id} looks like a stored rate`).toMatch(/\/|div\(/);
    }
  });
});

describe('by department and by entity', () => {
  it('reports every department that has people, with an owner', () => {
    const departments = buildPeople(view()).departments;
    expect(departments.length).toBeGreaterThan(2);
    for (const row of departments) {
      expect(row.headcount ?? 0).toBeGreaterThan(0);
      expect(row.owner, `${row.label} has no owner`).not.toBe('');
    }
  });

  it('and takes the share against the readable group, so it cannot exceed the whole', () => {
    const departments = buildPeople(view()).departments;
    const total = departments.reduce((sum, row) => sum + (row.share ?? 0), 0);
    expect(total).toBeGreaterThan(0.9);
    expect(total).toBeLessThan(1.1);
  });

  it('and shows only the entities this principal may read', () => {
    /* A business-unit controller gets their own entity and no sight of its siblings' payroll, which is
       the same row-level rule every other surface applies rather than a second, looser one. */
    const group = buildPeople(viewOf({ as: 'group-executive' }));
    const unit = buildPeople(viewOf({ as: 'gulf-controller' }));
    expect(group.entities.length).toBeGreaterThan(unit.entities.length);
    expect(unit.entities.every((row) => row.entityId === 'gulf')).toBe(true);
  });
});

describe('the loop', () => {
  it('puts the heaviest contractor mix where the turnover is worst', () => {
    /* Not a coincidence and not asserted in prose: both are seeded from the strain the subcontract mix
       produces, so a reader who follows the page's own argument finds it holds. */
    const entities = buildPeople(viewOf({ as: 'group-executive' })).entities;
    const byTurnover = [...entities].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0));
    const byContractor = [...entities].sort(
      (a, b) => (b.contractorShare ?? 0) - (a.contractorShare ?? 0),
    );
    expect(byTurnover[0]?.entityId).toBe(byContractor[0]?.entityId);
  });

  it('and states it from the figures rather than asserting it', () => {
    const people = buildPeople(view());
    const cost = people.lines.find((line) => line.measureId === 'staff_cost');
    expect(people.story).toContain(cost?.comparatorLabel ?? '<none>');
    expect(people.story).toMatch(/headcount|cost per head/);
    expect(people.story).toMatch(/bought-in labour/);
  });

  it('and does not name a driver the table beside it renders as flat', () => {
    /* The paragraph and the table have to agree about what moved. A cost per FTE movement of 0.0004
       is not zero and renders as "+0.0%" — and the first cut of this sentence, keyed on `!== 0`,
       announced a move in a figure the reader could see was flat. */
    const people = buildPeople(view());
    const flat = people.lines.filter(
      (line) => line.movement !== null && Math.abs(line.movement) < 0.005,
    );
    for (const line of flat) {
      if (line.measureId !== 'cost_per_fte' && line.measureId !== 'headcount') continue;
      const named = line.measureId === 'headcount' ? 'headcount' : 'cost per head';
      expect(
        people.story.includes(`entirely from ${named}`) ||
          people.story.includes('from both headcount and cost per head'),
        `${line.label} is flat but the paragraph credits it`,
      ).toBe(false);
    }
  });
});
