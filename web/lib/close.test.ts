import { describe, expect, it } from 'vitest';

import { closeStatusCopy } from './close';

describe('finance close status copy', () => {
  it('uses singular 1/1 wording for a final single-ledger scope', () => {
    expect(closeStatusCopy({ closed: 1, total: 1, openNames: [] })).toEqual({
      summary: '1/1 ledger closed — period final.',
      final: true,
    });
  });

  it('uses compact 5/5 wording for a final group close', () => {
    expect(closeStatusCopy({ closed: 5, total: 5, openNames: [] })).toEqual({
      summary: '5/5 ledgers closed — period final.',
      final: true,
    });
  });

  it('names the outstanding ledger for an incomplete 4/5 close', () => {
    expect(closeStatusCopy({ closed: 4, total: 5, openNames: ['Kestrel Gulf'] })).toEqual({
      summary: '4/5 ledgers closed — period not final.',
      detail: 'Outstanding: Kestrel Gulf has submitted but not closed.',
      final: false,
    });
  });
});
