/**
 * The new-code control, and the two things it must not become.
 *
 * **It must not be the unmapped panel again.** An unmapped code is a problem already carrying value; a
 * new code may map perfectly and most do. If every new code in the fixture were also unmapped, the
 * control would be a second rendering of the mapping exception and the review's point — that this is the
 * *earlier* signal — would be lost. So the fixture is asserted to contain a code that is authorised and
 * not yet a problem.
 *
 * **Authorisation and mapping must stay independent.** They fail for different reasons and are fixed by
 * different people: an unmapped code needs a mapping request, an unauthorised one needs a conversation
 * about who is opening accounts. A build that collapsed them into one "bad code" flag would report the
 * smaller number and call it the exposure.
 */

import { describe, expect, it } from 'vitest';

import { CODE_REVIEW_WINDOW_DAYS, NEW_GL_CODES, glCodeControl } from './gl-codes.ts';
import { subtree } from './entities.ts';
import { buildWorld } from './seed.ts';
import { mappingSetFor } from './vintages.ts';

const MONTH = '2026-07';

describe('the new-code control', () => {
  it('reports codes created in the month, with a creator and a date', () => {
    const control = glCodeControl(MONTH);
    expect(control.created).toBeGreaterThan(0);
    for (const code of control.codes) {
      expect(code.createdIn).toBe(MONTH);
      expect(code.createdBy, `${code.sourceCode} has no creator`).not.toBe('');
      // Stated timestamps, never a clock reading — the demo must read the same next month.
      expect(code.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    }
  });

  it('and is not a second rendering of the unmapped panel', () => {
    /* At least one code that is authorised and not unmapped, or this control has nothing to say that
       the mapping exception does not already say louder. */
    const control = glCodeControl(MONTH);
    const clean = control.codes.filter((code) => code.authorised && code.mapping !== 'unmapped');
    expect(clean.length, 'every new code is also a mapping exception').toBeGreaterThan(0);
  });

  it('and keeps authorisation independent of mapping', () => {
    const control = glCodeControl(MONTH);
    // One code fails the standard, at least one fails mapping, and they are not the same set.
    expect(control.unauthorised).toBeGreaterThan(0);
    expect(control.unmapped).toBeGreaterThan(0);
    const authorisedButUnmapped = control.codes.filter(
      (code) => code.authorised && code.mapping === 'unmapped',
    );
    expect(authorisedButUnmapped.length, 'the two states always agree').toBeGreaterThan(0);
  });

  it('and counts exposure on either failure, not on both', () => {
    /* Requiring both would report the smaller number and call it the exposure. Either failure on its
       own puts a balance somewhere a reader cannot rely on. */
    const control = glCodeControl(MONTH);
    const expected = control.codes
      .filter((code) => !code.authorised || code.mapping !== 'mapped')
      .reduce((sum, code) => sum + code.postedMinor, 0);
    expect(control.atRiskMinor).toBe(expected);

    const both = control.codes
      .filter((code) => !code.authorised && code.mapping !== 'mapped')
      .reduce((sum, code) => sum + code.postedMinor, 0);
    expect(control.atRiskMinor).toBeGreaterThan(both);
  });

  it('and its unmapped codes are the ones the mapping set could not place', () => {
    /* One fact, two readings. Two lists that happen to agree today are two lists that disagree the
       month somebody edits one of them. */
    const world = buildWorld({ seed: 'kestrel-industrial-group' });
    const mapping = mappingSetFor(world.mappingSets, MONTH);
    const unmappedCodes = new Set((mapping?.unmapped ?? []).map((row) => row.sourceCode));

    const control = glCodeControl(MONTH);
    for (const code of control.codes.filter((c) => c.mapping === 'unmapped')) {
      expect(
        unmappedCodes,
        `${code.sourceCode} is unmapped here and not in the mapping set`,
      ).toContain(code.sourceCode);
    }
  });

  it('and is scoped to the entities a session can read', () => {
    const scoped = glCodeControl(MONTH, subtree('services'));
    expect(scoped.created).toBeGreaterThan(0);
    for (const code of scoped.codes) expect(code.entityId).toBe('services');
    expect(scoped.created).toBeLessThan(glCodeControl(MONTH).created);
  });

  it('and a month with no new codes reports none rather than throwing', () => {
    const quiet = glCodeControl('2026-02');
    expect(quiet.created).toBe(0);
    expect(quiet.atRiskMinor).toBe(0);
    // The alert still exists: the control ran and found nothing, which is a different thing from
    // the control not running.
    expect(quiet.alert.recipient).not.toBe('');
  });
});

describe('the alert', () => {
  it('names who acts, by when, and what goes wrong if nobody does', () => {
    const control = glCodeControl(MONTH);
    expect(control.alert.recipient).toBe('Group Financial Controller');
    expect(control.alert.reviewWindowDays).toBe(CODE_REVIEW_WINDOW_DAYS);
    expect(control.alert.dueBy > control.alert.raisedAt).toBe(true);
    // A deadline without a consequence is a notification, and a notification about a control is one
    // nobody actions.
    expect(control.alert.risk).toMatch(/comparability|outside the reported/);
  });

  it('and is never marked as sent, because nothing is', () => {
    /* The type pins this to `false`, so a future change that starts claiming delivery has to change
       the type — which is a conversation rather than a commit. */
    expect(glCodeControl(MONTH).alert.sent).toBe(false);
  });
});

describe('the fixture', () => {
  it('carries a mix rather than only bad news', () => {
    /* A month of clean codes shows a control that has never had to do anything; a month of bad ones
       is a demo about a broken finance function rather than about a control that works. */
    expect(NEW_GL_CODES.some((code) => code.authorised)).toBe(true);
    expect(NEW_GL_CODES.some((code) => !code.authorised)).toBe(true);
    expect(NEW_GL_CODES.some((code) => code.mapping === 'pending_review')).toBe(true);
  });
});
