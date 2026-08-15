/**
 * The board story, and the balance-sheet movement under it.
 *
 * What has to be true for prose written by code to be worth printing:
 *
 *   **Every figure in a paragraph is one the measure layer produced.** The sentence is composed from the
 *   comparisons beside it, so a reader who checks the paragraph against the table finds them identical.
 *   Asserted by recomputing each figure and looking for it in the text.
 *
 *   **Three bases, not one.** Each alone is a trap — forecast flatters a business that re-forecast down,
 *   prior month reads seasonality as performance, prior year reads a re-shaped business as decline. A
 *   build that quietly dropped one would still render seven tidy paragraphs.
 *
 *   **The balance sheet moves against the prior month.** Against forecast it would answer a question
 *   nobody asked of a balance sheet, in the same layout.
 */

import { describe, expect, it } from 'vitest';
import { SEED_END, addMonths, monthScope } from '@kestrel/model';
import { computeMeasure, formatValue } from '@kestrel/measures';

import { MOVEMENT_LINES, STORY_LINES, buildMovements, buildStory } from './story';
import { contextOf, viewOf } from './world';

const view = () => viewOf();

describe('the monthly story', () => {
  it('has the seven paragraphs the review names, in profit-and-loss order', () => {
    const story = buildStory(view());
    expect(story.map((p) => p.heading)).toEqual([
      'Revenue',
      'Cost of sales',
      'Gross margin',
      'Overheads',
      'EBITDA',
      'Profit after tax',
      'Cash and capital spend',
    ]);
    expect(STORY_LINES).toHaveLength(7);
  });

  it('and opens each paragraph with the figure the measure layer produced', () => {
    const story = buildStory(view());
    const ctx = contextOf(view());
    for (const paragraph of story) {
      const direct = computeMeasure(paragraph.measureId, ctx).value;
      expect(paragraph.value).toBe(direct);
      // The figure is in the prose, not merely beside it — the sentence has to stand alone in a pack.
      expect(paragraph.text, `${paragraph.heading} does not quote its own figure`).toContain(
        formatValue(direct, paragraph.unit),
      );
    }
  });

  it('and carries three comparison bases on every paragraph', () => {
    /* Dropping one would still render seven tidy paragraphs, which is exactly why this is asserted
       rather than reviewed. */
    const story = buildStory(view());
    for (const paragraph of story) {
      expect(paragraph.comparisons, `${paragraph.heading} has fewer than three bases`).toHaveLength(
        3,
      );
      const labels = paragraph.comparisons.map((c) => c.label).join(' | ');
      expect(labels).toMatch(/a year earlier/);
      expect(labels).toMatch(new RegExp(addMonths(SEED_END, -1).slice(0, 4)));
    }
  });

  it('and says direction in words rather than leaving a sign to interpret', () => {
    const story = buildStory(view());
    for (const paragraph of story) {
      expect(paragraph.text).toMatch(/higher|lower|unchanged|not comparable/);
    }
  });

  it('and quotes a ratio in basis points, as the rest of the product does', () => {
    const margin = buildStory(view()).find((p) => p.measureId === 'gross_margin');
    expect(margin).toBeDefined();
    for (const comparison of margin?.comparisons ?? []) {
      expect(comparison.unit).toBe('bps');
    }
  });

  it('and names what drove the movement, with an owner', () => {
    /* The review's point: "explain what is driving growth or decline, not just the movement." */
    const revenue = buildStory(view()).find((p) => p.measureId === 'revenue');
    expect(revenue?.contributors).toBeDefined();
    expect(revenue?.text).toMatch(/Because of|Largest single/);
    const owner = revenue?.contributors?.rows[0]?.owner ?? '<none>';
    expect(revenue?.text).toContain(owner);
  });
});

describe('the balance sheet movement', () => {
  it('compares against the prior month, not against forecast', () => {
    const movements = buildMovements(view());
    const ctx = contextOf(view());
    const priorMonth = addMonths(SEED_END, -1);

    for (const line of movements) {
      const opening = computeMeasure(line.measureId, {
        ...ctx,
        scope: monthScope(priorMonth),
      }).value;
      expect(line.opening, `${line.heading} is not last month's balance`).toBe(opening);
      const closing = computeMeasure(line.measureId, ctx).value;
      expect(line.closing).toBe(closing);
      if (opening !== null && closing !== null) expect(line.movement).toBe(closing - opening);
    }
  });

  it('and carries the lines the review names, including capital spend beside fixed assets', () => {
    const movements = buildMovements(view());
    const ids = movements.map((line) => line.measureId);
    for (const required of ['fixed_assets', 'receivables', 'cash', 'payables', 'capex']) {
      expect(ids, `${required} is missing from the movement page`).toContain(required);
    }
    // Capex sits in the asset group, because it is what moved fixed assets.
    expect(movements.find((line) => line.measureId === 'capex')?.group).toBe('Assets');
    expect(MOVEMENT_LINES.length).toBeGreaterThan(6);
  });

  it('and explains only the lines that moved enough to be worth a sentence', () => {
    /* A "because of…" under a £3k movement on a £40m balance sheet is the line that teaches a reader to
       stop reading them. So some lines carry one and some do not — and if every line did, the threshold
       would not be doing anything. */
    const movements = buildMovements(view());
    const explained = movements.filter((line) => line.because !== undefined);
    expect(explained.length).toBeGreaterThan(0);
    expect(explained.length).toBeLessThan(movements.length);

    for (const line of explained) {
      const share =
        line.opening === null || line.opening === 0 || line.movement === null
          ? 0
          : Math.abs(line.movement / line.opening);
      expect(share, `${line.heading} was explained on a 2% move`).toBeGreaterThan(0.02);
    }
  });

  it('and takes direction from polarity, so borrowings rising is not good news', () => {
    const borrowings = buildMovements(view()).find((line) => line.measureId === 'borrowings');
    expect(borrowings).toBeDefined();
    if ((borrowings?.movement ?? 0) > 0) expect(borrowings?.favourable).toBe(false);
    if ((borrowings?.movement ?? 0) < 0) expect(borrowings?.favourable).toBe(true);
  });
});
