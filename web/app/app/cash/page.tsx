import { FocusOnLoad, resolveView } from '@demo-kit/shell';
import { entity, tradingEntities } from '@kestrel/model';
import { computeMeasure, formatValue } from '@kestrel/measures';
import { MINIMUM_CASH, cashSensitivity, directForecast, indirectBridge } from '@kestrel/analysis';

import { CashColumns } from '../../../components/CashColumns';
import { Masthead } from '../../../components/Chrome';
import { Selectors } from '../../../components/Selectors';
import { movement } from '../../../lib/format';
import type { Params } from '../../../lib/world';
import { contextOf, viewOf } from '../../../lib/world';

/**
 * Cash — the surface a treasurer reads.
 *
 * Three things, and the order is the argument: where cash goes in the next thirteen weeks, how profit
 * became that cash, and which entity's working capital is holding it.
 *
 * The floor is drawn across the forecast and the breach week is named, because a forecast that dips
 * below a board minute and does not say so is a forecast whose only useful output has been left out. It
 * recovers inside the horizon, which is what makes it a week to fund rather than a solvency question —
 * and stating that is the difference between a risk and an alarm.
 */

export const dynamic = 'force-dynamic';

/** How large a revenue fall the sensitivity models. Stated, because a scenario with no stated size is a mood. */
const SENSITIVITY = -0.08;

export default async function Cash({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;

  const view = viewOf(params);
  const ctx = contextOf(view);

  const forecast = directForecast(ctx);
  const bridge = indirectBridge(ctx);
  const sensitivity = cashSensitivity(ctx, SENSITIVITY);

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      {inner ? null : <Masthead path="/app/cash" view={view} />}
      <Selectors path="/app/cash" view={view} />

      <section
        className="section focusable"
        id="section-weekly"
        aria-label="Thirteen-week forecast"
      >
        <div className="section-head">
          <h2 className="section-title">Thirteen weeks of cash</h2>
          <span className="section-note">
            Receipts and payments as opposed columns rather than one net figure, because a week that
            nets to zero because £2m arrived and £2m left is not a quiet week. Opening balance{' '}
            {formatValue(forecast.opening, 'currency')}.
          </span>
        </div>
        <div className="pane">
          <CashColumns forecast={forecast} />
        </div>
        {forecast.breach === undefined ? (
          <p className="narration">
            The forecast holds above the {formatValue(MINIMUM_CASH.amountMinor, 'currency')} floor
            in every week of the horizon.
          </p>
        ) : (
          <p className="narration">
            <strong>
              Week {forecast.breach.index} closes at {formatValue(forecast.low.amount, 'currency')}
            </strong>
            , {formatValue(forecast.breach.shortfall, 'currency')} under the{' '}
            {formatValue(MINIMUM_CASH.amountMinor, 'currency')} floor set in {MINIMUM_CASH.owner}.
            It recovers by the end of the horizon, so this is a week to fund rather than a solvency
            question — the dividend and a supplier run land together.
          </p>
        )}
      </section>

      <section className="section focusable" id="section-weeks" aria-label="Week by week">
        <div className="section-head">
          <h2 className="section-title">Week by week</h2>
          <span className="section-note">
            Each week is locked before its actuals arrive, so weekly variance is scoreable — and
            scored on receipts and payments separately.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Week</th>
                <th scope="col" className="num">
                  Receipts
                </th>
                <th scope="col" className="num">
                  Payments
                </th>
                <th scope="col" className="num">
                  Net
                </th>
                <th scope="col" className="num">
                  Closing
                </th>
                <th scope="col">Against the floor</th>
              </tr>
            </thead>
            <tbody>
              {forecast.weeks.map((week) => {
                const under = week.closing < MINIMUM_CASH.amountMinor;
                return (
                  <tr key={week.week} className={under ? 'row-warn' : ''}>
                    <th scope="row">{week.index}</th>
                    <td className="num pos">{formatValue(week.receipts, 'currency')}</td>
                    <td className="num neg">{formatValue(week.payments, 'currency')}</td>
                    <td className={`num ${week.net < 0 ? 'neg' : 'pos'}`}>
                      {movement(week.net, 'currency')}
                    </td>
                    <td className="num">{formatValue(week.closing, 'currency')}</td>
                    <td className={under ? 'neg' : ''}>
                      {under
                        ? `${formatValue(MINIMUM_CASH.amountMinor - week.closing, 'currency')} under`
                        : `${formatValue(week.closing - MINIMUM_CASH.amountMinor, 'currency')} of headroom`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section focusable" id="section-indirect" aria-label="Profit to cash">
        <div className="section-head">
          <h2 className="section-title">How profit became cash</h2>
          <span className="section-note">
            The path a profit-and-loss scenario travels to reach a cash answer. Without it a revenue
            assumption changes the income statement and nothing else — the gap that makes most
            scenario tools useless to a treasurer.
          </span>
        </div>
        <div className="pane">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Line</th>
                <th scope="col" className="num">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {bridge.lines.map((line) => (
                <tr key={line.kind} className={line.kind === 'other' ? 'muted-cell' : ''}>
                  <th scope="row">{line.label}</th>
                  <td className="num">
                    {line.kind === 'opening' || line.kind === 'closing'
                      ? formatValue(line.value, 'currency')
                      : movement(line.value, 'currency')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={`chart-note ${bridge.sums ? '' : 'warn-note'}`}>
            {bridge.sums
              ? 'Every line sums to the movement in cash exactly.'
              : 'These lines do not sum to the movement in cash, which is reported rather than plugged.'}{' '}
            The residual is named as its own line rather than absorbed into another.
          </p>
        </div>
      </section>

      <section className="section focusable" id="section-sensitivity" aria-label="Sensitivity">
        <div className="section-head">
          <h2 className="section-title">
            What happens to cash if revenue falls {formatValue(Math.abs(SENSITIVITY), 'percent')}
          </h2>
          <span className="section-note">{sensitivity.note}</span>
        </div>
        <div className="pane">
          <table className="grid">
            <tbody>
              <tr>
                <th scope="row">Revenue change</th>
                <td className="num neg">{movement(sensitivity.revenueChange, 'currency')}</td>
              </tr>
              <tr>
                <th scope="row">Margin lost</th>
                <td className="num neg">{movement(sensitivity.marginEffect, 'currency')}</td>
              </tr>
              <tr>
                <th scope="row">Receivable released</th>
                <td className="num pos">
                  {movement(sensitivity.workingCapitalRelease, 'currency')}
                </td>
              </tr>
              <tr>
                <th scope="row">Net effect on cash over {sensitivity.horizonWeeks} weeks</th>
                <td className="num">{movement(sensitivity.netCashEffect, 'currency')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="section focusable" id="section-wc" aria-label="Working capital by entity">
        <div className="section-head">
          <h2 className="section-title">Which entity is holding the cash</h2>
          <span className="section-note">
            Collection, payment and inventory days per entity, each computed at its own level. The
            Gulf entity has the slowest collections in the group, and its horizon collects a smaller
            share of its book than the group&rsquo;s does.
          </span>
        </div>
        <div className="pane">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Entity</th>
                <th scope="col" className="num">
                  Collection days
                </th>
                <th scope="col" className="num">
                  Payment days
                </th>
                <th scope="col" className="num">
                  Inventory days
                </th>
                <th scope="col" className="num">
                  Working capital
                </th>
              </tr>
            </thead>
            <tbody>
              {tradingEntities().map((e) => {
                const inner = { ...ctx, entityIds: [e.id] };
                return (
                  <tr key={e.id}>
                    <th scope="row">{entity(e.id).name}</th>
                    <td className="num">
                      {formatValue(computeMeasure('dso', inner).value, 'days')}
                    </td>
                    <td className="num">
                      {formatValue(computeMeasure('dpo', inner).value, 'days')}
                    </td>
                    <td className="num">
                      {formatValue(computeMeasure('dio', inner).value, 'days')}
                    </td>
                    <td className="num">
                      {formatValue(computeMeasure('working_capital', inner).value, 'currency')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
