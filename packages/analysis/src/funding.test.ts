/**
 * Why a week is red, and whether anything can be done about it in time.
 *
 * Three properties, each of which is how this goes quietly wrong:
 *
 *   **The streams sum to the week.** A breakdown that does not reconcile to the figure it explains is a
 *   plausible story beside a number, which is worse than no story. Asserted to the penny, not within a
 *   tolerance, because the rounding drift is deliberately carried on one line rather than left loose.
 *
 *   **Timing and structural are decided by recovery, not by which stream is largest.** An ordinary
 *   supplier run can put a week under and the balance come straight back — that is timing, and a test
 *   keyed on "was the driver lumpy" would call it structural because suppliers are paid every week.
 *
 *   **The ageing ties to the balance sheet.** Buckets seeded beside the receivables figure rather than
 *   derived from it are the defect a controller finds in the first minute: the table does not add up to
 *   the balance. So the buckets are asserted to sum to the governed figure exactly.
 */

import { describe, expect, it } from 'vitest';
import { ACTUAL_VERSION, SEED_END, buildWorld, monthScope, subtree } from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { computeMeasure } from '@kestrel/measures';

import { MINIMUM_CASH, directForecast, explainBreaches } from './cash.ts';
import { PAYMENT_TERMS_DAYS, ageingFor, fundingPlan } from './funding.ts';

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

describe('a week of the cash forecast', () => {
  it('is made of named streams that sum to its net movement exactly', () => {
    const forecast = directForecast(ctx());
    expect(forecast.weeks.length).toBeGreaterThan(0);
    for (const week of forecast.weeks) {
      const summed = week.components.reduce((total, component) => total + component.amount, 0);
      expect(summed, `week ${week.index} does not reconcile`).toBe(week.net);
    }
  });

  it('and separates the run rate from the events', () => {
    /* The distinction the timing/structural verdict rests on. If nothing were marked lumpy the verdict
       would have no drivers to name, and if everything were the label would say nothing. */
    const forecast = directForecast(ctx());
    const all = forecast.weeks.flatMap((week) => week.components);
    expect(all.some((component) => component.lumpy)).toBe(true);
    expect(all.some((component) => !component.lumpy)).toBe(true);

    // A lumpy stream appears in some weeks and not others, or it is not lumpy.
    const dividendWeeks = forecast.weeks.filter((week) =>
      week.components.some((component) => component.key === 'dividend'),
    );
    expect(dividendWeeks.length).toBeGreaterThan(0);
    expect(dividendWeeks.length).toBeLessThan(forecast.weeks.length);
  });

  it('and every stream names an owner', () => {
    const forecast = directForecast(ctx());
    for (const component of forecast.weeks.flatMap((week) => week.components)) {
      expect(component.owner, `${component.label} has no owner`).not.toBe('');
    }
  });
});

describe('the breach explanation', () => {
  it('finds the planted breach and calls it timing, because the balance recovers', () => {
    const forecast = directForecast(ctx());
    expect(forecast.breach).toBeDefined();

    const breaches = explainBreaches(forecast);
    expect(breaches.length).toBeGreaterThan(0);

    const first = breaches[0];
    expect(first?.index).toBe(forecast.breach?.index);
    expect(first?.nature).toBe('timing');
    expect(first?.recoversAtWeek).toBeDefined();
    // Recovery is a later week, or "recovers" means nothing.
    expect(first?.recoversAtWeek ?? 0).toBeGreaterThan(first?.index ?? 0);
  });

  it('and names the dated payments rather than the run rate', () => {
    const breaches = explainBreaches(directForecast(ctx()));
    const first = breaches[0];
    expect(first?.drivers.length).toBeGreaterThan(0);
    // Every named driver is a payment, never a receipt — a collection cannot put a week under.
    for (const driver of first?.drivers ?? []) expect(driver.amount).toBeLessThan(0);
    expect(first?.statement).toMatch(/week to fund|not a hole to fix/i);
  });

  it('and the shortfall it reports is the floor less the closing balance', () => {
    const forecast = directForecast(ctx());
    const breaches = explainBreaches(forecast);
    for (const breach of breaches) {
      const week = forecast.weeks[breach.index - 1];
      expect(breach.shortfall).toBe(MINIMUM_CASH.amountMinor - (week?.closing ?? 0));
    }
  });
});

describe('the funding plan', () => {
  const forecast = directForecast(ctx());
  const plan = fundingPlan(ctx(), forecast.breach?.shortfall ?? 0, forecast.breach?.index ?? 9);

  it('offers what each entity could send, which is not what it holds', () => {
    expect(plan.options.length).toBeGreaterThan(1);
    for (const option of plan.options) {
      // Availability is the balance less the buffer, floored at zero — never the balance itself.
      expect(option.available).toBe(Math.max(0, option.cash - option.bufferMinor));
      expect(option.available).toBeLessThanOrEqual(Math.max(0, option.cash));
    }
  });

  it('and turns lead time into a decision date, which is the part that is actually useful', () => {
    /* `arrivesInTime` is a yes for everything unblocked when the breach is eight weeks out, so on its
       own it is a column that always says yes. The decision date is what a treasurer needs: Gulf can
       fund week nine, and the local board resolution has to be requested by week seven.

       Asserted as a spread — if every entity had the same deadline the column would again say nothing,
       and the whole point is that a slow route has to start earlier. */
    const deadlines = plan.usable.map((option) => option.startByWeek ?? 0);
    expect(deadlines.length).toBeGreaterThan(1);
    expect(new Set(deadlines).size, 'every route has the same deadline').toBeGreaterThan(1);

    for (const option of plan.usable) {
      expect(option.startByWeek).not.toBeNull();
      // A slower route starts earlier, and none of them starts after the week it must fund.
      expect(option.startByWeek ?? 0).toBeLessThanOrEqual(plan.week);
      expect(option.startByWeek ?? 0).toBeGreaterThanOrEqual(1);
      expect(option.leadTimeDays).toBeLessThanOrEqual(plan.daysAvailable);
    }

    const slowest = [...plan.usable].sort((a, b) => b.leadTimeDays - a.leadTimeDays)[0];
    const fastest = [...plan.usable].sort((a, b) => a.leadTimeDays - b.leadTimeDays)[0];
    expect(slowest?.startByWeek ?? 0).toBeLessThan(fastest?.startByWeek ?? 0);
  });

  it('and excludes an entity that cannot distribute at all', () => {
    const blocked = plan.options.filter((option) => option.blocked !== undefined);
    expect(blocked.length).toBeGreaterThan(0);
    for (const option of blocked) {
      expect(option.arrivesInTime).toBe(false);
      expect(plan.usable).not.toContain(option);
      // No deadline either: there is no date by which a blocked route becomes possible.
      expect(option.startByWeek).toBeNull();
      // A refusal with no reason teaches nobody anything.
      expect(option.blocked).not.toBe('');
    }
  });

  it('and says what cannot come, not only what can', () => {
    expect(plan.statement).toMatch(/Not counted|needs \d+ days|unavailable/);
    expect(plan.statement).toMatch(/working days out/);
    // And it leads with a date somebody has to act on rather than with a reassurance.
    expect(plan.statement).toMatch(/raised by week \d+/);
  });

  it('and a scoped session gets only entities it can read', () => {
    const scoped = fundingPlan({ ...ctx(), entityIds: subtree('gulf') }, 100_000_00, 9);
    expect(scoped.options).toHaveLength(1);
    expect(scoped.options[0]?.entityId).toBe('gulf');
  });
});

describe('receivables ageing', () => {
  it('sums to the governed receivables balance exactly', () => {
    for (const entityId of ['group', 'gulf', 'manufacturing']) {
      const book = ageingFor(ctx(), entityId);
      const summed = book.buckets.reduce((total, bucket) => total + bucket.amount, 0);
      expect(summed, `${entityId} ageing does not tie to the balance`).toBe(book.receivables);

      const direct = computeMeasure('receivables', {
        ...ctx(),
        entityIds: subtree(entityId),
      }).value;
      expect(book.receivables).toBe(direct);
    }
  });

  it('and puts more of a slow book past terms than a fast one', () => {
    /* The shape is derived from the collection period, so the entity the detectors flag for slow
       collections should carry a larger overdue share than the group it sits in. A fixed profile would
       give every entity the same answer, which is the version that says nothing. */
    const gulf = ageingFor(ctx(), 'gulf');
    const manufacturing = ageingFor(ctx(), 'manufacturing');
    expect(gulf.dso).toBeGreaterThan(manufacturing.dso);
    expect(gulf.overdueShare).toBeGreaterThan(manufacturing.overdueShare);
  });

  it('and marks everything past terms as overdue, and nothing inside them', () => {
    const book = ageingFor(ctx(), 'group');
    for (const bucket of book.buckets) {
      expect(bucket.overdue).toBe(bucket.fromDays > PAYMENT_TERMS_DAYS);
    }
    const overdue = book.buckets
      .filter((bucket) => bucket.overdue)
      .reduce((total, bucket) => total + bucket.amount, 0);
    expect(book.overdueMinor).toBe(overdue);
  });
});
