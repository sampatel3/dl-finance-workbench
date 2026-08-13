import { describe, expect, it } from 'vitest';

import { SURFACES, surfaceFor } from './navigation';

describe('finance-native navigation', () => {
  it('follows the finance decision flow and leaves ad-hoc analysis until last', () => {
    expect(SURFACES.map((surface) => surface.label)).toEqual([
      'Overview',
      'Performance',
      'Forecast',
      'Year to Go',
      'Cash & WC',
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
