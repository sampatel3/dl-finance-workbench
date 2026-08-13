/**
 * The guided tour: ten claims, each landing on the surface that proves it.
 *
 * Nothing here describes a roadmap. A tour is a sequence of evidence, not a list of aspirations, so
 * every step names something the running application can show at the URL beside it. The first step is
 * also the phone step: it switches the shell's device itself instead of asking a visitor to find a
 * second control while they are trying to understand the opening position.
 */

import type { Tour } from '@demo-kit/shell';
import { DEMO_NAME } from './demo';
import { LATEST_MONTH, monthLabel } from './world';

function surface(path: string, focus: string, params: Readonly<Record<string, string>> = {}): string {
  const query = new URLSearchParams({ view: 'inner', focus, ...params });
  return `${path}?${query.toString()}`;
}

export const TOUR: Tour = {
  title: DEMO_NAME,
  intro:
    'Ten stops through one governed model: the position, the movement, the evidence, the decision and ' +
    'the controls that make every figure reproducible.',
  overview: {
    eyebrow: 'Finance workbench',
    heading: 'One governed answer, opened at three depths',
    body: [
      `${DEMO_NAME} is a synthetic multi-entity finance group built to show how an executive answer, ` +
        'an analyst drill and a controller evidence chain can remain the same computation.',
      'The figures are deterministic. A model may phrase a bounded commentary or answer from governed ' +
        'tools; it never invents a number, changes an assumption, approves a pack or posts a journal.',
    ],
    points: [
      'See the position and the decisions it raises in ninety seconds.',
      'Take any figure through movement, drivers, formula, rows and source vintage.',
      'Change forecast assumptions in an isolated scenario and see the whole model recompute.',
      'Inspect close, reconciliation, mappings, permissions, approvals and AI usage by name.',
    ],
    start: 'Start with the position',
  },
  steps: [
    {
      short: 'The position',
      device: 'iphone',
      heading: `${monthLabel(LATEST_MONTH)}, in ninety seconds`,
      whatItIs:
        'Four headline measures and four priority boards, computed for five entities in four currencies. ' +
        'The completeness banner says that one ledger is submitted and not yet closed before any figure is read.',
      whyItMatters:
        'An executive surface earns its keep by removing figures. Findings lead, figures support them, and ' +
        'the same page holds at a phone viewport because that is where a decision is often first reviewed.',
      lookAt: 'The close banner, then the four boards. The shell has switched to the phone for this step.',
      href: surface('/app', 'section-headline'),
    },
    {
      short: 'What changed',
      heading: 'The movement, decomposed',
      whatItIs:
        'A revenue bridge from the selected comparator to actual. Currency is separated first, then volume, ' +
        'price, mix and the unsegmented amount; every contribution sums to the movement to the penny.',
      whyItMatters:
        'A variance is subtraction. A bridge makes it assignable: each bar can have an owner, and a named ' +
        'residual makes unexplained movement visible instead of hiding it in “other”.',
      lookAt: 'The contribution bars and the explicit summing statement under the waterfall.',
      href: surface('/app/performance', 'section-bridge', { measure: 'revenue' }),
    },
    {
      short: 'Source evidence',
      heading: 'Drill the same figure to rows',
      whatItIs:
        'The selected revenue cell is recomputed one level down, with the intercompany elimination named, ' +
        'then terminates in source-shaped rows carrying the immutable vintage that loaded each one.',
      whyItMatters:
        'The board card, pivot cell, formula inspector and source lineage are one computation opened at ' +
        'different depths. Four separate drill implementations would eventually produce four answers.',
      lookAt: 'The named elimination, the exact tie statement, and the vintage column in the source rows.',
      href: surface('/app/explore', 'section-drill', {
        rows: 'measure',
        cols: 'period',
        drill: '0:5',
      }),
    },
    {
      short: 'The pivot',
      heading: 'An analyst can take the number apart',
      whatItIs:
        'Measures, entities and segments down one axis; periods across the other. Every total is recomputed ' +
        'at its own scope, so a cash balance is its closing month and a margin is never added to another margin.',
      whyItMatters:
        'A grid that disagrees with the Overview destroys both. Using the governed measure computation for ' +
        'every cell makes agreement structural rather than a reconciliation exercise after the fact.',
      lookAt: 'The three-dimension row path, the window total, and the note explaining non-additive measures.',
      href: surface('/app/explore', 'section-axes', {
        rows: 'measure,entity,segment',
        cols: 'period',
      }),
    },
    {
      short: 'The forecast',
      heading: 'What changed since version v6',
      whatItIs:
        'The active approved version, its observed and assumed drivers, their owners, and a version diff ' +
        'against v6. Assumptions are shown as changes; outputs are recomputed from them.',
      whyItMatters:
        'A versioned forecast without a version diff can say what the new numbers are and cannot say why ' +
        'they changed. The driver graph is the edge between an assumption and the measure it moves.',
      lookAt: 'The v6-to-v7 changes, then the measured effect on revenue, margin, EBITDA and cash.',
      href: surface('/app/forecast', 'section-diff', { from: 'v6' }),
    },
    {
      short: 'The scenario',
      heading: 'Move an assumption; move the cash line',
      whatItIs:
        'A scenario is the approved forecast plus assumption deltas in the URL. The generator runs again, ' +
        'so the P&L, balance sheet, working capital and thirteen-week cash forecast move together.',
      whyItMatters:
        'Scaling output figures produces a P&L that no longer ties to a balance sheet. Re-running the model ' +
        'is what lets a collections assumption take cash out without pretending revenue changed.',
      lookAt: 'The scenario cash line and its comparison with the approved forecast.',
      href: surface('/app/scenarios', 'section-cashline', { dsoDays: '10' }),
    },
    {
      short: 'Liquidity',
      heading: 'Thirteen weeks, with the floor named',
      whatItIs:
        'Receipts and payments are shown separately, the board-approved cash floor is drawn across the ' +
        'forecast, and the first breach is named by week rather than left for a reader to spot.',
      whyItMatters:
        'A forecast that closes comfortably can still need funding in week nine. A monthly net figure hides ' +
        'both the timing and two large flows that happen to offset.',
      lookAt: 'Week 9, the shortfall against the floor, and the recovery by the end of the horizon.',
      href: surface('/app/cash', 'section-weekly'),
    },
    {
      short: 'Forecast quality',
      heading: 'Does the forecast deserve trust?',
      whatItIs:
        'Error is scored by horizon, same-direction bias is tested across versions, and forecast value added ' +
        'is measured against the stated “same month last year” baseline.',
      whyItMatters:
        'A forecasting product that never scores its forecasts is asking for trust it has not earned. Bias ' +
        'finds the assumption that is repeatedly wrong even when average accuracy still looks respectable.',
      lookAt: 'The biased measures, the run across versions, and the materiality threshold beside it.',
      href: surface('/app/quality', 'section-bias'),
    },
    {
      short: 'Permissions',
      heading: 'Who you are changes what exists',
      whatItIs:
        'The Gulf business-unit controller resolves to one entity subtree and the same restriction binds ' +
        'the selectors, every measure context and the Ask tools. Group data is not a hidden option; it is unavailable.',
      whyItMatters:
        'A chat that can answer a group question for somebody whose grid cannot open the group is the way ' +
        'around the permission model. A named refusal is the safe and persuasive outcome.',
      lookAt: 'The principal in the header, the one-entity selector, and the resolved permission card.',
      href: surface('/app/controls', 'section-permissions', { as: 'gulf-controller' }),
    },
    {
      short: 'Can I explain it?',
      heading: 'The controls behind the number',
      whatItIs:
        'Loads and vintages, close readiness, named reconciliation checks, mapping coverage, the measure ' +
        'catalogue, published lineage, AI usage and permissions are visible in one controller surface.',
      whyItMatters:
        'A green status light cannot explain a wrong number. The useful control is the one that fails by ' +
        'name: £48k of intercompany mismatch, two unmapped accounts and £212k at stake.',
      lookAt: 'The failing reconciliation, the two unmapped accounts, and the published figure’s pinned vintage.',
      href: surface('/app/controls', 'section-checks'),
    },
  ],
};
