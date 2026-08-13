import { resolveView } from '@demo-kit/shell';
import { formatValue, measure } from '@kestrel/measures';
import {
  BIAS_MATERIALITY,
  BIAS_RUN_THRESHOLD,
  SCORED_MEASURES,
  qualityReport,
  scoreCashForecast,
  directForecast,
} from '@kestrel/analysis';

import { Masthead } from '../../../components/Chrome';
import { FocusOnLoad } from '../../../components/FocusOnLoad';
import { Selectors } from '../../../components/Selectors';
import { QualityControlsNav } from '../../../components/QualityControlsNav';
import { movement } from '../../../lib/format';
import type { Params } from '../../../lib/world';
import { LATEST_MONTH, contextOf, monthLabel, viewOf } from '../../../lib/world';

/**
 * Quality — the surface that holds the product accountable for its own output.
 *
 * The client's PRD measures the *product's* success by cycle time and adoption. It never measures the
 * *forecast's* accuracy, and that is the gap with a hole where the credibility should be: a product that
 * generates forecasts and never scores them is asking for trust it has not earned.
 *
 * It is also nearly free — the versions the product keeps are a record of what it believed and when — so
 * scoring is arithmetic over things already stored. That it is cheap and was still omitted is why it is
 * argued into the build rather than a later phase.
 *
 * Three instruments, each answering a different question, and the second is the one nothing else here
 * will find: error tells you how wrong, bias tells you whether it is wrong the *same way* every time.
 * A forecast can be accurate on average and biased every single time.
 */

export const dynamic = 'force-dynamic';

/** A locked week and what arrived, for the weekly score. Seeded: the demo has no future to observe. */
const LOCKED = [
  { week: '2026-07W1', index: 1, receipts: 285_000_00, payments: 240_000_00 },
  { week: '2026-07W2', index: 2, receipts: 262_000_00, payments: 351_000_00 },
  { week: '2026-07W3', index: 3, receipts: 298_000_00, payments: 205_000_00 },
] as const;
const ACTUAL = [
  { week: '2026-07W1', receipts: 251_000_00, payments: 206_000_00 },
  { week: '2026-07W2', receipts: 274_000_00, payments: 363_000_00 },
  { week: '2026-07W3', receipts: 281_000_00, payments: 188_000_00 },
] as const;

export default async function Quality({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;
  const selectedMeasure = typeof params.measure === 'string' ? params.measure : undefined;

  const view = viewOf(params);
  const ctx = contextOf(view);

  const reports = SCORED_MEASURES.map((id) => qualityReport(id, ctx));
  /* The locked-versus-actual weekly history is seeded at group scope. Do not relabel those rows as an
     entity score when a narrower persona is active; absence is safer than leaking a group series. */
  const cash =
    view.entityId === 'group' && view.through === LATEST_MONTH
      ? scoreCashForecast([...LOCKED], [...ACTUAL])
      : null;
  const forecast = directForecast(ctx);

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      <Masthead path="/app/quality" view={view} />
      <Selectors path="/app/quality" view={view} />
      <QualityControlsNav active="quality" view={view} />

      <section className="section focusable" id="section-bias" aria-label="Bias">
        <div className="section-head">
          <h2 className="section-title">Forecast bias &amp; accuracy</h2>
          <span className="section-note">
            Persistent over- or under-forecasting across stored versions, separated from ordinary
            forecast error. A run is measured across <strong>versions</strong>, not across months. Months inside one version
            share its assumptions, so twelve months all wrong the same way is one mistake seen
            twelve times; three versions all wrong the same way is three separate opportunities to
            correct it, not taken. Bias needs a run of {BIAS_RUN_THRESHOLD} <em>and</em> a mean miss
            over {formatValue(BIAS_MATERIALITY, 'percent')} — a run of three at 58 basis points is
            real, consistent, and not worth anybody&rsquo;s afternoon.
          </span>
        </div>
        <div className="pane">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">
                  Mean error
                </th>
                <th scope="col" className="num">
                  Run
                </th>
                <th scope="col">Verdict</th>
                <th scope="col">Per version</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr
                  key={report.measureId}
                  className={[
                    report.bias.biased ? 'row-warn' : '',
                    selectedMeasure === report.measureId ? 'row-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <th scope="row">{report.label}</th>
                  <td className={`num ${report.bias.biased ? 'neg' : ''}`}>
                    {movement(report.bias.meanSignedError, 'percent')}
                  </td>
                  <td className="num">
                    {report.bias.consecutiveVersions} of {report.bias.versionsScored}
                  </td>
                  <td>
                    {report.bias.biased ? (
                      <span className="chip-high">
                        {report.bias.direction === 'under' ? 'under-called' : 'over-called'}
                      </span>
                    ) : (
                      <span className="chip-low">{report.bias.withheld ?? 'no run'}</span>
                    )}
                  </td>
                  <td className="mono-cell">
                    {report.bias.byVersion
                      .map((v) => `${v.versionId} ${movement(v.meanSignedError, 'percent')}`)
                      .join('  ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="chart-note">
            The per-version series is the evidence rather than the assertion: a reader told
            &ldquo;biased&rdquo; and shown one number has to take it on trust. The misses shrink
            each time, which is why no single version&rsquo;s variance looked like a pattern.
          </p>
        </div>
      </section>

      <section className="section focusable" id="section-horizon" aria-label="Error by horizon">
        <div className="section-head">
          <h2 className="section-title">How wrong, and at what distance</h2>
          <span className="section-note">
            Reported per horizon rather than pooled. A team whose one-month forecast is excellent
            and whose six-month forecast is guesswork has a specific, fixable problem, and a single
            average conceals it in both directions. The sample thins with distance — every version
            forecasts one month ahead and only the oldest forecasts seven — so the point count is
            shown beside the error rather than left out.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                {[1, 2, 3, 4, 5, 6, 7].map((h) => (
                  <th key={h} scope="col" className="num">
                    +{h}m
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.measureId}>
                  <th scope="row">{report.label}</th>
                  {[1, 2, 3, 4, 5, 6, 7].map((h) => {
                    const at = report.horizons.find((entry) => entry.horizon === h);
                    return (
                      <td key={h} className="num">
                        {at === undefined ? (
                          '—'
                        ) : (
                          <>
                            {formatValue(at.mape, 'percent')}
                            <span className="cell-sub">{at.points}</span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="chart-note">
            Mean absolute percentage error, with the number of scored points beneath it. Only months
            after a version&rsquo;s own cut-off are scored — a version&rsquo;s actuals are not a
            forecast, and scoring them would give every version a perfect record for its first half.
          </p>
        </div>
      </section>

      <section className="section focusable" id="section-value" aria-label="Value added">
        <div className="section-head">
          <h2 className="section-title">Does the process beat a naive baseline?</h2>
          <span className="section-note">
            An uncomfortable question, and a forecast that loses to &ldquo;same as last year&rdquo;
            is one costing more than it is worth. The baseline is stated rather than implied,
            because &ldquo;better than nothing&rdquo; is not a claim anybody can check — and in a
            seasonal business last July is a genuinely hard bar for this July.
          </span>
        </div>
        <div className="pane">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">
                  Forecast error
                </th>
                <th scope="col" className="num">
                  Baseline error
                </th>
                <th scope="col" className="num">
                  Value added
                </th>
                <th scope="col">Baseline</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.measureId}>
                  <th scope="row">{report.label}</th>
                  <td className="num">{formatValue(report.value.forecastMape, 'percent')}</td>
                  <td className="num">{formatValue(report.value.baselineMape, 'percent')}</td>
                  <td className={`num ${report.value.beatsBaseline ? 'pos' : 'neg'}`}>
                    {formatValue(report.value.valueAdded, 'percent')}
                  </td>
                  <td>{report.value.baselineName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {cash === null ? (
        <section className="section" aria-label="Weekly cash score unavailable">
          <p className="banner">
            {view.entityId !== 'group'
              ? 'The locked weekly score is held at group scope and is not available in this entity view.'
              : `The seeded weekly actuals exist for ${monthLabel(LATEST_MONTH)}, not ${monthLabel(view.through)}. No July score is relabelled as this historical view.`}
          </p>
        </section>
      ) : (
      <section
        className="section focusable"
        id="section-weekly-score"
        aria-label="Weekly cash score"
      >
        <div className="section-head">
          <h2 className="section-title">The weekly cash forecast, scored</h2>
          <span className="section-note">
            Receipts and payments scored separately, because a late receipt and a late payment
            cancel in a net figure — two errors, one good-looking score. Weeks locked before their
            actuals arrived in {monthLabel(LATEST_MONTH)}; the figures below are seeded, since the
            demo has no future to observe.
          </span>
        </div>
        <div className="pane">
          <table className="grid">
            <tbody>
              <tr>
                <th scope="row">Receipts error</th>
                <td className="num">{formatValue(cash.receiptsMape, 'percent')}</td>
              </tr>
              <tr>
                <th scope="row">Payments error</th>
                <td className="num">{formatValue(cash.paymentsMape, 'percent')}</td>
              </tr>
              <tr>
                <th scope="row">Net error</th>
                <td className="num">{formatValue(cash.netMape, 'percent')}</td>
              </tr>
              <tr className={cash.nettingFlatters ? 'row-warn' : ''}>
                <th scope="row">Would a net figure have flattered this?</th>
                <td className="num">{cash.nettingFlatters ? 'Yes' : 'No'}</td>
              </tr>
              <tr>
                <th scope="row">Weeks scored</th>
                <td className="num">
                  {cash.weeks.length} of {forecast.weeks.length} in the horizon
                </td>
              </tr>
            </tbody>
          </table>
          {cash.nettingFlatters ? (
            <p className="chart-note warn-note">
              The net error is materially better than either side, so a single net figure would have
              reported a forecast that was more accurate than it was.
            </p>
          ) : null}
        </div>
      </section>
      )}

      <section className="section focusable" id="section-scored" aria-label="What is scored">
        <div className="section-head">
          <h2 className="section-title">What is scored, and against what</h2>
          <span className="section-note">
            The versions below are the ones that have made a claim which has since closed. A budget
            is a target rather than a prediction, so it is not scored here — missing it is a
            performance finding, not a forecasting one.
          </span>
        </div>
        <div className="pane">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Status</th>
                <th scope="col">Actuals through</th>
                <th scope="col">Measures scored</th>
              </tr>
            </thead>
            <tbody>
              {(reports[0]?.versions ?? []).map((v) => (
                <tr key={v.id}>
                  <th scope="row">{v.label}</th>
                  <td>{v.status}</td>
                  <td className="mono-cell">{v.actualsThrough}</td>
                  <td className="mono-cell">
                    {SCORED_MEASURES.map((id) => measure(id).label).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
