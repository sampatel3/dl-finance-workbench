import { FocusOnLoad, resolveView } from '@demo-kit/shell';
import { formatValue } from '@kestrel/measures';
import { MINIMUM_CASH } from '@kestrel/analysis';

import { CashColumns } from '../../../components/CashColumns';
import { Masthead } from '../../../components/Chrome';
import { Selectors } from '../../../components/Selectors';
import { directionClass, movement } from '../../../lib/format';
import { LEVERS, LIBRARY, baseStep, runScenario, scenarioHref } from '../../../lib/scenario';
import type { Params } from '../../../lib/world';
import { viewOf } from '../../../lib/world';

/**
 * Scenarios — assumptions moved, the generator re-run, the difference shown.
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
 * Every control is a link, so a scenario is an address a finance user can send — and the seeded library
 * is then a list of links rather than a store, which is the honest shape for a tier where nothing a
 * visitor does persists.
 */

export const dynamic = 'force-dynamic';

export default async function Scenarios({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;

  const view = viewOf(params);
  const result = runScenario(view, params);

  const baseBreach = result.baseCash.breach;
  const scenarioBreach = result.scenarioCash.breach;

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      {inner ? null : <Masthead path="/app/scenarios" view={view} />}
      <Selectors path="/app/scenarios" view={view} />

      <section className="section focusable" id="section-levers" aria-label="Assumptions">
        <div className="section-head">
          <h2 className="section-title">Move an assumption</h2>
          <span className="section-note">
            The generator runs again with the set you choose, so the profit and loss still ties to a
            balance sheet and the cash figure comes down the same path from revenue. The steps are
            bounded to the range a plausible re-forecast moves within — an unbounded slider mostly
            proves that a model can be made to print nonsense.
          </span>
        </div>

        <div className="selectors">
          {LEVERS.map((lever) => (
            <div key={lever.key} className="sel-row" title={lever.note}>
              <span className="sel-label">{lever.label}</span>
              <div className="sel-chips">
                {lever.steps.map((step) => {
                  const active = result.assumptions[lever.key] === step;
                  const isBase = baseStep(lever.key) === step;
                  return (
                    <a
                      key={step}
                      className={`chip-link${active ? ' is-active' : ''}`}
                      href={scenarioHref(view, params, {
                        [lever.key]: isBase ? '' : String(step),
                      })}
                    >
                      {lever.key === 'dsoDays'
                        ? `${step > 0 ? '+' : ''}${step}d`
                        : formatValue(step - 1, 'percent')}
                      {isBase ? <span className="chip-mark">base</span> : null}
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

      <section className="section focusable" id="section-effect" aria-label="Effect">
        <div className="section-head">
          <h2 className="section-title">What it does</h2>
          <span className="section-note">
            Plan against plan: both sides read a forecast version, so the difference is the
            assumption rather than the gap between a projection and a record.
          </span>
        </div>
        <div className="pane">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">
                  Approved
                </th>
                <th scope="col" className="num">
                  Scenario
                </th>
                <th scope="col" className="num">
                  Movement
                </th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((line) => (
                <tr key={line.measureId}>
                  <th scope="row">{line.label}</th>
                  <td className="num">{formatValue(line.baseValue, line.unit)}</td>
                  <td className="num">{formatValue(line.scenarioValue, line.unit)}</td>
                  <td className={`num ${directionClass(line.favourable)}`}>
                    {line.movement === null || line.movement === 0
                      ? '—'
                      : movement(line.movement, line.unit)}
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

      <section className="section focusable" id="section-library" aria-label="Saved scenarios">
        <div className="section-head">
          <h2 className="section-title">Saved scenarios</h2>
          <span className="section-note">
            Each is a link rather than a stored record. Nothing a visitor does persists on this
            tier, and a library that pretended otherwise would lose a scenario on reload — which is
            the failure a demo audience always finds.
          </span>
        </div>
        <div className="board-items library">
          {LIBRARY.map((entry) => (
            <article key={entry.name} className="finding">
              <header className="finding-head">
                <h3 className="finding-title">{entry.name}</h3>
              </header>
              <p className="finding-statement">{entry.why}</p>
              <footer className="finding-foot">
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
