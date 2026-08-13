import { describe, expect, it } from 'vitest';

import { contextOf } from '../../../lib/world';
import { resolveAskView } from './route';

describe('the Ask HTTP view boundary', () => {
  it('ignores forged budget and forecast dataset state while retaining ordinary reporting state', () => {
    for (const scenario of ['budget', 'forecast']) {
      const view = resolveAskView('group-executive', {
        scenario,
        version: 'v5',
        period: 'quarter',
        month: '2026-06',
        comparator: 'prior_year',
      });

      expect(contextOf(view)).toMatchObject({
        scenario: 'ACTUAL',
        versionId: 'actual',
        scope: { startMonth: '2026-04', endMonth: '2026-06' },
      });
      expect(view.version.id).toBe('v5');
      expect(view.comparator.id).toBe('prior_year');
    }
  });
});
