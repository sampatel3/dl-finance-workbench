/**
 * The guided tour: twelve claims, in the same finance-native order as the product navigation.
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
    'Twelve stops through one governed model: Actual → Explain → Forecast → Decide → Act → Control, ' +
    'with the evidence behind every material figure.',
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
        'Four headline measures and four finance decision boards, computed for five entities in four currencies. ' +
        'Close status is stated before any number, and each material headline now opens its analysis or evidence.',
      whyItMatters:
        'An executive surface earns its keep by removing figures. Findings lead, figures support them, and ' +
        'the same page holds at a phone viewport because that is where a decision is often first reviewed.',
      lookAt: 'The close banner, the reporting context, and the Adverse, Favourable, Risks and Opportunities boards.',
      href: surface('/', 'section-headline'),
    },
    {
      short: 'What changed',
      heading: 'Revenue movement, decomposed',
      whatItIs:
        'A bridge from the selected comparator to actual. Currency is separated first, then volume, price, mix ' +
        'and the named residual; every contribution sums to the movement to the penny.',
      whyItMatters:
        'A variance is subtraction. A bridge makes it assignable: each contribution can have an owner, and a ' +
        'named residual makes unexplained movement visible instead of hiding it in “other”.',
      lookAt: 'The contribution bars, comparator basis and the explicit summing statement.',
      href: surface('/performance', 'section-bridge', { measure: 'revenue' }),
    },
    {
      short: 'Profitability',
      heading: 'Revenue is not the whole performance story',
      whatItIs:
        'Gross profit, operating expense and EBITDA are reconciled in one view, with the selected comparator ' +
        'and trend metric carried in the URL.',
      whyItMatters:
        'A top-line beat can still land behind plan after delivery cost and overhead. Finance needs the landing ' +
        'from revenue to EBITDA, not a separate set of charts that may disagree.',
      lookAt: 'The EBITDA composition and the Opex lines that explain the profitability gap.',
      href: surface('/performance', 'section-ebitda', { measure: 'ebitda' }),
    },
    {
      short: 'The forecast',
      heading: 'What changed since version v6',
      whatItIs:
        'The active approved version, its observed and assumed drivers, their owners, and a version diff against ' +
        'v6. Assumptions are shown as changes; outputs are recomputed from them.',
      whyItMatters:
        'A versioned forecast without a version diff can say what the new numbers are and cannot say why they ' +
        'changed. The driver graph is the edge between an assumption and the measure it moves.',
      lookAt: 'The approved version in force, the v6-to-v7 changes and their measured effects.',
      href: surface('/forecast', 'section-diff', { version: 'v7', from: 'v6' }),
    },
    {
      short: 'Year to go',
      heading: 'Where the full year is expected to land',
      whatItIs:
        'Actuals at the selected reporting boundary are combined with the remaining approved forecast for ' +
        'Revenue, Gross Profit, Gross Margin, EBITDA and Cash; the close banner states whether they are final.',
      whyItMatters:
        'A monthly variance says where Finance has been. The expected full-year landing says whether the current ' +
        'trajectory needs a decision while there is still time to change it.',
      lookAt: 'Actual YTD, remaining forecast, expected FY, budget variance and Ahead/Behind trajectory.',
      href: surface('/year-to-go', 'section-landing'),
    },
    {
      short: 'Liquidity',
      heading: 'Thirteen weeks, with working capital beside it',
      whatItIs:
        'Receipts and payments are shown separately, the board-approved cash floor is drawn across the forecast, ' +
        'and collection, payment, inventory days and working capital are computed by entity.',
      whyItMatters:
        'A forecast that closes comfortably can still need funding in week nine. The working-capital view names ' +
        'which entity is holding cash instead of leaving the low point unexplained.',
      lookAt: 'The first breach, lowest liquidity point, recovery timing and entity working-capital table.',
      href: surface('/cash', 'section-weekly'),
    },
    {
      short: 'KPIs',
      heading: 'One governed scorecard',
      whatItIs:
        'Financial, working-capital and operational KPIs show Actual, Budget target, approved Forecast, Prior Year, ' +
        'prior-period movement, definition owner and approval status in the same reporting context.',
      whyItMatters:
        'An operational measure should not become an executive KPI merely because it is available. Draft definitions ' +
        'remain visible but cannot masquerade as approved finance policy.',
      lookAt: 'The target basis, trend direction, owner and explicit draft definition state.',
      href: surface('/kpis', 'section-kpi-summary'),
    },
    {
      short: 'The scenario',
      heading: 'Move an assumption; move the cash line',
      whatItIs:
        'A scenario is the approved forecast plus explicit assumption deltas in the URL. The generator runs again, ' +
        'so P&L, working capital and the thirteen-week cash forecast move together.',
      whyItMatters:
        'Scaling output figures produces statements that no longer tie. Re-running the model is what lets a ' +
        'collections assumption move cash without pretending revenue changed.',
      lookAt: 'The side-by-side effect and headroom comparison with the approved forecast.',
      href: surface('/scenarios', 'section-effect', { dsoDays: '10' }),
    },
    {
      short: 'Commentary',
      heading: 'Board narrative, with controller evidence underneath',
      whatItIs:
        'A concise Board-ready statement opens into movement, drivers, accounts and source rows. Approval events ' +
        'name the actor, and publication freezes both wording and data vintage.',
      whyItMatters:
        'Executives need the answer; controllers need to reproduce it. Keeping both depths on one governed item ' +
        'avoids a polished narrative becoming detached from the figures it describes.',
      lookAt: 'The Board-ready headline, supporting chain and immutable published snapshot.',
      href: surface('/commentary', 'section-commentary'),
    },
    {
      short: 'Forecast quality',
      heading: 'Does the forecast deserve trust?',
      whatItIs:
        'Error is scored by horizon, same-direction bias is tested across versions, and forecast value added is ' +
        'measured against the stated prior-year baseline.',
      whyItMatters:
        'A forecasting product that never scores its forecasts is asking for trust it has not earned. Persistent ' +
        'bias identifies the assumption and owner that repeatedly need attention.',
      lookAt: 'The biased measures, the run across versions and the forecast horizon.',
      href: surface('/quality', 'section-bias'),
    },
    {
      short: 'Controls',
      heading: 'The controls and permission boundary behind the number',
      whatItIs:
        'Loads, close readiness, named reconciliation checks, mappings, catalogue, lineage, AI usage and the ' +
        'resolved role and organisational scope are visible in one finance control domain.',
      whyItMatters:
        'A green status light cannot explain a wrong number, and a chat must not be a way around row-level access. ' +
        'Useful controls fail and refuse access by name.',
      lookAt: 'The check counts, failed reconciliation, unmapped accounts, pinned vintage and permission card.',
      href: surface('/controls', 'section-checks'),
    },
    {
      short: 'Explore & Ask',
      heading: 'Take any answer back to governed evidence',
      whatItIs:
        'Ready-made finance views open the analyst pivot, Ask inherits the complete reporting context, and a cited ' +
        'measure exposes currency basis, consolidation, source rows, load vintages and close status.',
      whyItMatters:
        'Ad-hoc analysis is useful only when it agrees with Overview and can show where a number came from. Every ' +
        'cell is recomputed at its own scope rather than apportioned from a total.',
      lookAt: 'The exact cited-measure summary, then its supporting time-series grid and drill to source-shaped rows.',
      href: surface('/explore', 'section-cited-measure', {
        rows: 'measure',
        cols: 'period',
        measure: 'ebitda',
      }),
    },
  ],
};
