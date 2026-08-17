import { resolveView } from '@demo-kit/shell';
import { entity, tradingEntities } from '@kestrel/model';
import { computeMeasure, formatValue } from '@kestrel/measures';
import {
  MINIMUM_CASH,
  PAYMENT_TERMS_DAYS,
  ageingFor,
  cashSensitivity,
  directForecast,
  explainBreaches,
  fundingPlan,
  indirectBridge,
} from '@kestrel/analysis';

import { CashColumns } from '../../../components/CashColumns';
import { Masthead } from '../../../components/Chrome';
import { FocusOnLoad } from '../../../components/FocusOnLoad';
import { Selectors } from '../../../components/Selectors';
import { movement } from '../../../lib/format';
import type { Params } from '../../../lib/world';
import { contextForEntity, contextOf, selectableEntities, viewOf } from '../../../lib/world';

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
  const breachClosing =
    forecast.breach === undefined
      ? null
      : (forecast.weeks[forecast.breach.index - 1]?.closing ?? null);
  const recovery =
    forecast.breach === undefined
      ? undefined
      : forecast.weeks.slice(forecast.breach.index).find((week) => !week.belowFloor);
  const bridge = indirectBridge(ctx);
  const sensitivity = cashSensitivity(ctx, SENSITIVITY);

  /* Why each red week is red, and whether it is a date or a problem. See `explainBreaches`: the test is
     recovery rather than which stream is largest, because an ordinary supplier run can put a week under
     and still be timing. */
  const breaches = explainBreaches(forecast);

  /* Where the money could come from, and whether it arrives before the week needs it. Only the entities
     this session can read, so a business-unit controller does not get a list of its siblings' balances. */
  const funding =
    forecast.breach === undefined
      ? null
      : fundingPlan(ctx, forecast.breach.shortfall, forecast.breach.index);

  const ageing = selectableEntities(view.principal).map((e) => ageingFor(ctx, e.id));

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      <Masthead path="/cash" view={view} />
      <Selectors path="/cash" view={view} />

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
              Week {forecast.breach.index} closes at {formatValue(breachClosing, 'currency')}
            </strong>
            , {formatValue(forecast.breach.shortfall, 'currency')} under the{' '}
            {formatValue(MINIMUM_CASH.amountMinor, 'currency')} floor set in {MINIMUM_CASH.owner}.
            Its low point is {formatValue(forecast.low.amount, 'currency')} in week{' '}
            {forecast.low.index}.{' '}
            {recovery === undefined
              ? 'It does not recover inside the forecast horizon.'
              : `It recovers above the floor in week ${recovery.index}.`}{' '}
            {recovery === undefined
              ? 'This needs a funding decision beyond the visible horizon.'
              : 'This is a week to fund rather than a solvency question — the dividend and a supplier run land together.'}
          </p>
        )}
      </section>

      {breaches.length === 0 ? null : (
        <section
          className="section focusable"
          id="section-why-red"
          aria-label="Why the red weeks are red"
        >
          <div className="section-head">
            <h2 className="section-title">Why cash goes red, and whether it matters</h2>
            <span className="section-note">
              Each week below the floor, with what put it there and whether the balance comes back.
              Timing is funded; structural is fixed — and the two demand different work, so the
              product decides which it is rather than colouring both amber.
            </span>
          </div>
          {/* A summary first, then the streams behind each week on demand.
              Five red weeks each with a full table is a wall, and a reader looking for "which week and
              why" has to read four tables to find the one they came for. The summary answers that in one
              pass; the breakdown is one click away and stays available for the week they open. */}
          <div className="pane">
            <table className="grid">
              <thead>
                <tr>
                  <th scope="col">Week</th>
                  <th scope="col" className="num">
                    Closes at
                  </th>
                  <th scope="col" className="num">
                    Under the floor
                  </th>
                  <th scope="col">Nature</th>
                  <th scope="col">What put it there</th>
                </tr>
              </thead>
              <tbody>
                {breaches.map((breach) => (
                  <tr
                    key={breach.index}
                    className={breach.nature === 'structural' ? 'row-warn' : ''}
                  >
                    <th scope="row">Week {breach.index}</th>
                    <td className="num">
                      {formatValue(forecast.weeks[breach.index - 1]?.closing ?? null, 'currency')}
                    </td>
                    <td className="num neg">{formatValue(breach.shortfall, 'currency')}</td>
                    <td className={breach.nature === 'timing' ? '' : 'neg'}>
                      {breach.nature === 'timing'
                        ? `timing — back by week ${breach.recoversAtWeek}`
                        : 'structural'}
                    </td>
                    <td>
                      {breach.drivers[0]?.label ?? 'the run rate'}
                      {breach.drivers[0] === undefined ? '' : ` · ${breach.drivers[0].owner}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="chart-note">
              <strong>Timing</strong> means the balance recovers inside the horizon, so the week is
              funded. <strong>Structural</strong> means it does not, and funding it moves the date
              rather than the problem. The test is recovery, not which payment is largest — an
              ordinary supplier run can put a week under and the balance come straight back.
            </p>
          </div>

          {breaches.map((breach) => (
            <details className="pane evidence" key={breach.index}>
              <summary>
                Week {breach.index} · {formatValue(breach.shortfall, 'currency')} under the floor ·{' '}
                what it is made of
              </summary>
              <p className="narration">
                <strong>{breach.statement}</strong>
              </p>
              <table className="grid">
                <thead>
                  <tr>
                    <th scope="col">Stream</th>
                    <th scope="col" className="num">
                      Amount
                    </th>
                    <th scope="col">Runs</th>
                    <th scope="col">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {(forecast.weeks[breach.index - 1]?.components ?? []).map((component) => (
                    <tr key={component.key} className={component.lumpy ? 'row-warn' : ''}>
                      <th scope="row">{component.label}</th>
                      <td className={`num ${component.amount < 0 ? 'neg' : 'pos'}`}>
                        {movement(component.amount, 'currency')}
                      </td>
                      <td>{component.lumpy ? 'this week only' : 'every week'}</td>
                      <td>{component.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="chart-note">
                The streams sum to the week&rsquo;s net movement exactly. A stream marked{' '}
                <em>this week only</em> is an event with a date somebody chose; the rest is the run
                rate, and a breach the run rate explains is not one a transfer solves.
              </p>
            </details>
          ))}
        </section>
      )}

      {funding === null ? null : (
        <section
          className="section focusable"
          id="section-funding"
          aria-label="Intercompany funding"
        >
          <div className="section-head">
            <h2 className="section-title">Can we move cash in time, and who approves it?</h2>
            <span className="section-note">
              Availability is the balance less each entity&rsquo;s operating buffer — an entity
              cannot send what it needs for its own payroll. What decides is lead time: an approval,
              a banking cut-off and a currency conversion take as long as they take, so what the
              panel reports is the <em>decision date</em> — the week each request has to be raised
              by. A column that only said &ldquo;yes, it fits&rdquo; would say yes to everything
              eight weeks out and be worth nothing.
            </span>
          </div>
          <div className="pane">
            <p className={`narration ${funding.covered ? '' : 'warn-note'}`}>
              <strong>{funding.statement}</strong>
            </p>
            <table className="grid">
              <thead>
                <tr>
                  <th scope="col">Entity</th>
                  <th scope="col" className="num">
                    Cash
                  </th>
                  <th scope="col" className="num">
                    Buffer
                  </th>
                  <th scope="col" className="num">
                    Could send
                  </th>
                  <th scope="col" className="num">
                    Notice
                  </th>
                  <th scope="col" className="num">
                    Request by
                  </th>
                  <th scope="col">Approval and constraints</th>
                </tr>
              </thead>
              <tbody>
                {funding.options.map((option) => (
                  <tr key={option.entityId} className={option.arrivesInTime ? '' : 'row-warn'}>
                    <th scope="row">{option.entityName}</th>
                    <td className="num">{formatValue(option.cash, 'currency')}</td>
                    <td className="num muted-cell">
                      {formatValue(option.bufferMinor, 'currency')}
                    </td>
                    <td className="num strong-cell">{formatValue(option.available, 'currency')}</td>
                    <td className="num">{option.leadTimeDays}d</td>
                    <td className={`num ${option.startByWeek === null ? 'neg' : ''}`}>
                      {option.blocked !== undefined
                        ? 'blocked'
                        : option.arrivesInTime
                          ? `week ${option.startByWeek}`
                          : 'too slow'}
                    </td>
                    <td>
                      {option.approver}. {option.blocked ?? option.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="chart-note">
              Week {funding.week} is {funding.daysAvailable} working days out.{' '}
              {formatValue(funding.reachableMinor, 'currency')} can arrive in time against a
              shortfall of {formatValue(funding.needMinor, 'currency')}. Constraints are modelled —
              this demo moves no money and dials no bank — but the shape is the one that decides:
              approver, notice period, cut-off, and a reason a transfer may be refused outright.
            </p>
          </div>
        </section>
      )}

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

      <section className="section focusable" id="section-ageing" aria-label="Receivables ageing">
        <div className="section-head">
          <h2 className="section-title">What is owed, and how long it has been owed</h2>
          <span className="section-note">
            Collections are the largest single receipt line in the forecast above, so the state of
            the book is what the forecast rests on. Terms are {PAYMENT_TERMS_DAYS} days; anything
            past that is money somebody can be asked for today.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Entity</th>
                <th scope="col" className="num">
                  Receivables
                </th>
                <th scope="col" className="num">
                  DSO
                </th>
                {(ageing[0]?.buckets ?? []).map((bucket) => (
                  <th scope="col" className="num" key={bucket.label}>
                    {bucket.label}
                  </th>
                ))}
                <th scope="col" className="num">
                  Overdue
                </th>
              </tr>
            </thead>
            <tbody>
              {ageing.map((book) => (
                <tr key={book.entityId} className={book.overdueShare > 0.5 ? 'row-warn' : ''}>
                  <th scope="row">{book.entityName}</th>
                  <td className="num">{formatValue(book.receivables, 'currency')}</td>
                  <td className="num">{formatValue(book.dso, 'days')}</td>
                  {book.buckets.map((bucket) => (
                    <td className={`num ${bucket.overdue ? 'muted-cell' : ''}`} key={bucket.label}>
                      {formatValue(bucket.amount, 'currency')}
                    </td>
                  ))}
                  <td className={`num ${book.overdueShare > 0.5 ? 'neg' : ''}`}>
                    {formatValue(book.overdueMinor, 'currency')} ·{' '}
                    {formatValue(book.overdueShare, 'percent')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="chart-note">
            The buckets are <strong>derived</strong> from each book&rsquo;s balance and its
            collection period, and they sum to the receivables figure exactly — so the ageing ties
            to the balance sheet rather than sitting beside it. The shape is modelled, and the model
            is stated: the profile follows an invoice&rsquo;s survival curve, so it decays from
            Current and the collection period is its <em>mean</em> age rather than its peak bucket.
            A book collecting at 77 days therefore carries more of itself past terms than one at 60,
            while the Current bucket stays close to a month&rsquo;s billing at either. The totals are
            governed; the distribution is not, and that is said here rather than implied.
          </p>
        </div>
      </section>

      <section className="section focusable" id="section-wc" aria-label="Working capital by entity">
        <div className="section-head">
          <h2 className="section-title">Which entity is holding the cash</h2>
          <span className="section-note">
            Collection, payment and inventory days for the entities available in the selected
            organisational scope, each computed independently at that entity&rsquo;s own level.
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
              {tradingEntities()
                .filter((e) => view.permission.entityIds.includes(e.id))
                .map((e) => {
                  const inner = contextForEntity(view, e.id);
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
