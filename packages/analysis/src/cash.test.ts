/**
 * Cash.
 *
 * The two things being defended: the 13-week forecast breaches the board's floor inside the horizon
 * on this data — which is planted condition 6 and the Risks board's item — and the indirect bridge
 * closes, so a P&L scenario has a path to a cash answer rather than stopping at the income statement.
 */

import { describe, expect, it } from 'vitest';

import { ACTUAL_VERSION, SEED_END, buildWorld, monthScope, subtree } from '@kestrel/model';
import type { MeasureContext } from '@kestrel/measures';
import { allEntityIds, computeMeasure, formatValue } from '@kestrel/measures';

import {
  MINIMUM_CASH,
  cashSensitivity,
  directForecast,
  indirectBridge,
  scoreCashForecast,
} from './cash.ts';

const world = buildWorld({ seed: 'kestrel-industrial-group' });

function ctx(overrides: Partial<MeasureContext> = {}): MeasureContext {
  return {
    store: world.store,
    rates: world.rates,
    scope: monthScope(SEED_END),
    scenario: 'ACTUAL',
    versionId: ACTUAL_VERSION,
    lens: 'reported',
    entityIds: allEntityIds(),
    ...overrides,
  };
}

describe('the 13-week direct forecast', () => {
  const forecast = directForecast(ctx());

  it('is thirteen weeks, opening at the cash the measure layer reports', () => {
    expect(forecast.weeks).toHaveLength(13);
    expect(forecast.opening).toBe(computeMeasure('cash', ctx()).value);
    expect(formatValue(forecast.opening, 'currency')).toBe('£4.8m');
  });

  it('rolls: each week closes where the next one opens', () => {
    let running = forecast.opening;
    for (const week of forecast.weeks) {
      running += week.net;
      expect(week.closing).toBe(running);
      expect(week.net).toBe(week.receipts - week.payments);
    }
  });

  it('does not spread evenly, because the value of the thing is knowing which week is tight', () => {
    const nets = forecast.weeks.map((week) => week.net);
    expect(new Set(nets).size).toBeGreaterThan(6);
    // Some weeks are negative and some positive: payroll lands in some and not others.
    expect(nets.some((net) => net < 0)).toBe(true);
    expect(nets.some((net) => net > 0)).toBe(true);
  });

  it('breaches the board floor in week 9, and names it', () => {
    // PLANTED 6, and the Risks board's headline item. Week 9 is where the dividend lands on top of a
    // supplier run, and it is true in the data rather than asserted in prose — which is why a reader
    // can drill from the board item to the week to the collection days behind it.
    expect(forecast.breach).toBeDefined();
    expect(forecast.breach?.index).toBe(9);
    expect(forecast.breach?.shortfall ?? 0).toBeGreaterThan(0);
    expect(forecast.low.amount).toBeLessThan(MINIMUM_CASH.amountMinor);
  });

  it('and recovers by the end of the horizon, so the item is a risk rather than an emergency', () => {
    // A forecast that never recovers is a different conversation. This one dips under the floor and
    // climbs back, which is what makes it a board item with an action rather than a crisis.
    const last = forecast.weeks[forecast.weeks.length - 1];
    expect(last?.closing ?? 0).toBeGreaterThan(MINIMUM_CASH.amountMinor);
    expect(last?.closing ?? 0).toBeLessThan(forecast.opening * 1.5);
  });

  it('includes tax, capital spend, interest and the dividend — or it is not a cash forecast', () => {
    // The first version of this model had only supplier settlement and overheads. It generated £6.3m
    // over the quarter, never came near the floor, and was a working-capital forecast wearing the
    // wrong name. The four lumpy streams are what make the trough real.
    const heaviest = [...forecast.weeks].sort((a, b) => b.payments - a.payments)[0];
    expect(heaviest?.index).toBe(9);
    // And the weeks differ by more than a smoothing would produce.
    const payments = forecast.weeks.map((week) => week.payments);
    expect(Math.max(...payments) / Math.min(...payments)).toBeGreaterThan(2);
  });

  it('and the floor it is judged against is owned and dated, not a constant in a file', () => {
    expect(MINIMUM_CASH.owner).toMatch(/board minute/);
    expect(MINIMUM_CASH.effectiveFrom).toBeTruthy();
  });

  it('moves when collection days move, which is the mechanism the scenario depends on', () => {
    // The Gulf entity has the slowest collections in the group, so its own horizon collects a smaller
    // share of its book than the group's does. A forecast built from a monthly figure divided by 4.33
    // would not know the difference.
    const gulf = directForecast(ctx({ entityIds: subtree('gulf') }));
    const group = forecast;
    const collectedShare = (f: typeof group) =>
      f.weeks.reduce((total, week) => total + week.receipts, 0) / Math.max(f.opening, 1);
    expect(collectedShare(gulf)).not.toBe(collectedShare(group));
  });
});

describe('weekly variance is scored on both sides', () => {
  it('and says when a single net figure would have flattered it', () => {
    // A late receipt and a late payment cancel in a net number. Two errors, one good-looking score.
    const locked = [
      { week: '2026-07W1', index: 1, receipts: 1_000_000, payments: 800_000 },
      { week: '2026-07W2', index: 2, receipts: 900_000, payments: 700_000 },
    ];
    const actual = [
      // Receipts 20% light, payments 25% light — the net is exactly on forecast.
      { week: '2026-07W1', receipts: 800_000, payments: 600_000 },
      { week: '2026-07W2', receipts: 900_000, payments: 700_000 },
    ];
    const score = scoreCashForecast(locked, actual);
    expect(score.receiptsMape).toBeGreaterThan(0);
    expect(score.paymentsMape).toBeGreaterThan(0);
    expect(score.netMape).toBe(0);
    expect(score.nettingFlatters).toBe(true);
  });

  it('and does not claim netting flattered anything when it did not', () => {
    const locked = [{ week: '2026-07W1', index: 1, receipts: 1_000_000, payments: 800_000 }];
    const actual = [{ week: '2026-07W1', receipts: 1_000_000, payments: 800_000 }];
    const score = scoreCashForecast(locked, actual);
    expect(score.receiptsMape).toBe(0);
    expect(score.nettingFlatters).toBe(false);
  });

  it('scores only the weeks it has an actual for', () => {
    const locked = [
      { week: '2026-07W1', index: 1, receipts: 100, payments: 50 },
      { week: '2026-07W2', index: 2, receipts: 100, payments: 50 },
    ];
    const score = scoreCashForecast(locked, [{ week: '2026-07W1', receipts: 100, payments: 50 }]);
    expect(score.weeks).toHaveLength(1);
  });
});

describe('the indirect bridge', () => {
  const bridge = indirectBridge(ctx());

  it('closes: every line sums to the movement in cash', () => {
    expect(bridge.sums).toBe(true);
    expect(bridge.to - bridge.from).toBe(
      bridge.lines
        .filter((line) => line.kind !== 'opening' && line.kind !== 'closing')
        .reduce((total, line) => total + line.value, 0),
    );
  });

  it('and its terminals are the cash the measure layer reports', () => {
    expect(bridge.to).toBe(computeMeasure('cash', ctx()).value);
  });

  it('carries working capital as a line, which is the path from profit to cash', () => {
    // Without it a revenue assumption changes the income statement and nothing else, which is the gap
    // that makes most scenario tools useless to a treasurer.
    const wc = bridge.lines.find((line) => line.kind === 'working_capital');
    expect(wc).toBeDefined();
    expect(wc?.value).not.toBe(0);
  });

  it('names its residual rather than absorbing it', () => {
    const other = bridge.lines.find((line) => line.kind === 'other');
    if (bridge.residual !== 0) expect(other?.value).toBe(bridge.residual);
    else expect(other).toBeUndefined();
  });
});

describe('the answer to "what happens to cash if revenue falls 8%"', () => {
  const sensitivity = cashSensitivity(ctx(), -0.08);

  it('is the margin lost, offset by the receivable released', () => {
    expect(sensitivity.revenueChange).toBeLessThan(0);
    // Margin lost is a cash outflow; the receivable release is an inflow.
    expect(sensitivity.marginEffect).toBeLessThan(0);
    expect(sensitivity.workingCapitalRelease).toBeGreaterThan(0);
  });

  it('and is smaller than the revenue change, which is the whole point', () => {
    // A product that answers with the revenue change alone overstates the cash effect by the entire
    // gross margin. One that answers with the margin alone ignores the working-capital release.
    expect(Math.abs(sensitivity.netCashEffect)).toBeLessThan(Math.abs(sensitivity.revenueChange));
    expect(sensitivity.netCashEffect).not.toBe(sensitivity.marginEffect);
  });

  it('and carries the reasoning with it, because the number alone is not an answer', () => {
    expect(sensitivity.note).toMatch(/overstates the cash effect/);
    expect(sensitivity.horizonWeeks).toBe(13);
  });
});
