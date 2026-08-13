import { describe, expect, it } from 'vitest';

import { TOUR } from './tour';

describe('the finance-native guided tour', () => {
  it('covers the implemented decision flow and ends in Explore & Ask', () => {
    expect(TOUR.steps).toHaveLength(12);
    expect(TOUR.steps.map((step) => step.short)).toEqual([
      'The position',
      'What changed',
      'Profitability',
      'The forecast',
      'Year to go',
      'Liquidity',
      'KPIs',
      'The scenario',
      'Commentary',
      'Forecast quality',
      'Controls',
      'Explore & Ask',
    ]);
  });

  it('opens the forecast stop on the v6-to-v7 comparison it promises', () => {
    const forecast = new URL(TOUR.steps[3]?.href ?? '', 'https://demo.invalid');

    expect(forecast.pathname).toBe('/app/forecast');
    expect(forecast.searchParams.get('from')).toBe('v6');
    expect(forecast.searchParams.get('version')).toBe('v7');
    expect(forecast.searchParams.get('focus')).toBe('section-diff');
  });

  it('opens the new decision views and exact cited-measure summary', () => {
    expect(new URL(TOUR.steps[4]?.href ?? '', 'https://demo.invalid').pathname).toBe(
      '/app/year-to-go',
    );
    expect(new URL(TOUR.steps[6]?.href ?? '', 'https://demo.invalid').pathname).toBe('/app/kpis');

    const explore = new URL(TOUR.steps.at(-1)?.href ?? '', 'https://demo.invalid');
    expect(explore.pathname).toBe('/app/explore');
    expect(explore.searchParams.get('measure')).toBe('ebitda');
    expect(explore.searchParams.get('focus')).toBe('section-cited-measure');
  });
});
