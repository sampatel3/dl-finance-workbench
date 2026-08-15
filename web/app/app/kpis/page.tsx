import { resolveView } from '@demo-kit/shell';
import { formatMonthLong } from '@kestrel/model';
import { formatValue } from '@kestrel/measures';

import { Masthead } from '../../../components/Chrome';
import { FocusOnLoad } from '../../../components/FocusOnLoad';
import { Selectors } from '../../../components/Selectors';
import { directionClass, movement } from '../../../lib/format';
import { HORIZON_LABELS, kpisFor, type PriorPeriodDirection } from '../../../lib/kpis';
import type { Params } from '../../../lib/world';
import { contextOf, viewOf } from '../../../lib/world';

export const dynamic = 'force-dynamic';

const MOVEMENT_ARROW: Readonly<Record<PriorPeriodDirection, string>> = {
  up: '↑',
  flat: '→',
  down: '↓',
  unavailable: '—',
};

export default async function Kpis({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;
  const view = viewOf(params);
  const dashboard = kpisFor(contextOf(view));

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      <Masthead path="/app/kpis" view={view} />
      <Selectors path="/app/kpis" view={view} />

      <section className="section focusable" id="section-kpi-summary" aria-label="KPI basis">
        <div className="section-head">
          <h2 className="section-title">Key performance indicators</h2>
          <span className="section-note">
            Actual, governed target, approved forecast, prior year and movement versus the prior
            period in one finance context. No multi-period trend or benchmark is invented: Budget is
            the target already approved in the planning model.
          </span>
        </div>
        <p className="banner banner-ok">
          <strong>{dashboard.budget.label}</strong> is the target.{' '}
          <strong>{dashboard.forecast.label}</strong> is the approved forecast in force, with actuals
          through {formatMonthLong(dashboard.forecast.actualsThrough)}. The final column is a
          one-period movement, not a fitted or multi-period trend.
        </p>
      </section>

      {dashboard.groups.map((group) => (
        <section
          key={group.id}
          className="section focusable"
          id={`section-kpi-${group.id}`}
          aria-label={`${group.label} KPIs`}
        >
          <div className="section-head">
            <h2 className="section-title">
              {group.label}
              {/* Leading, concurrent or lagging — said on the group rather than left to be inferred.
                  A page that mixes the two without saying invites them to be read alike, and the
                  whole argument for non-financial indicators is that they are not alike. */}
              <span className={`horizon-mark horizon-${group.horizon}`}>
                {HORIZON_LABELS[group.horizon]}
              </span>
            </h2>
            <span className="section-note">
              {group.description} {group.horizonNote}
            </span>
          </div>
          <div className="pane pane-scroll">
            <table className="grid">
              <caption>{group.label} KPI scorecard</caption>
              <thead>
                <tr>
                  <th scope="col">KPI</th>
                  <th scope="col" className="num">Actual</th>
                  <th scope="col" className="num">Budget target</th>
                  <th scope="col" className="num">Approved forecast</th>
                  <th scope="col" className="num">Prior year</th>
                  <th scope="col" className="num">Vs prior period</th>
                  <th scope="col">Definition owner</th>
                  <th scope="col">Definition state</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.measureId}>
                    <th scope="row">
                      {row.label}
                      <span className="row-note">{row.formula}</span>
                      {row.note === undefined ? null : <span className="row-note">{row.note}</span>}
                    </th>
                    <td className="num"><strong>{formatValue(row.actual, row.unit)}</strong></td>
                    <td className="num">{formatValue(row.budgetTarget, row.unit)}</td>
                    <td className="num">{formatValue(row.approvedForecast, row.unit)}</td>
                    <td className="num">{formatValue(row.priorYear, row.unit)}</td>
                    <td className={`num ${directionClass(row.priorPeriodFavourable)}`}>
                      <span aria-hidden>{MOVEMENT_ARROW[row.priorPeriodDirection]} </span>
                      {row.priorPeriodMovement === null
                        ? '—'
                        : movement(row.priorPeriodMovement, row.priorPeriodUnit)}
                    </td>
                    <td>{row.definitionOwner}</td>
                    <td>
                      <span className={row.status === 'draft' ? 'chip-medium' : 'chip-low'}>
                        {row.status}
                      </span>
                      {row.status === 'draft' ? (
                        <span className="row-note">
                          Visible for analysis; not treated as an approved finance definition.
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}
