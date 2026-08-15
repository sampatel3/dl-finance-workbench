/**
 * The decision layer, and the precedent band that stands in for a probability.
 *
 * What has to hold for a surface to tell a board what to decide:
 *
 *   **The trigger is the breakage, not the lever.** The collections scenario moves no profit-and-loss
 *   figure and puts the group through the cash floor; a decision layer keyed on the lever would answer
 *   "collections" where the decision on the table is a transfer with a date. Asserted by giving the
 *   engine a cash breach with no lever named at all and requiring a funding decision back.
 *
 *   **"No decision" names its thresholds.** A surface that will not say what it tested cannot be
 *   distinguished from one that tested nothing.
 *
 *   **Precedent is bounded by a real version.** Every out-of-range claim names the version that bounds
 *   it, so the claim can be checked rather than believed.
 */

import { describe, expect, it } from 'vitest';
import { VERSIONS } from '@kestrel/model';

import {
  DECISION_POLICY,
  confidenceOf,
  impliedDecisions,
  noDecisionBecause,
  precedentFor,
  type ScenarioOutcome,
} from './decisions.ts';

const quiet: ScenarioOutcome = {
  movedLevers: [],
  leverMovement: {},
  ebitdaBase: 1_000_000_00,
  ebitdaMovement: 0,
  marginMovementBps: 0,
  baseHeadroom: 2_000_000_00,
  scenarioHeadroom: 2_000_000_00,
  breachWeek: null,
  shortfallMinor: 0,
};

describe('the decision layer', () => {
  it('takes nothing from a scenario that broke nothing', () => {
    expect(impliedDecisions(quiet)).toHaveLength(0);
  });

  it('and names every threshold it tested when it takes nothing', () => {
    const sentence = noDecisionBecause();
    expect(sentence).toContain(String(DECISION_POLICY.marginFallBps));
    expect(sentence).toContain(String(DECISION_POLICY.collectionSlipDays));
    expect(sentence).toContain('5%');
  });

  it('and reads a cash breach as a funding decision even with no lever named', () => {
    /* The point of the whole file: the trigger is what broke, not what was moved. */
    const decisions = impliedDecisions({
      ...quiet,
      breachWeek: 9,
      shortfallMinor: 800_000_00,
    });
    expect(decisions[0]?.id).toBe('funding_transfer');
    expect(decisions[0]?.dated).toBe(true);
    expect(decisions[0]?.because).toContain('week 9');
  });

  it('and puts the dated decision first, whatever else fired', () => {
    const decisions = impliedDecisions({
      ...quiet,
      breachWeek: 4,
      shortfallMinor: 300_000_00,
      marginMovementBps: -400,
      ebitdaMovement: -300_000_00,
      leverMovement: { serviceDeliveryCost: 0.06 },
    });
    expect(decisions.length).toBeGreaterThan(1);
    expect(decisions[0]?.dated).toBe(true);
    expect(decisions.slice(1).every((decision) => !decision.dated)).toBe(true);
  });

  it('and separates a pricing conversation from a cost one on the same compression', () => {
    const fromCost = impliedDecisions({
      ...quiet,
      marginMovementBps: -120,
      leverMovement: { serviceDeliveryCost: 0.06 },
    });
    const fromPrice = impliedDecisions({
      ...quiet,
      marginMovementBps: -120,
      leverMovement: { price: -0.04 },
    });
    expect(fromCost.map((d) => d.id)).toContain('cost_to_serve_action');
    expect(fromPrice.map((d) => d.id)).toContain('price_action');
  });

  it('and adds the freeze only past the deeper EBITDA threshold', () => {
    const shallow = impliedDecisions({ ...quiet, ebitdaMovement: -80_000_00 });
    const deep = impliedDecisions({ ...quiet, ebitdaMovement: -200_000_00 });
    expect(shallow.map((d) => d.id)).toEqual(['overhead_reduction']);
    expect(deep.map((d) => d.id)).toEqual(['overhead_reduction', 'hiring_freeze']);
  });

  it('and gives every decision an owner and a date or a forum', () => {
    const decisions = impliedDecisions({
      ...quiet,
      breachWeek: 6,
      shortfallMinor: 400_000_00,
      marginMovementBps: -200,
      leverMovement: { dsoDays: 10 },
    });
    expect(decisions.length).toBeGreaterThan(0);
    for (const decision of decisions) {
      expect(decision.owner, `${decision.id} has no owner`).not.toBe('');
      expect(decision.by, `${decision.id} has no when`).not.toBe('');
      expect(decision.because).not.toBe('');
    }
  });
});

describe('precedent, which is what this world can honestly say instead of probability', () => {
  it('places an assumption inside the range the stored versions have used', () => {
    const middle = VERSIONS.map((v) => v.assumptions.volume).sort((a, b) => a - b)[2] ?? 1;
    expect(precedentFor('volume', middle).band).toBe('within');
  });

  it('and names the version that bounds it when it is outside', () => {
    const highest = Math.max(...VERSIONS.map((v) => v.assumptions.serviceDeliveryCost));
    const beyond = precedentFor('serviceDeliveryCost', highest * 1.5);
    expect(beyond.band).toBe('beyond');
    const bounding = VERSIONS.find((v) => v.assumptions.serviceDeliveryCost === highest);
    expect(beyond.statement).toContain(bounding?.label ?? '<none>');
  });

  it('and takes the weakest of the moved assumptions, never an average', () => {
    /* One impossible assumption and four ordinary ones is not an ordinary scenario, and averaging is
       exactly how it would report as one. */
    const ordinary = precedentFor('volume', VERSIONS[0]?.assumptions.volume ?? 1);
    const extreme = precedentFor('volume', 4);
    expect(confidenceOf([ordinary]).band).toBe('within');
    expect(confidenceOf([ordinary, ordinary, ordinary, extreme]).band).toBe('beyond');
  });

  it('and says so plainly when nothing has moved', () => {
    expect(confidenceOf([]).statement).toContain('nothing to place');
  });
});
