import { describe, expect, it } from 'vitest';

import { SURFACES, surfaceFor } from './navigation';

describe('finance-native navigation', () => {
  it('follows the finance decision flow and leaves ad-hoc analysis until last', () => {
    /* People sits after Cash and before KPIs: payroll is the largest controllable cost line, so it
       belongs with the money rather than in the indicator section — and the workforce numbers on it
       are the ones that explain next quarter's margin, which is what KPIs is for. */
    expect(SURFACES.map((surface) => surface.label)).toEqual([
      'Overview',
      'Performance',
      'Forecast',
      'Year to Go',
      'Cash & WC',
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
