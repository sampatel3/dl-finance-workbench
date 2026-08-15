import { resolveView } from '@demo-kit/shell';
import { buildYearToGo } from '@kestrel/analysis';
import { closePositionsFor, formatMonthLong } from '@kestrel/model';
import { formatValue } from '@kestrel/measures';

import { Masthead } from '../../../components/Chrome';
import { AccountingStatusBanner } from '../../../components/Figures';
import { FocusOnLoad } from '../../../components/FocusOnLoad';
import { Selectors } from '../../../components/Selectors';
import { accountingStatus } from '../../../lib/close';
import { movement } from '../../../lib/format';
import type { Params } from '../../../lib/world';
import { contextOf, viewOf, world } from '../../../lib/world';

export const dynamic = 'force-dynamic';

const TRAJECTORY_LABEL = {
  ahead: 'Ahead',
  on_track: 'On track',
  behind: 'Behind',
  unavailable: 'Unavailable',
} as const;

function trajectoryClass(trajectory: keyof typeof TRAJECTORY_LABEL): string {
  if (trajectory === 'behind') return 'chip-high';
  if (trajectory === 'ahead') return 'chip-low';
  return 'chip-medium';
}

export default async function YearToGo({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;
  const view = viewOf(params);
  const projection = buildYearToGo({ ctx: contextOf(view) });
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
      <Masthead path="/app/year-to-go" view={view} />
      <Selectors path="/app/year-to-go" view={view} />
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
            <table className="grid">
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
                      <span className="row-note">Owner: {line.owner}</span>
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
                      className={`num ${line.favourableToBudget === null ? '' : line.favourableToBudget ? 'pos' : 'neg'}`}
                    >
                      {movement(line.varianceToBudget, line.varianceUnit)}
                      {line.relativeVarianceToBudget === null ? null : (
                        <span className="cell-sub">
                          {movement(line.relativeVarianceToBudget, 'percent')}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={trajectoryClass(line.trajectory)}>
                        {TRAJECTORY_LABEL[line.trajectory]}
                      </span>
                      <span className="row-note">{line.materiality}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
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
