import { resolveView } from '@demo-kit/shell';
import { buildOutlook } from '@kestrel/analysis';
import { closePositionsFor, formatMonthLong } from '@kestrel/model';
import { POLICY, formatValue } from '@kestrel/measures';

import { Masthead } from '../../components/Chrome';
import { AccountingStatusBanner } from '../../components/Figures';
import { FocusOnLoad } from '../../components/FocusOnLoad';
import { Selectors } from '../../components/Selectors';
import { accountingStatus } from '../../lib/close';
import { directionClass, movement } from '../../lib/format';
import type { Params } from '../../lib/world';
import { contextOf, viewOf, world } from '../../lib/world';

/**
 * Year to Go — where FY26 lands, on three readings that disagree.
 *
 * The review asked this section to *"clearly distinguish run-rate trajectory from approved forecast and
 * management-adjusted outlook"*, and the reason the three sit in one table rather than on three tabs is
 * that the **gap between them is the finding**. An approved forecast above the run rate is a forecast
 * assuming a recovery; a reader who cannot see both numbers at once cannot see that it is doing so.
 *
 * The flags are taken on the management-adjusted column rather than the approved one. Flagging "on
 * track" against a forecast the last three months of actuals contradict is how a status column stops
 * being read.
 */

export const dynamic = 'force-dynamic';

const TRAJECTORY_LABEL = {
  ahead: 'Ahead',
  on_track: 'On track',
  behind: 'Behind',
  unavailable: 'Unavailable',
} as const;

const DIRECTION_LABEL = {
  improving: 'Improving',
  holding: 'Holding',
  deteriorating: 'Deteriorating',
  unavailable: '—',
} as const;

function trajectoryClass(trajectory: keyof typeof TRAJECTORY_LABEL): string {
  if (trajectory === 'behind') return 'chip-high';
  if (trajectory === 'ahead') return 'chip-low';
  return 'chip-medium';
}

/** Direction of travel is favourable, adverse or neither — the same three-state colour as a movement. */
function directionFavourable(direction: keyof typeof DIRECTION_LABEL): boolean | null {
  if (direction === 'improving') return true;
  if (direction === 'deteriorating') return false;
  return null;
}

export default async function YearToGo({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;
  const view = viewOf(params);
  const outlook = buildOutlook(contextOf(view));
  const projection = outlook.projection;
  const status = accountingStatus(
    closePositionsFor(world().closePositions, view.scope.endMonth).filter((position) =>
      view.permission.entityIds.includes(position.entityId),
    ),
  );
  const revenue = projection.lines.find((line) => line.measureId === 'revenue');
  const ebitda = projection.lines.find((line) => line.measureId === 'ebitda');

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      <Masthead path="/year-to-go" view={view} />
      <Selectors path="/year-to-go" view={view} />
      <AccountingStatusBanner status={status} />

      <section
        className="section focusable"
        id="section-landing"
        aria-label="Expected full-year landing"
      >
        <div className="section-head">
          <h2 className="section-title">
            Expected FY{String(projection.fiscalYear).slice(-2)} landing
          </h2>
          <span className="section-note">
            Actuals through {formatMonthLong(projection.through)} plus the approved forecast
            thereafter. The close banner states whether those actuals are final. Flow measures add;
            gross margin is recomputed; cash is rebased from the latest actual closing balance.
          </span>
        </div>

        {!projection.available ? (
          <p className="banner banner-warn" role="status">
            <strong>Expected full-year landing unavailable for this boundary.</strong>{' '}
            {projection.unavailableReason}
          </p>
        ) : revenue === undefined || ebitda === undefined ? null : (
          <p className="narration">
            <strong>
              Revenue is expected to land {formatValue(revenue.expectedFullYear, 'currency')},{' '}
              {movement(revenue.varianceToBudget, 'currency')} to budget.
            </strong>{' '}
            EBITDA is expected at {formatValue(ebitda.expectedFullYear, 'currency')},{' '}
            {movement(ebitda.varianceToBudget, 'currency')} to budget. The gap between those two
            trajectories is the profitability decision, not a rounding difference.
          </p>
        )}

        {projection.available ? (
          <div className="pane pane-scroll">
            <table className="grid grid-wide">
              <caption>
                Actual performance, remaining forecast and expected fiscal-year landing
              </caption>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col" className="num">
                    Actual YTD / at close
                  </th>
                  <th scope="col" className="num">
                    Remaining forecast
                  </th>
                  <th scope="col" className="num">
                    Expected FY
                  </th>
                  <th scope="col" className="num">
                    FY budget
                  </th>
                  <th scope="col" className="num">
                    Approved forecast
                  </th>
                  <th scope="col" className="num">
                    Prior year
                  </th>
                  <th scope="col" className="num">
                    Variance to budget
                  </th>
                  <th scope="col">Trajectory</th>
                </tr>
              </thead>
              <tbody>
                {projection.lines.map((line) => (
                  <tr
                    key={line.measureId}
                    className={line.trajectory === 'behind' ? 'row-warn' : ''}
                  >
                    <th scope="row">
                      {line.label}
                      <span className="row-owner">{line.owner}</span>
                    </th>
                    <td className="num">
                      {formatValue(line.actualYtd, line.unit)}
                      {line.measureId === 'cash' ? (
                        <span className="cell-sub">closing balance</span>
                      ) : null}
                    </td>
                    <td className="num">
                      {line.remainingKind === 'balance_movement'
                        ? movement(line.remainingForecast, line.unit)
                        : formatValue(line.remainingForecast, line.unit)}
                      {line.remainingKind === 'balance_movement' ? (
                        <span className="cell-sub">forecast movement</span>
                      ) : null}
                    </td>
                    <td className="num">
                      <strong>{formatValue(line.expectedFullYear, line.unit)}</strong>
                    </td>
                    <td className="num">{formatValue(line.fullYearBudget, line.unit)}</td>
                    <td className="num">{formatValue(line.approvedForecastFullYear, line.unit)}</td>
                    <td className="num">{formatValue(line.priorYearFullYear, line.unit)}</td>
                    <td
                      className={`num col-divide ${line.favourableToBudget === null ? '' : line.favourableToBudget ? 'pos' : 'neg'}`}
                    >
                      {movement(line.varianceToBudget, line.varianceUnit)}
                      {line.relativeVarianceToBudget === null ? null : (
                        <span className="cell-sub">
                          {movement(line.relativeVarianceToBudget, 'percent')}
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={trajectoryClass(line.trajectory)}
                        title={line.materiality}
                      >
                        {TRAJECTORY_LABEL[line.trajectory]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* The materiality test, once. It used to sit under every flag, five near-identical
                sentences that doubled the height of every row and told a reader the same thing
                each time. The per-row wording is still there on the flag's tooltip, where it
                answers the question a reader actually has — "why this verdict on this line". */}
            <p className="chart-note">
              A landing is flagged against {projection.budget.label} only where the gap clears
              both a money floor and a share of the comparative —{' '}
              {formatValue(POLICY.thresholds.pl.absoluteMinor, 'currency')} and{' '}
              {formatValue(POLICY.thresholds.pl.relative, 'percent')} on profit-and-loss measures,{' '}
              {formatValue(POLICY.thresholds.cf.absoluteMinor, 'currency')} and{' '}
              {formatValue(POLICY.thresholds.cf.relative, 'percent')} on cash. Either test alone
              fails: relative-only makes every small account scream, absolute-only hides a large
              miss on a small line. The per-line wording is on each flag.
            </p>
          </div>
        ) : null}
      </section>

      {outlook.available ? (
        <section className="section focusable" id="section-outlooks" aria-label="Three outlooks">
          <div className="section-head">
            <h2 className="section-title">Three readings of the same year</h2>
            <span className="section-note">
              <strong>Run rate</strong> is where the year lands if the business keeps doing what it
              has done for {outlook.monthsElapsed} months — no plan in it at all.{' '}
              <strong>Approved</strong> is actuals plus {projection.approvedForecast.label}, the only
              one that ties to a version somebody signed. <strong>Management-adjusted</strong> is
              that forecast carried at a bias where a measure has missed the same way three months
              running, and equal to it where nothing is persistent. The gap between the first two is
              the recovery the plan is assuming.
            </span>
          </div>
          <div className="pane pane-scroll">
            <table className="grid grid-wide">
              <caption>
                Run-rate, approved and management-adjusted landings, with the flag taken on the
                management-adjusted column
              </caption>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col" className="num">
                    Run rate
                  </th>
                  <th scope="col" className="num">
                    Approved
                  </th>
                  <th scope="col" className="num">
                    Management-adjusted
                  </th>
                  <th scope="col" className="num">
                    Budget
                  </th>
                  <th scope="col" className="num col-divide">
                    Gap to budget
                  </th>
                  <th scope="col">Flag</th>
                  <th scope="col">Direction of travel</th>
                </tr>
              </thead>
              <tbody>
                {outlook.lines.map((line) => (
                  <tr key={line.measureId} className={line.trajectory === 'behind' ? 'row-warn' : ''}>
                    <th scope="row">
                      {line.label}
                      {/* The direction of the bias, not just its size: "carried at a 3.9% bias" leaves
                          a reader to work out from two other columns whether that is a haircut or an
                          uplift, which is the one thing the note exists to save them. */}
                      <span className="row-note">
                        {line.persistence.persistent
                          ? `Remaining months carried ${formatValue(Math.abs(line.persistence.bias), 'percent')} ` +
                            `${line.persistence.bias < 0 ? 'below' : 'above'} the forecast`
                          : 'No persistent bias — carried unadjusted'}
                      </span>
                    </th>
                    <td className="num muted-cell">{formatValue(line.runRate, line.unit)}</td>
                    <td className="num">{formatValue(line.approved, line.unit)}</td>
                    <td className="num">
                      <strong>{formatValue(line.management, line.unit)}</strong>
                    </td>
                    <td className="num muted-cell">{formatValue(line.budget, line.unit)}</td>
                    <td className={`num col-divide ${directionClass(line.favourable)}`}>
                      {movement(line.gapToBudget, line.gapUnit)}
                    </td>
                    <td>
                      <span className={trajectoryClass(line.trajectory)}>
                        {TRAJECTORY_LABEL[line.trajectory]}
                      </span>
                    </td>
                    <td className={directionClass(directionFavourable(line.direction))}>
                      {DIRECTION_LABEL[line.direction]}
                      <span className="row-note">{line.directionNote}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="chart-note">
              A real management overlay is a person&rsquo;s judgement — the chief financial officer
              believes the Q4 award lands, or does not. This product will not invent one, because a
              fabricated executive opinion presented as an outlook is the only figure on this page
              nobody could check. What it does instead is stated above the column and in the note on
              each row.
            </p>
          </div>
        </section>
      ) : null}

      {outlook.risks.length === 0 ? null : (
        <section className="section focusable" id="section-risks" aria-label="Risks to the landing">
          <div className="section-head">
            <h2 className="section-title">What could move the landing</h2>
            <span className="section-note">
              Taken from where the approved plan and the run rate disagree rather than from a list
              somebody typed. A plan above the run rate is assuming a recovery; a plan below it is
              assuming a fade. Either way the difference is what is at stake, and it is already in
              the table above. Money exposures are ranked first and rates after them — basis points
              and pounds are not the same kind of thing, and ordering them together by size would put
              every money figure above every rate whatever it was worth. The second line on each card
              answers a different question — the largest single gap to budget for the year, which is
              where a recovery would have to come from. It is not a sizing of the exposure above it,
              and the two do not reconcile.
            </span>
          </div>
          <div className="board-items">
            {outlook.risks.map((risk) => (
              <article
                key={risk.measureId}
                className={`finding${risk.kind === 'risk' ? ' finding-urgent' : ''}`}
              >
                <header className="finding-head">
                  <h3 className="finding-title">
                    {risk.label} · {formatValue(risk.exposure, risk.unit)}
                  </h3>
                  <span className={`finding-tag${risk.kind === 'risk' ? ' is-dated' : ''}`}>
                    {risk.kind === 'risk' ? 'Risk' : 'Opportunity'}
                  </span>
                </header>
                <p className="finding-statement">{risk.statement}</p>
                {risk.recoveryFrom === undefined ? null : (
                  <p className="finding-detail">{risk.recoveryFrom}</p>
                )}
                <footer className="finding-foot">
                  <span className="finding-owner">{risk.owner}</span>
                </footer>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="section focusable" id="section-actions" aria-label="Closing the gap">
        <div className="section-head">
          <h2 className="section-title">Actions to close the gap</h2>
          <span className="section-note">
            From the same decision policy the Scenarios surface runs, on the year&rsquo;s gap instead
            of a scenario&rsquo;s. A product that recommends a cost action on one page and stays
            silent on the same-sized gap on another has two opinions rather than a policy.
          </span>
        </div>
        {outlook.actions.length === 0 ? (
          <p className="narration">{outlook.noActionBecause}</p>
        ) : (
          <div className="board-items">
            {outlook.actions.map((action) => (
              <article key={action.id} className="finding">
                <header className="finding-head">
                  <h3 className="finding-title">{action.label}</h3>
                </header>
                <p className="finding-statement">{action.because}.</p>
                <p className="finding-when">
                  <span className="finding-when-key">By</span> {action.by}
                </p>
                <footer className="finding-foot">
                  <span className="finding-owner">{action.owner}</span>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section focusable" id="section-basis" aria-label="Year-to-go basis">
        <div className="section-head">
          <h2 className="section-title">Basis and cut-off</h2>
          <span className="section-note">
            The selected draft cannot replace the approved outlook on this page.
          </span>
        </div>
        <div className="pane">
          <dl className="finding-figures">
            <div className="finding-figure">
              <dt>Approved forecast</dt>
              <dd>
                {projection.approvedForecast.label} · {projection.approvedForecast.status}
              </dd>
            </div>
            <div className="finding-figure">
              <dt>Selected actuals through</dt>
              <dd>{formatMonthLong(projection.through)}</dd>
            </div>
            <div className="finding-figure">
              <dt>{projection.approvedForecast.label} actuals through</dt>
              <dd>{formatMonthLong(projection.actualsCutoff)}</dd>
            </div>
            <div className="finding-figure">
              <dt>Remaining period</dt>
              <dd>{projection.remainingScope?.label ?? 'None'}</dd>
            </div>
            <div className="finding-figure">
              <dt>Budget</dt>
              <dd>
                {projection.budget.label} · {projection.budget.status}
              </dd>
            </div>
          </dl>
          <p className="chart-note">
            <strong>Cash basis:</strong> {projection.basis.cash}. This avoids summing monthly
            closing balances or presenting an unre-based forecast as the latest outlook.
          </p>
        </div>
      </section>
    </main>
  );
}
