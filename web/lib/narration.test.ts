/**
 * The freshness check for the committed brief.
 *
 * The wording in `narration.generated.ts` was written by a model; the numbers in it were
 * not — they came from the seed, and any change to a rate, a threshold or the seed itself
 * moves them. Without this test the demo would keep serving sentences about figures that had
 * shifted underneath them, and nothing would say so.
 *
 * The recipe is: pin everything deterministic, let only the prose float. The fresh run here
 * is deliberately keyless, so it makes no network call and produces the template fallback —
 * whose prose is discarded by the pinned projection anyway.
 */

import { describe, expect, test } from 'vitest';
import { narrationDrift, validateClaims, validateNumerals } from '@demo-kit/llm';
import { NETWORK_BRIEF, buildBriefs, networkPack, pinned } from './narration';
import { NARRATION } from './narration.generated';

const FIXED = '2026-01-01T00:00:00.000Z';

describe('the committed narration', () => {
  test('is current with the data it was written from', async () => {
    const fresh = await buildBriefs({ now: () => FIXED });
    expect(narrationDrift(NARRATION, fresh, pinned)).toEqual([]);
  });

  test('claims nothing the pack does not support', () => {
    /* The generator runs these two validators before it writes anything. The file is
       committed, though, so a hand edit — a sharper headline, a number rounded to look
       better — would bypass that entirely. Running the kit's own validators here rather
       than a check written for the occasion means the test and the generator cannot come
       to different conclusions about the same sentence. */
    const record = NARRATION[NETWORK_BRIEF];
    expect(record).toBeDefined();
    const written = `${record?.narration.headline ?? ''} ${record?.narration.body ?? ''}`;
    const pack = networkPack();

    expect(validateNumerals(written, pack).offending).toEqual([]);
    expect(validateClaims(written, pack).offending).toEqual([]);
  });

  test('ships prose even with no model configured', async () => {
    const fresh = await buildBriefs({ now: () => FIXED });
    const record = fresh[NETWORK_BRIEF];
    expect(record?.narration.narratedBy).toBe('template');
    expect(record?.narration.headline).not.toBe('');
    expect(record?.narration.body).not.toBe('');
  });
});
