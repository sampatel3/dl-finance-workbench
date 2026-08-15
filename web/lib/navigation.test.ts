import { describe, expect, it } from 'vitest';

import { SURFACES, surfaceFor } from './navigation';

describe('finance-native navigation', () => {
  it('follows the finance decision flow and leaves ad-hoc analysis until last', () => {
    /* Capex and People sit after Cash and before KPIs. Both are cost bases rather than indicators —
       a commitment consumes cash and payroll is the largest controllable line — so they belong with
       the money. Capex first because it is the one that moves the balance sheet as well. */
    expect(SURFACES.map((surface) => surface.label)).toEqual([
      'Overview',
      'Performance',
      'Forecast',
      'Year to Go',
      'Cash & WC',
      'Capex & Procurement',
      'People',
      'KPIs',
      'Scenarios',
      'Commentary',
      'Quality & Controls',
      'Explore & Ask',
    ]);
  });

  it('treats forecast quality and controller evidence as one finance domain', () => {
    expect(surfaceFor('/app/quality')?.label).toBe('Quality & Controls');
    expect(surfaceFor('/app/controls')?.label).toBe('Quality & Controls');
  });
});
