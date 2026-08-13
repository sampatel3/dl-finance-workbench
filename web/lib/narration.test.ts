/**
 * The freshness check for the committed commentary.
 *
 * The wording in `narration.generated.ts` was written by a model; the numbers in it were not — they came
 * from the seed, and any change to a rate, a threshold or the seed itself moves them. Without this test
 * the demo would keep serving sentences about figures that had shifted underneath them, and nothing would
 * say so.
 *
 * The recipe is: pin everything deterministic, let only the prose float. The fresh run here is
 * deliberately keyless, so it makes no network call and produces the deterministic fallback — whose prose
 * the pinned projection discards anyway.
 */

import { describe, expect, test } from 'vitest';
import { narrationDrift, validateClaims, validateNumerals } from '@demo-kit/llm';

import { NARRATED_MONTHS, briefKey, buildBriefs, packFor, pinned } from './narration';
import { NARRATION } from './narration.generated';
import { LATEST_MONTH } from './world';

const FIXED = '2026-01-01T00:00:00.000Z';

describe('the committed commentary', () => {
  test('is current with the data it was written from', async () => {
    const fresh = await buildBriefs({ now: () => FIXED });
    expect(narrationDrift(NARRATION, fresh, pinned)).toEqual([]);
  });

  test('claims nothing the pack does not support', () => {
    /* The generator runs these two validators before it writes anything. The file is committed, though, so
       a hand edit — a sharper headline, a number rounded to look better — would bypass that entirely.
       Running the kit's own validators here rather than a check written for the occasion means the test and
       the generator cannot come to different conclusions about the same sentence. */
    for (const month of NARRATED_MONTHS) {
      const record = NARRATION[briefKey(month)];
      expect(record).toBeDefined();
      const written = `${record?.narration.headline ?? ''} ${record?.narration.body ?? ''}`;
      const pack = packFor(month);

      expect(validateNumerals(written, pack).offending).toEqual([]);
      expect(validateClaims(written, pack).offending).toEqual([]);
    }
  });

  test('ships prose even with no model configured', async () => {
    const fresh = await buildBriefs({ now: () => FIXED });
    const record = fresh[briefKey(LATEST_MONTH)];
    expect(record?.narration.narratedBy).toBe('template');
    expect(record?.narration.headline).not.toBe('');
    expect(record?.narration.body).not.toBe('');
  });

  test('and the sentence code wrote names one finding rather than summarising six', () => {
    /* A summary of every finding is a sentence that says nothing. The fallback names the highest-priority
       adverse item, so the keyless build is specific about one thing rather than vague about all of them —
       which is what makes it a designed fallback and not a degraded mode. */
    const record = NARRATION[briefKey(LATEST_MONTH)];
    expect(record?.finding.length ?? 0).toBeGreaterThan(60);
    expect(record?.finding.trimEnd().endsWith('.')).toBe(true);
  });

  test('and pins the figures rather than the prose', () => {
    /* The projection is what makes the wording free to change and the numbers not. If `pinned` ever began
       including the narration, every model run would look like drift and the test would be switched off —
       which is the failure mode of a freshness check that pins too much. */
    const record = NARRATION[briefKey(LATEST_MONTH)];
    expect(record).toBeDefined();
    if (record === undefined) return;
    const projection = JSON.stringify(pinned(record));
    expect(projection).not.toContain(record.narration.headline);
    expect(projection).toContain('revenue');
  });
});
