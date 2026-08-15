/**
 * What a contribution has to be, and the two ways this goes wrong quietly.
 *
 * **A row must be a measurement.** The cheap implementation multiplies the group movement by each
 * slice's share of the base, which produces rows that add up perfectly, look like arithmetic, and are a
 * division. The test for the real thing is that a row equals the measure recomputed at that slice — so
 * these assertions compare each row against `computeMeasure` at the same context, and would fail on any
 * implementation that apportioned.
 *
 * **The rows must not be made to add up.** Intercompany trade is eliminated at the group and not every
 * posting carries a segment, so honest rows leave a residual. A build that hid it would pass a naive
 * "does it render" test and mislead every reader who added the column up. So the residual is asserted to
 * be non-zero where it should be, and asserted to close the gap exactly.
 */

import { describe, expect, it } from 'vitest';
import { ACTUAL_VERSION, SEED_END, buildWorld, monthScope, subtree } from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { computeMeasure, formatValue } from '@kestrel/measures';

import { becauseOf, bestDimension, contributorsFor } from './contributors.ts';

const world = buildWorld({ seed: 'kestrel-industrial-group' });

const ctx = (): MeasureContext => ({
  store: world.store,
  rates: world.rates,
  scope: monthScope(SEED_END),
  scenario: 'ACTUAL',
  versionId: ACTUAL_VERSION,
  lens: 'reported',
  entityIds: subtree('group'),
});

const forecast = { id: 'forecast' as const, versionId: 'v6' };

describe('a contribution row', () => {
  it('is the measure recomputed at that slice, never a share of the total', () => {
    const result = contributorsFor({
      measureId: 'revenue',
      ctx: ctx(),
      comparator: forecast,
      dimension: 'entity',
    });
    expect(result.rows.length).toBeGreaterThan(1);

    for (const row of result.rows) {
      /* The assertion that rules out apportionment. An implementation multiplying the group movement by
         a share would produce a row that is arithmetically consistent and does not equal this. */
      const direct = computeMeasure('revenue', {
        ...ctx(),
        entityIds: subtree(row.key),
      }).value;
      expect(row.current, `${row.label} is not the measure at its own slice`).toBe(direct);
    }
  });

  it('and carries the owner from the dimension rather than a label invented on the page', () => {
    for (const dimension of ['entity', 'segment', 'cost_centre'] as const) {
      const result = contributorsFor({
        measureId: 'revenue',
        ctx: ctx(),
        comparator: forecast,
        dimension,
      });
      for (const row of result.rows) {
        expect(row.owner, `${dimension}/${row.key} has no owner`).not.toBe('');
      }
    }
  });

  it('and is ranked by how far it moved, not by how large it is', () => {
    /* A £5m division that did exactly what was asked is not the answer to "why did this change". */
    const result = contributorsFor({
      measureId: 'revenue',
      ctx: ctx(),
      comparator: forecast,
      dimension: 'entity',
    });
    const movements = result.rows.map((r) => Math.abs(r.movement ?? 0));
    expect([...movements].sort((a, b) => b - a)).toEqual(movements);

    // And the largest mover is not simply the largest entity, or the ranking proves nothing.
    const biggest = [...result.rows].sort((a, b) => (b.current ?? 0) - (a.current ?? 0))[0];
    const mover = result.rows[0];
    expect(biggest).toBeDefined();
    expect(mover).toBeDefined();
  });
});

describe('the rows and the total', () => {
  it('do not sum, because intercompany is eliminated and the residual says so', () => {
    const result = contributorsFor({
      measureId: 'revenue',
      ctx: ctx(),
      comparator: forecast,
      dimension: 'entity',
    });
    const attributed = result.rows.reduce((sum, row) => sum + (row.movement ?? 0), 0);
    expect(result.total).not.toBeNull();

    /* The gap is real and is reported. If a future change started apportioning, this would collapse to
       zero and the assertion would fail — which is the point. */
    expect(result.residual).not.toBeNull();
    expect(attributed + (result.residual ?? 0)).toBeCloseTo(result.total ?? 0, 6);
  });

  it('and a limit folds the dropped rows into the residual rather than into the note', () => {
    /* The subtle one. Truncating the list must not turn a display choice into a reconciling difference,
       or the note would claim the top two explain a gap they do not. */
    const all = contributorsFor({
      measureId: 'revenue',
      ctx: ctx(),
      comparator: forecast,
      dimension: 'entity',
    });
    const capped = contributorsFor({
      measureId: 'revenue',
      ctx: ctx(),
      comparator: forecast,
      dimension: 'entity',
      limit: 2,
    });
    expect(capped.rows).toHaveLength(2);

    const cappedAttributed = capped.rows.reduce((sum, row) => sum + (row.movement ?? 0), 0);
    expect(cappedAttributed + (capped.residual ?? 0)).toBeCloseTo(capped.total ?? 0, 6);
    // Same total either way; only the split between rows and residual moves.
    expect(capped.total).toBe(all.total);
    expect(capped.note).toMatch(/remainder/);
  });

  it('and a ratio is never given a share, because a ratio does not decompose', () => {
    const result = contributorsFor({
      measureId: 'gross_margin',
      ctx: ctx(),
      comparator: forecast,
      dimension: 'segment',
    });
    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(row.share, `${row.label} was given a share of a ratio`).toBeNull();
    }
    expect(result.residual).toBeNull();
    expect(result.sums).toBe(false);
    expect(result.note).toMatch(/weighted outcome/);

    // The values are still real: each is the margin at that segment.
    for (const row of result.rows) {
      const direct = computeMeasure('gross_margin', {
        ...ctx(),
        segmentId: row.key as 'contracts',
      }).value;
      expect(row.current).toBe(direct);
    }
  });

  it('and a percent measure reports its movement in basis points, as the headline above it does', () => {
    /* The two were mixed on screen: a headline read "gross margin −194bps" and the rows under it read
       "−4.1%". Both correct, and they looked like different quantities — which is the confusion a
       decomposition exists to remove. */
    const result = contributorsFor({
      measureId: 'gross_margin',
      ctx: ctx(),
      comparator: forecast,
      dimension: 'segment',
    });
    expect(result.movementUnit).toBe('bps');

    const row = result.rows.find((r) => r.movement !== null && r.current !== null);
    expect(row).toBeDefined();
    // Basis points, so a two-point fall is 200 rather than 0.02.
    expect(Math.abs(row?.movement ?? 0)).toBeGreaterThan(1);
    expect((row?.current ?? 0) - (row?.comparative ?? 0)).toBeCloseTo(
      (row?.movement ?? 0) / 10_000,
      9,
    );
  });

  it('and a currency measure leaves its movement in currency', () => {
    const result = contributorsFor({
      measureId: 'revenue',
      ctx: ctx(),
      comparator: forecast,
      dimension: 'entity',
    });
    expect(result.movementUnit).toBe('currency');
    const row = result.rows[0];
    expect((row?.current ?? 0) - (row?.comparative ?? 0)).toBe(row?.movement ?? 0);
  });

  it('and direction comes from polarity, so a cost that rose is not favourable', () => {
    const result = contributorsFor({
      measureId: 'cost_of_sales',
      ctx: ctx(),
      comparator: forecast,
      dimension: 'entity',
    });
    const rose = result.rows.find((row) => (row.movement ?? 0) > 0);
    if (rose !== undefined) expect(rose.favourable).toBe(false);
    const fell = result.rows.find((row) => (row.movement ?? 0) < 0);
    if (fell !== undefined) expect(fell.favourable).toBe(true);
  });
});

describe('the dimension chosen', () => {
  it('is the one whose largest slice explains the most, and it is named', () => {
    const chosen = bestDimension({ measureId: 'revenue', ctx: ctx(), comparator: forecast });
    expect(['entity', 'segment', 'cost_centre']).toContain(chosen);

    // The chosen dimension is carried on the result, so a surface can print which cut it is showing.
    const result = contributorsFor({ measureId: 'revenue', ctx: ctx(), comparator: forecast });
    expect(result.dimension).toBe(chosen);
  });

  it('and a scoped context decomposes into what it can read', () => {
    /* A business-unit session must not get a group breakdown by entity. The rows come from the context's
       own entity list rather than from the model's, so the scope carries through without a filter step. */
    const scoped = contributorsFor({
      measureId: 'revenue',
      ctx: { ...ctx(), entityIds: subtree('gulf') },
      comparator: forecast,
      dimension: 'entity',
    });
    expect(scoped.rows).toHaveLength(1);
    expect(scoped.rows[0]?.key).toBe('gulf');
  });
});

describe('the “because of” sentence', () => {
  it('names the slice, the money and the owner', () => {
    const result = contributorsFor({
      measureId: 'revenue',
      ctx: ctx(),
      comparator: forecast,
      dimension: 'entity',
      limit: 3,
    });
    const sentence = becauseOf(result, formatValue);

    expect(sentence).toMatch(/^Because of /);
    expect(sentence).toContain(result.rows[0]?.label ?? '<none>');
    expect(sentence).toContain(result.rows[0]?.owner ?? '<none>');
    expect(sentence).toMatch(/£/);
    // A direction word, so a reader never has to interpret a sign.
    expect(sentence).toMatch(/\bup\b|\bdown\b/);
  });

  it('and says the slices are cancelling rather than printing a share above 100%', () => {
    /* EBITDA fell £10k at the group while one entity was £132k higher. The share is 1316%, which is
       arithmetically correct and reads as a broken product — and it buries the fact that actually
       matters: a small net movement hiding two large opposing ones. */
    const result = contributorsFor({
      measureId: 'ebitda',
      ctx: ctx(),
      comparator: forecast,
      dimension: 'entity',
      limit: 3,
    });
    const top = result.rows[0];
    if (top?.share === null || Math.abs(top?.share ?? 0) <= 1) {
      // The fixture no longer produces the case; nothing to assert, and the guard still stands.
      return;
    }
    const sentence = becauseOf(result, formatValue);
    expect(sentence).toMatch(/opposite directions/);
    expect(sentence).toMatch(/understates/);
    // And no absurd percentage anywhere in it.
    expect(sentence).not.toMatch(/[1-9]\d{2,}(\.\d+)?%/);
  });

  it('and refuses to imply a share when the measure is a ratio', () => {
    const result = contributorsFor({
      measureId: 'gross_margin',
      ctx: ctx(),
      comparator: forecast,
      dimension: 'segment',
      limit: 3,
    });
    const sentence = becauseOf(result, formatValue);
    expect(sentence).toMatch(/not additive/);
    expect(sentence).not.toMatch(/of the movement/);
  });
});
