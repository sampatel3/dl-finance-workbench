/**
 * The detectors and the boards they fill.
 *
 * Two claims are being defended here and they pull in opposite directions, which is the point:
 *
 *   **Every detector fires on the demo's own world.** Twelve planted conditions, twelve rules, and a
 *   rule that never fires is a rule nobody has tested. A demo where three of the twelve are silent has
 *   three findings that exist only in the plan.
 *
 *   **Every detector is silent on the healthy twin.** A detector proven only to fire is half-proven, and
 *   a false positive in front of a chief financial officer discredits every other number on the screen.
 *
 * A rule can pass either one alone by being wrong in the obvious direction. Passing both is the claim.
 */

import { describe, expect, it } from 'vitest';

import {
  ACTUAL_VERSION,
  CALENDAR_YEAR,
  SEED_END,
  buildHealthyWorld,
  buildWorld,
  monthScope,
  quarterScope,
  subtree,
} from '@kestrel/model';
import type { World } from '@kestrel/model';
import type { ComparatorChoice, MeasureContext } from '@kestrel/measures';
import { allEntityIds, formatValue } from '@kestrel/measures';

import type { DetectorContext } from './detectors.ts';
import { MINIMUM_CASH } from './cash.ts';
import { DETECTORS, TRIAGE_CAP, detector, runDetectors, triage } from './detectors.ts';
import { boardCoverage, boardIdFor, brief, priorityBoards } from './priority.ts';

const world = buildWorld({ seed: 'kestrel-industrial-group' });
const healthy = buildHealthyWorld();

function dctx(w: World = world, overrides: Partial<MeasureContext> = {}): DetectorContext {
  const ctx: MeasureContext = {
    store: w.store,
    rates: w.rates,
    scope: monthScope(SEED_END),
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
    lens: 'reported',
    entityIds: allEntityIds(),
    ...overrides,
  };
  return { world: w, ctx, comparator: { id: 'forecast', versionId: 'v6' } };
}

describe('the suite', () => {
  const run = runDetectors(dctx());

  it('is twelve rules, one per planted condition, and no condition twice', () => {
    expect(DETECTORS).toHaveLength(12);
    const conditions = DETECTORS.map((d) => d.plantedCondition).sort((a, b) => a - b);
    expect(conditions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(DETECTORS.map((d) => d.id)).size).toBe(12);
  });

  it('and every one of them fires on the demo’s own world', () => {
    // The claim the plan makes. Three of the twelve were silent when this test was first written — one
    // comparing a driver to a version whose own actuals covered the months in question, one whose
    // planted condition was declared in an assumption set and never reached the arithmetic, and one
    // whose measure did not exist. All three were plan text with nothing behind it.
    const fired = new Set(run.findings.map((f) => f.detectorId));
    const silent = DETECTORS.filter((d) => !fired.has(d.id)).map((d) => d.id);
    expect(silent).toEqual([]);
  });

  it('and none of them throws', () => {
    // A detector that throws is carried out as an error rather than taking the other eleven with it, so
    // this assertion is about the data and not about the error handling.
    expect(run.errors).toEqual([]);
  });

  it('and every one of them is silent on the healthy twin', () => {
    const twin = runDetectors(dctx(healthy));
    expect(twin.findings.map((f) => f.detectorId)).toEqual([]);
    expect(twin.errors).toEqual([]);
  });

  it('and each declares its question in the words a user would ask it', () => {
    for (const d of DETECTORS) {
      expect(d.question.endsWith('?')).toBe(true);
      expect(d.label.length).toBeGreaterThan(4);
    }
  });

  it('and throws on a detector that does not exist rather than returning nothing', () => {
    expect(() => detector('revenue_but_worse')).toThrow(/Unknown detector/);
  });
});

describe('what a finding carries', () => {
  const run = runDetectors(dctx());

  it('a closed set of figures, which is what stops a model inventing one', () => {
    // The mechanism, not a convention: the narration is handed `figures` and nothing else, so a number
    // that is not in this array cannot appear in the prose. A finding with an empty set would be a
    // sentence nobody can check.
    for (const finding of run.findings) {
      expect(finding.figures.length).toBeGreaterThan(1);
      for (const figure of finding.figures) {
        expect(figure.label.length).toBeGreaterThan(2);
        // A null is a real answer and must format as one rather than as zero.
        expect(formatValue(figure.value, figure.unit)).toBeTruthy();
      }
    }
  });

  it('a statement that reads as a sentence and quotes its own figures', () => {
    for (const finding of run.findings) {
      expect(finding.statement.length).toBeGreaterThan(80);
      expect(finding.statement.trimEnd().endsWith('.')).toBe(true);
      expect(finding.title.length).toBeGreaterThan(10);
    }
  });

  it('an action that names a route and an owner, and never posts anything', () => {
    // The ladder stops at modelling. It stops in the type rather than in the surface, so a screen cannot
    // offer to write to a ledger even by accident.
    const allowed = [
      'expand_commentary',
      'open_forecast_drivers',
      'run_scenario',
      'open_reconciliation',
      'open_close',
      'open_vintages',
      'open_mapping',
    ];
    const routeByDetector: Readonly<Record<string, string>> = {
      revenue_ahead_of_forecast: '/app/performance',
      segment_margin_behind_forecast: '/app/performance',
      driver_above_assumption: '/app/forecast',
      currency_distorts_growth: '/app/performance',
      collections_slipping: '/app/scenarios',
      cash_floor_breach: '/app/scenarios',
      unmapped_accounts: '/app/controls',
      intercompany_mismatch: '/app/controls',
      forecast_bias: '/app/quality',
      close_incomplete: '/app/controls',
      restatement_in_load: '/app/controls',
      pipeline_ahead_of_assumption: '/app/scenarios',
    };
    for (const finding of run.findings) {
      expect(allowed).toContain(finding.action.kind);
      const url = new URL(finding.action.href, 'https://demo.invalid');
      expect(url.pathname).toBe(routeByDetector[finding.detectorId]);
      expect(url.pathname.startsWith('/app/')).toBe(true);
      if (url.pathname !== '/app/controls') {
        expect(url.searchParams.get('focus')).toMatch(/^section-/);
        expect(url.searchParams.get('month')).toBe(SEED_END);
      }
      expect(finding.action.owner.length).toBeGreaterThan(3);
    }
  });

  it('and its deep-link state is understood by the surface it opens', () => {
    const byDetector = new Map(run.findings.map((finding) => [finding.detectorId, finding]));
    const url = (id: string) =>
      new URL(byDetector.get(id)?.action.href ?? '/', 'https://demo.invalid');

    expect(url('segment_margin_behind_forecast').searchParams.get('segment')).toBeTruthy();
    expect(url('driver_above_assumption').searchParams.get('driver')).toBe('subcontract_rate');
    expect(url('forecast_bias').searchParams.get('measure')).toBeTruthy();
    expect(url('collections_slipping').searchParams.get('dsoDays')).toBe('-10');
    expect(url('cash_floor_breach').searchParams.get('dsoDays')).toBe('10');
    // Pipeline conversion is not a governed scenario lever yet. The link says only what the current
    // surface can honour rather than carrying the old ignored `scenario=pipeline` parameter.
    expect(url('pipeline_ahead_of_assumption').searchParams.has('scenario')).toBe(false);
  });

  it('and a fingerprint that is stable across runs and independent of the values', () => {
    // Two runs over the same period find the same things, so a brief can dedupe on identity rather than
    // by comparing prose.
    const again = runDetectors(dctx());
    expect(again.findings.map((f) => f.fingerprint)).toEqual(
      run.findings.map((f) => f.fingerprint),
    );
    expect(new Set(run.findings.map((f) => f.fingerprint)).size).toBe(run.findings.length);
  });

  it('and a fingerprint that changes when the period does, because that is a different finding', () => {
    const quarter = runDetectors(dctx(world, { scope: quarterScope(2026, 3, CALENDAR_YEAR) }));
    const monthly = new Set(run.findings.map((f) => f.fingerprint));
    expect(quarter.findings.some((f) => !monthly.has(f.fingerprint))).toBe(true);
  });

  it('and discloses a draft input on the finding rather than in a footnote', () => {
    // The one favourable forward item is built on the one draft measure in the catalogue. That is the
    // reason its action is "model it" and not "raise the forecast", so the caveat travels with it.
    const opportunity = run.findings.find((f) => f.plantedCondition === 12);
    expect(opportunity?.caveat).toMatch(/draft measure/);
    expect(opportunity?.action.kind).toBe('run_scenario');
  });

  it('and names the materiality test it cleared, where it is a variance', () => {
    const variance = run.findings.find((f) => f.plantedCondition === 1);
    expect(variance?.materiality).toMatch(/against a floor of/);
  });
});

describe('the findings the deck depends on', () => {
  const run = runDetectors(dctx());
  const byCondition = (n: number) => run.findings.filter((f) => f.plantedCondition === n);

  it('revenue is ahead of the forecast in force, and the bridge says on what', () => {
    // PLANTED 1, and the figure the plan states. The first version of this printed £0.00 — a currency
    // measure's `movement` is its *relative* change, and formatting a rate as money loses two decimal
    // places and every digit before them.
    const finding = byCondition(1)[0];
    expect(finding?.direction).toBe('favourable');
    const variance = finding?.figures.find((f) => f.label === 'Variance');
    expect(formatValue(variance?.value ?? null, 'currency')).toBe('£618k');
    expect(finding?.statement).toMatch(/volume/i);
  });

  it('the services margin is behind it, while the group is ahead — which is the finding', () => {
    // PLANTED 2. A group-wide cost assumption cannot express this: everything moving together is not a
    // finding anybody can act on, because there is nobody to give it to. The cost to serve is an
    // assumption on the service book alone, so services can be behind while the group is ahead.
    const margins = byCondition(2);
    expect(margins.length).toBeGreaterThan(0);
    expect(margins.some((f) => f.segmentId === 'contracts')).toBe(true);
    expect(margins.every((f) => f.direction === 'adverse')).toBe(true);
    // And the group is ahead at the same time, on the same data.
    expect(byCondition(1)[0]?.direction).toBe('favourable');
  });

  it('the contractor rate is above assumption three months running, across two versions', () => {
    // PLANTED 3, and the run is what makes it forward rather than a variance. Measured against the
    // forecast in force in each month: against today's version, two of the three months are inside its
    // own actuals and the gap is zero by construction.
    const finding = byCondition(3)[0];
    expect(finding?.horizon).toBe('forward');
    expect(finding?.title).toMatch(/3 months/);
    expect(finding?.statement).toMatch(/v5/);
    expect(finding?.statement).toMatch(/v6/);
    // Sized at the run rate, because that is what a run costs.
    const annual = finding?.figures.find((f) => f.label === 'Cost of the gap, annualised');
    expect(annual?.value ?? 0).toBeGreaterThan(0);
  });

  it('currency cost the reported growth, so the underlying figure is better', () => {
    // PLANTED 4. Favourable, and the least intuitive of the four favourable framings: the news is that
    // the business did better than the number says.
    const finding = byCondition(4)[0];
    expect(finding?.direction).toBe('favourable');
    const effect = finding?.figures.find((f) => f.label === 'Currency effect');
    expect(effect?.value ?? 0).toBeGreaterThan(0);
  });

  it('one entity’s collections slipped, and the group’s seasonality did not do it', () => {
    // PLANTED 5. Measured against the group's own movement rather than against an absolute threshold,
    // because days sales outstanding drifts a few days every quarter with the shape of revenue and a
    // rule with a fixed threshold either fires on everybody or is tuned until it fires on one.
    const finding = byCondition(5)[0];
    expect(finding?.entityId).toBe('gulf');
    const excess = finding?.figures.find((f) => f.label === 'Excess over the group');
    expect(excess?.value ?? 0).toBeGreaterThan(3);
  });

  it('cash goes under the board floor in week 9 and recovers', () => {
    const finding = byCondition(6)[0];
    expect(finding?.horizon).toBe('forward');
    expect(finding?.title).toMatch(/week 9/);
    expect(finding?.title).toMatch(/£760k/);
    expect(finding?.statement).toMatch(/low point.*week 10/i);
    const weekNine = finding?.figures.find((figure) => figure.label === 'Week 9 closing');
    const shortfall = finding?.figures.find((figure) => figure.label === 'Shortfall');
    const low = finding?.figures.find((figure) => figure.label === 'Low point · week 10');
    expect(weekNine?.value).toBe(MINIMUM_CASH.amountMinor - (shortfall?.value ?? 0));
    expect(low?.value ?? 0).toBeLessThan(weekNine?.value ?? 0);
    expect(finding?.priority).toBe('high');
  });

  it('two ledger accounts reached the load and not the reported figures', () => {
    const finding = byCondition(7)[0];
    const stake = finding?.figures.find((f) => f.label === 'Value at stake');
    expect(formatValue(stake?.value ?? null, 'currency')).toBe('£212k');
  });

  it('the intercompany reconciliation fails, and says by how much', () => {
    // The check that is worth having precisely because it does not return a green tick.
    const finding = byCondition(8)[0];
    expect(finding?.title).toMatch(/£48k/);
    expect(finding?.priority).toBe('high');
  });

  it('the forecast is habitually wrong about the cost to serve, and about EBITDA by more', () => {
    // PLANTED 9, and the amplification is the useful part: nobody finds a 2% cost miss by looking at
    // cost. The drill runs from the EBITDA miss to the cause.
    const biases = byCondition(9);
    expect(biases.length).toBeGreaterThan(1);
    expect(biases.every((f) => f.horizon === 'forward')).toBe(true);
    expect(biases.some((f) => f.title.includes('EBITDA'))).toBe(true);
  });

  it('one ledger has submitted July and not closed it', () => {
    const finding = byCondition(10)[0];
    expect(finding?.entityId).toBe('inc');
    expect(finding?.statement).toMatch(/not final/);
  });

  it('June was restated after it was reported, and both figures are correct', () => {
    const finding = byCondition(11)[0];
    expect(finding?.title).toMatch(/2026-06/);
    const asFiled = finding?.figures.find((f) => f.label === 'Gross margin as filed');
    const asNow = finding?.figures.find((f) => f.label === 'Gross margin now');
    expect(asFiled?.value).not.toBe(asNow?.value);
  });

  it('and the pipeline is converting ahead of what the forecast assumes', () => {
    // PLANTED 12 — the condition that exists so the Opportunities board is not empty. It was declared in
    // the assumption set and never used in the arithmetic, so for a while it existed in a pair of
    // constants and in no fact, and the board it was added to fill would still have been blank.
    const finding = byCondition(12)[0];
    expect(finding?.direction).toBe('favourable');
    expect(finding?.horizon).toBe('forward');
    const stake = finding?.figures.find((f) => f.label === 'Full-year revenue at stake');
    expect(stake?.value ?? 0).toBeGreaterThan(0);
  });
});

describe('a finding is scoped to what it was asked about', () => {
  it('so a single entity produces a different set from the group', () => {
    // Row-level access is the entity subtree, so a Gulf controller's board is the group's board filtered
    // by the data they can see rather than by a permission on the finding.
    const gulf = runDetectors(dctx(world, { entityIds: subtree('gulf') }));
    const group = runDetectors(dctx());
    expect(gulf.findings.map((f) => f.detectorId)).not.toEqual(
      group.findings.map((f) => f.detectorId),
    );

    const ids = gulf.findings.map((finding) => finding.detectorId);
    expect(ids).not.toContain('unmapped_accounts');
    expect(ids).not.toContain('intercompany_mismatch');
    expect(ids).not.toContain('close_incomplete');
    expect(ids).not.toContain('restatement_in_load');

    const visibleText = JSON.stringify(gulf.findings);
    expect(visibleText).not.toContain('58420');
    expect(visibleText).not.toContain('61155');
    expect(visibleText).not.toContain('Kestrel Inc');
    expect(visibleText).not.toContain('v-restatement-2026-06');
  });
});

describe('the four boards', () => {
  const boards = priorityBoards(dctx());

  it('partition every finding into exactly one board', () => {
    const total = boards.boards.reduce((sum, b) => sum + b.findings.length, 0);
    expect(total).toBe(boards.findings.length);
    // And no finding appears on two, which the partition makes structural rather than checked.
    const seen = boards.boards.flatMap((b) => b.findings.map((f) => f.fingerprint));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('and all four are non-empty on the demo’s own world', () => {
    // The reason condition 12 exists. A seed that plants only bad news leaves this board blank, and an
    // empty panel in front of a client is the one defect a demo cannot recover from mid-sentence.
    for (const b of boards.boards) {
      expect(b.findings.length).toBeGreaterThan(0);
    }
  });

  it('and each is ranked within itself, by priority, never across boards', () => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    for (const b of boards.boards) {
      const ranks = b.findings.map((f) => order[f.priority]);
      expect(ranks).toEqual([...ranks].sort((a, b2) => a - b2));
    }
  });

  it('and each carries the question it exists to answer', () => {
    for (const b of boards.boards) {
      expect(b.question.endsWith('?')).toBe(true);
      expect(b.emptyNote.length).toBeGreaterThan(10);
    }
  });

  it('and carries the basis, so a reader is never guessing what the comparison is', () => {
    expect(boards.comparator.basis.length).toBeGreaterThan(10);
    expect(boards.comparator.id).toBe('forecast');
  });

  it('and the routing is a lookup rather than a decision', () => {
    expect(boardIdFor({ direction: 'adverse', horizon: 'current' })).toBe('attention');
    expect(boardIdFor({ direction: 'favourable', horizon: 'forward' })).toBe('opportunities');
    for (const b of boards.boards) {
      for (const f of b.findings) {
        expect(boardIdFor({ direction: f.direction, horizon: f.horizon })).toBe(b.id);
      }
    }
  });

  it('and the suite’s coverage of all four is checkable without any data', () => {
    // A property of the definitions, so a thirteenth detector that would leave a board empty fails a test
    // the moment it is added rather than in front of somebody.
    const coverage = boardCoverage();
    expect([...coverage.keys()].sort()).toEqual([
      'attention',
      'opportunities',
      'performance',
      'risks',
    ]);
    for (const [, detectorIds] of coverage) {
      expect(detectorIds.length).toBeGreaterThan(0);
    }
  });

  it('and every board is empty on the healthy twin, with a note rather than a blank', () => {
    const twin = priorityBoards(dctx(healthy));
    for (const b of twin.boards) {
      expect(b.findings).toEqual([]);
      expect(b.emptyNote).toBeTruthy();
    }
  });
});

describe('changing the comparator re-partitions the boards', () => {
  const forecast = priorityBoards(dctx());

  function withComparator(choice: ComparatorChoice) {
    return priorityBoards({ ...dctx(), comparator: choice });
  }

  it('rather than reordering one list', () => {
    // The comparator is part of a finding's identity, so the same rule against a different basis is a
    // different finding. A product that reorders instead is one where "against what?" has no answer.
    const priorYear = withComparator({ id: 'prior_year' });
    const before = forecast.findings.map((f) => f.fingerprint).sort();
    const after = priorYear.findings.map((f) => f.fingerprint).sort();
    expect(after).not.toEqual(before);
  });

  it('and a fitted comparator cannot raise a board item at all', () => {
    // The trend is an expectation nobody committed to, so nothing is materially adverse against it. It is
    // enforced in the materiality policy, and this is the assertion that it reaches the boards.
    const trend = withComparator({ id: 'trend' });
    expect(trend.comparator.admissibleForMateriality).toBe(false);
    // The rules that judge against a comparator go quiet; the rules that judge against the world — an
    // unmapped account, a failed reconciliation, an open ledger — do not, because a trend has no bearing
    // on whether a ledger is closed.
    const conditions = new Set(trend.findings.map((f) => f.plantedCondition));
    expect(conditions.has(1)).toBe(false);
    expect(conditions.has(7)).toBe(true);
    expect(conditions.has(8)).toBe(true);
  });
});

describe('triage', () => {
  const boards = priorityBoards(dctx());

  it('caps what reaches a brief and says what it left out', () => {
    const result = triage(boards.findings, 4);
    expect(result.kept).toHaveLength(4);
    expect(result.suppressed.length).toBe(boards.findings.length - 4);
    // The count is the point: a product that quietly shows the top four trains a reader to believe there
    // were four, and the fifth is the one that gets asked about in the meeting.
    expect(result.note).toMatch(/below the cut/);
    for (const dropped of result.suppressed) {
      expect(result.note).toContain(dropped.title);
    }
  });

  it('and keeps the most material, not the first to run', () => {
    const result = triage(boards.findings, 3);
    expect(result.kept.every((f) => f.priority === 'high')).toBe(true);
  });

  it('and says so plainly when it suppressed nothing', () => {
    const result = triage(boards.findings.slice(0, 2), TRIAGE_CAP);
    expect(result.suppressed).toEqual([]);
    expect(result.note).toMatch(/All 2 findings shown/);
  });

  it('and a brief caps each board separately, so a bad month cannot crowd out the good news', () => {
    // Capping across all four would reintroduce the failure the partition exists to prevent, one layer
    // up where it is harder to see: seven adverse findings would fill a global list of six and the
    // opportunity would vanish.
    const result = brief(dctx(), 2);
    for (const b of result.boards) {
      expect(b.triage.kept.length).toBeGreaterThan(0);
      expect(b.triage.kept.length).toBeLessThanOrEqual(2);
    }
    const opportunities = result.boards.find((b) => b.id === 'opportunities');
    expect(opportunities?.triage.kept.length).toBe(1);
  });
});
