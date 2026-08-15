import { resolveView } from '@demo-kit/shell';
import { formatValue } from '@kestrel/measures';
import { MINIMUM_CASH, noDecisionBecause } from '@kestrel/analysis';

import { CashColumns } from '../../../components/CashColumns';
import { Masthead } from '../../../components/Chrome';
import { FocusOnLoad } from '../../../components/FocusOnLoad';
import { Selectors } from '../../../components/Selectors';
import { directionClass, movement } from '../../../lib/format';
import {
  LEVERS,
  LIBRARY,
  STANDING_LABELS,
  commentaryDraft,
  governanceOf,
  neutralStep,
  runScenario,
  scenarioHref,
  stepLabel,
} from '../../../lib/scenario';
import type { Params } from '../../../lib/world';
import { viewOf } from '../../../lib/world';

/**
 * Scenarios — assumptions moved, the generator re-run, the difference shown, and the decision named.
 *
 * The claim this surface makes is the one most scenario tools cannot: **a revenue assumption reaches the
 * cash line.** It does so because a scenario here is the same generator run with a different assumption
 * set, so the profit and loss still ties to a balance sheet and the cash figure came down the same path
 * from the revenue figure. Adjusting output figures by a factor produces neither.
 *
 * The collection-days lever is the one to watch in a demo: it moves **no** profit-and-loss figure at all
 * and breaches the cash floor. A product that models scenarios on the income statement alone reports that
 * as "no change".
 *
 * ## Governance is the first thing on the page, not the last
 *
 * The review's instruction is to label a scenario as *not the approved forecast* unless it is approved,
 * and the reason is a specific failure: a screenshot of this page reaching a board pack and being read
 * as the plan. So the banner sits above the numbers rather than under them, and it names the version
 * that *is* approved so a reader knows where to look instead.
 *
 * Every control is a link, so a scenario is an address a finance user can send — and the seeded library
 * is then a list of links rather than a store, which is the honest shape for a tier where nothing a
 * visitor does persists. That address is also the audit record: the assumptions are in it.
 */

export const dynamic = 'force-dynamic';

export default async function Scenarios({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;

  const view = viewOf(params);
  const result = runScenario(view, params);
  const governance = governanceOf(view, result, scenarioHref(view, params, {}));
  const draft = commentaryDraft(view, result);

  const baseBreach = result.baseCash.breach;
  const scenarioBreach = result.scenarioCash.breach;

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      <Masthead path="/app/scenarios" view={view} />
      <Selectors path="/app/scenarios" view={view} />

      <section className="section focusable" id="section-standing" aria-label="Standing">
        <div className={`stamp${result.isBase ? '' : ' stamp-warn'}`}>
          <p className="stamp-label">{governance.label}</p>
          <dl className="stamp-facts">
            <div>
              <dt>Author</dt>
              <dd>{governance.author}</dd>
            </div>
            <div>
              <dt>Prepared</dt>
              <dd>{governance.preparedAt ?? 'Unsaved — this run exists only as the link below'}</dd>
            </div>
            <div>
              <dt>Standing</dt>
              <dd>
                {governance.standing === undefined
                  ? 'Working scenario, not tabled'
                  : STANDING_LABELS[governance.standing]}
              </dd>
            </div>
            <div>
              <dt>Built from</dt>
              <dd>
                {governance.basedOn} ({governance.basedOnStatus})
              </dd>
            </div>
          </dl>
          {governance.history === undefined ? null : (
            <p className="stamp-note">{governance.history}</p>
          )}
          <p className="stamp-note">
            The audit record for a scenario on this tier is its address:{' '}
            <a className="stamp-link" href={governance.permalink}>
              {governance.permalink}
            </a>
            . Nothing is written to any system of record, and no approved figure moves.
          </p>
        </div>
      </section>

      <section className="section focusable" id="section-levers" aria-label="Assumptions">
        <div className="section-head">
          <h2 className="section-title">Move an assumption</h2>
          <span className="section-note">
            Each step is a movement <em>against the approved forecast</em>, not an absolute
            assumption — so &minus;10% means ten per cent below plan whatever plan happens to assume.
            The generator then runs again with the set you choose, so the profit and loss still ties
            to a balance sheet and the cash figure comes down the same path from revenue. The steps
            are bounded to the range a plausible re-forecast moves within.
          </span>
        </div>

        <div className="selectors">
          {LEVERS.map((entry) => (
            <div key={entry.key} className="sel-row" title={entry.note}>
              <span className="sel-label">{entry.label}</span>
              <div className="sel-chips">
                {entry.steps.map((step) => {
                  const isBase = step === neutralStep(entry.key);
                  const active = isBase
                    ? result.steps[entry.key] === undefined
                    : result.steps[entry.key] === step;
                  return (
                    <a
                      key={step}
                      className={`chip-link${active ? ' is-active' : ''}`}
                      href={scenarioHref(view, params, {
                        [entry.key]: isBase ? '' : String(step),
                      })}
                    >
                      {stepLabel(entry.key, step)}
                      {isBase ? <span className="chip-mark">plan</span> : null}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {result.isBase ? (
          <p className="narration">
            Nothing has moved, so this is the approved forecast against itself. Choose a step above,
            or one of the saved scenarios below.
          </p>
        ) : (
          <p className="narration">
            <strong>
              {result.moved.length} assumption{result.moved.length === 1 ? '' : 's'} moved.
            </strong>{' '}
            The figures below are a proposal held beside the approved forecast — nothing here
            changes an approved figure, and nothing is written to any system of record.
          </p>
        )}
      </section>

      {result.isBase ? null : (
        <section className="section focusable" id="section-trail" aria-label="Changed assumptions">
          <div className="section-head">
            <h2 className="section-title">What was changed, and from what</h2>
            <span className="section-note">
              The governance record the review asks for: every assumption this scenario moved, the
              approved forecast&rsquo;s own value beside it, and who owns the driver. The right-hand
              column is not a probability — it is whether any stored version has ever planned on a
              number like this one.
            </span>
          </div>
          <div className="pane">
            <table className="grid">
              <thead>
                <tr>
                  <th scope="col">Assumption</th>
                  <th scope="col">Owner</th>
                  <th scope="col" className="num">
                    Approved
                  </th>
                  <th scope="col" className="num">
                    Scenario
                  </th>
                  <th scope="col" className="num">
                    Step
                  </th>
                  <th scope="col">Against precedent</th>
                </tr>
              </thead>
              <tbody>
                {result.trail.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td>{row.owner}</td>
                    <td className="num">
                      {row.mode === 'delta' ? `${row.from}d` : row.from.toFixed(3)}
                    </td>
                    <td className="num">{row.mode === 'delta' ? `${row.to}d` : row.to.toFixed(3)}</td>
                    <td className="num">{stepLabel(row.key, row.step)}</td>
                    {/* Amber rather than red: sitting outside experience is a caution, and red in
                        this product means an unfavourable variance. Precedent is not a direction. */}
                    <td
                      className={row.precedent.band === 'within' ? 'muted-cell' : 'precedent-out'}
                    >
                      {row.precedent.statement}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="chart-note">
              <strong>{result.confidence.label}.</strong> {result.confidence.statement} There is no
              percentage here on purpose: five stored versions are a range, not a distribution, and a
              likelihood printed from them would be the one figure on this page nobody could defend.
            </p>
          </div>
        </section>
      )}

      <section className="section focusable" id="section-effect" aria-label="Effect">
        <div className="section-head">
          <h2 className="section-title">What it does, this month</h2>
          <span className="section-note">
            Plan against plan: the scenario and {result.approved.label} both read a forecast version,
            so the difference is the assumption rather than the gap between a projection and a
            record. {result.budget.label} sits beside them because a scenario below the approved
            forecast may still be above budget, and those two facts start opposite conversations.
          </span>
        </div>
        <div className="pane">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">
                  {result.budget.label}
                </th>
                <th scope="col" className="num">
                  {result.approved.label}
                </th>
                <th scope="col" className="num">
                  Scenario
                </th>
                <th scope="col" className="num">
                  vs forecast
                </th>
                <th scope="col" className="num">
                  vs budget
                </th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((line) => (
                <tr key={line.measureId}>
                  <th scope="row">{line.label}</th>
                  <td className="num muted-cell">{formatValue(line.budgetValue, line.unit)}</td>
                  <td className="num">{formatValue(line.baseValue, line.unit)}</td>
                  <td className="num">{formatValue(line.scenarioValue, line.unit)}</td>
                  <td className={`num ${directionClass(line.favourable)}`}>
                    {line.movement === null || line.movement === 0
                      ? '—'
                      : movement(line.movement, line.unit)}
                  </td>
                  <td className={`num ${directionClass(line.budgetFavourable)}`}>
                    {line.vsBudget === null || line.vsBudget === 0
                      ? '—'
                      : movement(line.vsBudget, line.unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="chart-note">
            Direction comes from each measure&rsquo;s polarity, not the arithmetic sign — a cost
            that rose is a positive movement and unfavourable news.
          </p>
        </div>
      </section>

      <section className="section focusable" id="section-year" aria-label="Where the year lands">
        <div className="section-head">
          <h2 className="section-title">
            Where FY{String(result.fiscalYear).slice(-2)} lands under it
          </h2>
          <span className="section-note">
            The same measures across the fiscal year rather than the selected month. A lever moved and
            reported only in one month leaves a reader to multiply by five, which is the arithmetic
            the Year to Go surface exists to stop them doing.
          </span>
        </div>
        <div className="pane">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">
                  {result.budget.label}
                </th>
                <th scope="col" className="num">
                  {result.approved.label}
                </th>
                <th scope="col" className="num">
                  Scenario
                </th>
                <th scope="col" className="num">
                  vs forecast
                </th>
                <th scope="col" className="num">
                  vs budget
                </th>
              </tr>
            </thead>
            <tbody>
              {result.yearLines.map((line) => (
                <tr key={line.measureId}>
                  <th scope="row">{line.label}</th>
                  <td className="num muted-cell">{formatValue(line.budgetValue, line.unit)}</td>
                  <td className="num">{formatValue(line.baseValue, line.unit)}</td>
                  <td className="num">{formatValue(line.scenarioValue, line.unit)}</td>
                  <td className={`num ${directionClass(line.favourable)}`}>
                    {line.movement === null || line.movement === 0
                      ? '—'
                      : movement(line.movement, line.unit)}
                  </td>
                  <td className={`num ${directionClass(line.budgetFavourable)}`}>
                    {line.vsBudget === null || line.vsBudget === 0
                      ? '—'
                      : movement(line.vsBudget, line.unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="chart-note">
            Cash and net debt are closing balances, so their year column is the year-end position
            rather than a sum. Revenue, EBITDA and profit after tax add.
          </p>
        </div>
      </section>

      <section className="section focusable" id="section-decision" aria-label="Decision implied">
        <div className="section-head">
          <h2 className="section-title">What this asks management to decide</h2>
          <span className="section-note">
            Triggered by what the outcome broke rather than by which lever moved. A lookup on the
            lever would answer &ldquo;collections&rdquo; for the scenario that puts the group through
            its cash floor, when the decision on the table is a transfer with a date on it.
          </span>
        </div>
        {result.decisions.length === 0 ? (
          <p className="narration">
            {result.isBase
              ? 'Nothing has moved, so there is no decision to take. Choose a step above.'
              : noDecisionBecause()}
          </p>
        ) : (
          <div className="board-items">
            {result.decisions.map((decision) => (
              <article
                key={decision.id}
                className={`finding${decision.dated ? ' finding-urgent' : ''}`}
              >
                <header className="finding-head">
                  <h3 className="finding-title">{decision.label}</h3>
                  <span className={`finding-tag${decision.dated ? ' is-dated' : ''}`}>
                    {decision.dated ? 'Dated' : 'Cycle'}
                  </span>
                </header>
                <p className="finding-statement">{decision.because}.</p>
                {/* The when on its own line, not in the footer: a dated decision's clause names the
                    week and the reason it is that week, and it does not fit beside an owner. */}
                <p className="finding-when">
                  <span className="finding-when-key">By</span> {decision.by}
                </p>
                <footer className="finding-foot">
                  <span className="finding-owner">{decision.owner}</span>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section focusable" id="section-headroom" aria-label="Covenant headroom">
        <div className="section-head">
          <h2 className="section-title">Headroom against the floor</h2>
          <span className="section-note">
            The board&rsquo;s minimum is {formatValue(MINIMUM_CASH.amountMinor, 'currency')}, set in{' '}
            {MINIMUM_CASH.owner}. Headroom is measured at the horizon&rsquo;s low point rather than
            at its close, because a forecast that ends comfortably and dips in week nine still needs
            funding in week nine.
          </span>
        </div>
        <div className="pane">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col" className="num">
                  Low point
                </th>
                <th scope="col" className="num">
                  Headroom
                </th>
                <th scope="col">Breach</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Approved forecast</th>
                <td className="num">{formatValue(result.baseCash.low.amount, 'currency')}</td>
                <td className={`num ${result.baseHeadroom < 0 ? 'neg' : 'pos'}`}>
                  {movement(result.baseHeadroom, 'currency')}
                </td>
                <td className={baseBreach === undefined ? '' : 'neg'}>
                  {baseBreach === undefined ? 'None' : `Week ${baseBreach.index}`}
                </td>
              </tr>
              <tr className={result.scenarioHeadroom < 0 ? 'row-warn' : ''}>
                <th scope="row">Scenario</th>
                <td className="num">{formatValue(result.scenarioCash.low.amount, 'currency')}</td>
                <td className={`num ${result.scenarioHeadroom < 0 ? 'neg' : 'pos'}`}>
                  {movement(result.scenarioHeadroom, 'currency')}
                </td>
                <td className={scenarioBreach === undefined ? '' : 'neg'}>
                  {scenarioBreach === undefined ? 'None' : `Week ${scenarioBreach.index}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="section focusable" id="section-cashline" aria-label="Scenario cash line">
        <div className="section-head">
          <h2 className="section-title">The weekly cash line under this scenario</h2>
          <span className="section-note">
            Recomputed from the scenario&rsquo;s own receivables and payables, not shifted by a
            factor.
          </span>
        </div>
        <div className="pane">
          <CashColumns forecast={result.scenarioCash} />
        </div>
      </section>

      <section className="section focusable" id="section-draft" aria-label="Into commentary">
        <div className="section-head">
          <h2 className="section-title">Into the executive commentary</h2>
          <span className="section-note">
            The review asks material scenarios to reach the board narrative. What it cannot mean here
            is a button that claims to file one: the commentary workflow is draft, review, approve,
            publish, and this tier stores nothing. So the paragraph is composed from the figures
            above and handed over — to be taken, not filed.
          </span>
        </div>
        <div className="pane">
          {draft.text === null ? (
            <p className="narration">{draft.why}</p>
          ) : (
            <>
              <blockquote className="draft-quote">{draft.text}</blockquote>
              <p className="chart-note">{draft.why}</p>
              <p className="chart-note">
                <a className="finding-action" href="/app/commentary">
                  {draft.mayDraft ? 'Open the commentary queue' : 'Read the commentary queue'}
                </a>
              </p>
            </>
          )}
        </div>
      </section>

      <section className="section focusable" id="section-library" aria-label="Saved scenarios">
        <div className="section-head">
          <h2 className="section-title">Saved scenarios</h2>
          <span className="section-note">
            Each is a link rather than a stored record. Nothing a visitor does persists on this
            tier, and a library that pretended otherwise would lose a scenario on reload — which is
            the failure a demo audience always finds. What they do carry is provenance: who prepared
            each one, when, and where it has been.
          </span>
        </div>
        <div className="board-items library">
          {LIBRARY.map((entry) => (
            <article key={entry.name} className="finding">
              <header className="finding-head">
                <h3 className="finding-title">{entry.name}</h3>
                <span className="finding-tag">{STANDING_LABELS[entry.standing]}</span>
              </header>
              <p className="finding-statement">{entry.why}</p>
              <p className="finding-detail">{entry.history}</p>
              <footer className="finding-foot">
                <span className="finding-owner">
                  {entry.author} &middot; {entry.preparedAt}
                </span>
                <a className="finding-action" href={scenarioHref(view, {}, entry.params)}>
                  Run it
                </a>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
