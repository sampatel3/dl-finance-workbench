/**
 * The rail's signals.
 *
 * What has to hold for a count in a navigation list to be worth anything:
 *
 *   **It is the page's own number.** A badge saying 9 on a page that then shows 6 items is worse than
 *   no badge, because the reader stops believing the next one too. Each count here is asserted against
 *   the same computation the destination performs.
 *
 *   **It is scoped like every other read.** A business-unit controller must not learn from the rail
 *   that a group project is over budget — that is the quiet version of a permission leak, and it is
 *   the one a page-level test would never catch because the page in question was never opened.
 *
 *   **Silence means the test ran.** A section with no badge is a section whose own check found
 *   nothing, so the set of signalled sections has to be a strict subset — a rail where everything is
 *   flagged has told the reader nothing about where to start.
 */

import { describe, expect, it } from 'vitest';
import { closePositionsFor, seedCommentaryQueue } from '@kestrel/model';
import { buildCapital, buildOutlook, directForecast } from '@kestrel/analysis';

import { commentaryAffordances, commentaryForView } from './commentary';
import { SURFACES } from './navigation';
import { railSignals } from './signals';
import { briefFor, contextOf, viewOf, world } from './world';

const group = () => viewOf({ as: 'group-executive' });
const unit = () => viewOf({ as: 'gulf-controller' });

describe('what the rail says before you click', () => {
  it('counts the decisions the Overview will actually show', () => {
    const view = group();
    const expected = briefFor(view).boards.reduce(
      (sum, board) => sum + board.triage.kept.length,
      0,
    );
    expect(railSignals(view)['/app']?.count).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it('and flags the cash floor only where the forecast actually breaches it', () => {
    const view = group();
    const breach = directForecast(contextOf(view)).breach;
    const signal = railSignals(view)['/app/cash'];
    if (breach === undefined) {
      expect(signal).toBeUndefined();
      return;
    }
    expect(signal?.count).toBe(1);
    expect(signal?.label).toContain(`week ${breach.index}`);
  });

  it('and counts the measures Year to Go flags as behind', () => {
    const view = group();
    const behind = buildOutlook(contextOf(view)).lines.filter(
      (line) => line.trajectory === 'behind',
    ).length;
    expect(railSignals(view)['/app/year-to-go']?.count ?? 0).toBe(behind);
  });

  it('and counts the projects with no headroom left', () => {
    const view = group();
    const exposed = buildCapital(contextOf(view)).projects.filter(
      (row) => row.verdict === 'over_budget' || row.verdict === 'at_risk',
    ).length;
    expect(railSignals(view)['/app/capital']?.count ?? 0).toBe(exposed);
  });

  it('and counts only the commentary this principal can act on', () => {
    /* A badge counting the whole queue sends an executive to a page with nothing for them on it. */
    const view = group();
    const waiting = commentaryForView(seedCommentaryQueue(world()), view).filter(
      (item) => commentaryAffordances(item, view.principal).length > 0,
    ).length;
    expect(railSignals(view)['/app/commentary']?.count ?? 0).toBe(waiting);
  });

  it('and counts the ledgers still open', () => {
    const view = group();
    const open = closePositionsFor(world().closePositions, view.scope.endMonth)
      .filter((position) => view.permission.entityIds.includes(position.entityId))
      .filter((position) => position.state !== 'closed').length;
    expect(railSignals(view)['/app/controls']?.count ?? 0).toBe(open);
  });
});

describe('the signals are scoped like every other read', () => {
  it('does not tell a business-unit controller about a group capital programme', () => {
    /* The leak a page-level test cannot catch, because the page was never opened. The over-budget
       project is Manufacturing's and the one with no headroom is the group's; Gulf may read neither. */
    expect(railSignals(unit())['/app/capital']).toBeUndefined();
    expect(railSignals(group())['/app/capital']?.count ?? 0).toBeGreaterThan(0);
  });

  it('and does not tell them about a ledger outside their subtree', () => {
    expect(railSignals(unit())['/app/controls']).toBeUndefined();
    expect(railSignals(group())['/app/controls']?.count ?? 0).toBeGreaterThan(0);
  });

  it('and gives a narrower reader no more decisions than a wider one', () => {
    const wide = railSignals(group())['/app']?.count ?? 0;
    const narrow = railSignals(unit())['/app']?.count ?? 0;
    expect(narrow).toBeLessThanOrEqual(wide);
  });
});

describe('silence is a statement', () => {
  it('leaves most of the rail unbadged, so a badge means something', () => {
    /* A rail where everything is flagged has said nothing about where to start — the same reason the
       detectors are triaged rather than listed. */
    const signalled = Object.keys(railSignals(group()));
    expect(signalled.length).toBeGreaterThan(0);
    expect(signalled.length).toBeLessThan(SURFACES.length);
  });

  it('and never signals a section that has no pass or fail of its own', () => {
    /* Performance decomposes a variance the Overview already flagged, a scenario is a question, and a
       forecast version is a record. A dot on those would be decoration. */
    const signals = railSignals(group());
    for (const path of ['/app/performance', '/app/kpis', '/app/forecast', '/app/scenarios']) {
      expect(signals[path], `${path} was badged without a test behind it`).toBeUndefined();
    }
  });

  it('and every signal it does raise names what it means', () => {
    for (const signal of Object.values(railSignals(group()))) {
      expect(signal.count).toBeGreaterThan(0);
      expect(signal.label.length).toBeGreaterThan(10);
    }
  });
});
