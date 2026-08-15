/**
 * The information architecture.
 *
 * The order used to be the whole of this file's subject, because the nav was a flat bar. It is a rail
 * with four groups now, and what has to hold is different:
 *
 *   **Every surface belongs to exactly one group.** A destination with no group is unreachable from
 *   the rail while still existing — the specific failure the single-list design exists to prevent.
 *
 *   **The groups are questions, in the order they get asked.** Position, then outlook, then what is
 *   exposed, then what gets signed. A reader who works down the rail works through their month.
 *
 *   **Explore & Ask is not filed under a question.** It is the tool for when the answer is not on a
 *   page, and putting it inside a heading claims it belongs to one subject.
 */

import { describe, expect, it } from 'vitest';

import { NAV_GROUPS, SURFACES, groupFor, surfaceFor, surfacesIn } from './navigation';

describe('finance-native navigation', () => {
  it('asks the four questions in the order a month asks them', () => {
    expect(NAV_GROUPS.map((group) => group.id)).toEqual([
      'position',
      'outlook',
      'commitments',
      'assurance',
      'tools',
    ]);
    for (const group of NAV_GROUPS) {
      expect(group.question, `${group.id} has no question`).toMatch(/\?$|\./);
    }
  });

  it('and files every surface under exactly one of them', () => {
    /* A surface with no group is reachable by URL and invisible in the rail, which is the failure
       generating the nav from one list exists to prevent. */
    const grouped = NAV_GROUPS.flatMap((group) => surfacesIn(group.id));
    expect(grouped).toHaveLength(SURFACES.length);
    expect(new Set(grouped.map((surface) => surface.path)).size).toBe(SURFACES.length);
  });

  it('and follows the finance decision flow, leaving ad-hoc analysis until last', () => {
    /* Scenarios sits with Forecast and Year to Go rather than after KPIs, which is this build's one
       departure from the review's slide 3: a scenario is a question about the outlook, and a reader
       who has just seen where the year lands is one click from asking what would change it. */
    expect(SURFACES.map((surface) => surface.label)).toEqual([
      'Overview',
      'Performance',
      'KPIs',
      'Forecast',
      'Year to Go',
      'Scenarios',
      'Cash & WC',
      'Capex & Procurement',
      'People',
      'Commentary',
      'Quality & Controls',
      'Explore & Ask',
    ]);
  });

  it('and keeps the tool out of the questions', () => {
    expect(surfacesIn('tools').map((surface) => surface.label)).toEqual(['Explore & Ask']);
    // No eyebrow: a heading over one tool claims it belongs to a subject.
    expect(NAV_GROUPS.find((group) => group.id === 'tools')?.label).toBe('');
  });

  it('treats forecast quality and controller evidence as one finance domain', () => {
    expect(surfaceFor('/app/quality')?.label).toBe('Quality & Controls');
    expect(surfaceFor('/app/controls')?.label).toBe('Quality & Controls');
    // Both specialist paths resolve to the same group, so the rail highlights one entry either way.
    expect(groupFor('/app/quality')?.id).toBe('assurance');
    expect(groupFor('/app/controls')?.id).toBe('assurance');
  });

  it('and puts the money sections together, because they are three kinds of commitment', () => {
    expect(surfacesIn('commitments').map((surface) => surface.label)).toEqual([
      'Cash & WC',
      'Capex & Procurement',
      'People',
    ]);
  });
});
