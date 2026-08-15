import { resolveView } from '@demo-kit/shell';
import { CONCENTRATION_THRESHOLD, buildCapital } from '@kestrel/analysis';
import { formatValue } from '@kestrel/measures';

import { Masthead } from '../../components/Chrome';
import { FocusOnLoad } from '../../components/FocusOnLoad';
import { Selectors } from '../../components/Selectors';
import { movement } from '../../lib/format';
import type { Params } from '../../lib/world';
import { contextOf, viewOf } from '../../lib/world';

/**
 * Capital projects and procurement.
 *
 * The review adds this section for one reason above the others: *"procurement commitments often create
 * future cash pressure before invoices arrive"*. A committed order has produced no accounting entry —
 * that is exactly what makes it worth a page, because the cash it will consume is invisible in the
 * ledger until the invoice lands, and by then the decision has been taken.
 *
 * So the commitments here are mapped onto the same thirteen weeks the cash surface uses, and the
 * project register is reconciled to the ledger's own capital spend with the residual named. Capital
 * spend assigned to no project is how an asset ends up owned by nobody.
 *
 * Budgets, approvals, owners and forecasts-to-complete are **stated** rather than derived: they are
 * decisions, not arithmetic, and deriving them would be inventing them. Everything computable is
 * computed, and the surface says which is which.
 */

export const dynamic = 'force-dynamic';

const VERDICT_LABEL = {
  within_budget: 'Within budget',
  at_risk: 'At risk',
  over_budget: 'Over budget',
  closed: 'Closed',
} as const;

function verdictClass(verdict: keyof typeof VERDICT_LABEL): string {
  if (verdict === 'over_budget') return 'chip-high';
  if (verdict === 'at_risk') return 'chip-medium';
  return 'chip-low';
}

const STATUS_LABEL = {
  in_flight: 'In flight',
  on_hold: 'On hold',
  complete: 'Complete',
} as const;

export default async function Capital({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;
  const view = viewOf(params);
  const capital = buildCapital(contextOf(view));

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      <Masthead path="/capital" view={view} />
      <Selectors path="/capital" view={view} />

      <section className="section focusable" id="section-capital-story" aria-label="Capital summary">
        <div className="section-head">
          <h2 className="section-title">What is committed, and what it will cost</h2>
          <span className="section-note">
            A purchase order has produced no accounting entry, which is precisely why it belongs on a
            page. The commitment is cash the business has agreed to spend and which appears in no
            ledger until the invoice arrives — and by then the decision has been taken.
          </span>
        </div>
        <p className="narration">{capital.statement}</p>
      </section>

      <section className="section focusable" id="section-projects" aria-label="Capital projects">
        <div className="section-head">
          <h2 className="section-title">Capital projects</h2>
          <span className="section-note">
            The expected total includes the <strong>commitment</strong>, not only the spend. A project
            three-quarters through its budget with an order out for the remaining quarter has no
            headroom, and a report showing spend alone would call it comfortable. Approvals, owners
            and forecasts to complete are stated — they are decisions rather than arithmetic. Every
            variance is computed.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">Owner</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">
                  Approved
                </th>
                <th scope="col" className="num">
                  Spent
                </th>
                <th scope="col" className="num">
                  Committed
                </th>
                <th scope="col" className="num">
                  To complete
                </th>
                <th scope="col" className="num">
                  Expected total
                </th>
                <th scope="col" className="num">
                  Remaining
                </th>
                <th scope="col">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {capital.projects.map((row) => (
                <tr
                  key={row.project.id}
                  className={row.verdict === 'over_budget' ? 'row-warn' : ''}
                >
                  <th scope="row">
                    {row.project.name}
                    <span className="row-note">
                      {row.entityName} · due {row.project.expectedCompleteMonth}
                    </span>
                  </th>
                  <td>{row.project.owner}</td>
                  <td>{STATUS_LABEL[row.project.status]}</td>
                  <td className="num">
                    {formatValue(row.project.approvedBudgetMinor, 'currency')}
                  </td>
                  <td className="num">{formatValue(row.project.spentToDateMinor, 'currency')}</td>
                  <td className="num">{formatValue(row.project.committedMinor, 'currency')}</td>
                  <td className="num muted-cell">
                    {formatValue(row.project.forecastToCompleteMinor, 'currency')}
                  </td>
                  <td className="num">
                    <strong>{formatValue(row.expectedTotalMinor, 'currency')}</strong>
                  </td>
                  <td className={`num ${row.remainingMinor < 0 ? 'neg' : 'pos'}`}>
                    {movement(row.remainingMinor, 'currency')}
                  </td>
                  <td>
                    <span className={verdictClass(row.verdict)}>{VERDICT_LABEL[row.verdict]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="board-items">
          {capital.projects
            .filter((row) => row.verdict === 'over_budget' || row.verdict === 'at_risk')
            .map((row) => (
              <article key={row.project.id} className="finding finding-urgent">
                <header className="finding-head">
                  <h3 className="finding-title">{row.project.name}</h3>
                  <span className="finding-tag is-dated">{VERDICT_LABEL[row.verdict]}</span>
                </header>
                <p className="finding-statement">{row.statement}</p>
                {row.project.note === undefined ? null : (
                  <p className="finding-detail">{row.project.note}</p>
                )}
                <footer className="finding-foot">
                  <span className="finding-owner">
                    {row.project.owner} · approved by {row.project.approvedBy}
                  </span>
                </footer>
              </article>
            ))}
        </div>
      </section>

      <section
        className="section focusable"
        id="section-reconciliation"
        aria-label="Register against the ledger"
      >
        <div className="section-head">
          <h2 className="section-title">The register against the ledger</h2>
          <span className="section-note">
            A project register is a different system from the general ledger, and the difference
            between them is the control a capital accountant runs every month. Compared over the
            fiscal year rather than the month: a register accumulates, and measuring it against one
            month&rsquo;s posting would produce a finding every month, which is the same as having no
            control at all.
          </span>
        </div>
        <div className="pane">
          <table className="grid">
            <tbody>
              <tr>
                <th scope="row">Ledger capital spend, year to date</th>
                <td className="num">
                  {formatValue(capital.reconciliation.ledgerMinor, 'currency')}
                </td>
              </tr>
              <tr>
                <th scope="row">Accounted for by the project register</th>
                <td className="num">
                  {formatValue(capital.reconciliation.registerMinor, 'currency')}
                </td>
              </tr>
              <tr className={Math.abs(capital.reconciliation.residualMinor) > 100_00 ? 'row-warn' : ''}>
                <th scope="row">Assigned to no project</th>
                <td
                  className={`num ${Math.abs(capital.reconciliation.residualMinor) > 100_00 ? 'neg' : ''}`}
                >
                  {movement(capital.reconciliation.residualMinor, 'currency')}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="chart-note">{capital.reconciliation.statement}</p>
        </div>
      </section>

      <section className="section focusable" id="section-suppliers" aria-label="Suppliers">
        <div className="section-head">
          <h2 className="section-title">Where the commitment sits</h2>
          <span className="section-note">
            Concentration is computed over the order book this session may read, because a percentage
            of a book a reader cannot inspect is a number they cannot check. A single supplier above{' '}
            {formatValue(CONCENTRATION_THRESHOLD, 'percent')} of committed spend is the policy
            threshold, and spend with no contract behind it is leakage — the same money, bought
            without a negotiated rate.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Supplier</th>
                <th scope="col">Category</th>
                <th scope="col">Contract</th>
                <th scope="col" className="num">
                  Orders
                </th>
                <th scope="col" className="num">
                  Committed
                </th>
                <th scope="col" className="num">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {capital.suppliers.map((row) => (
                <tr
                  key={row.supplierId}
                  className={row.share > CONCENTRATION_THRESHOLD ? 'row-warn' : ''}
                >
                  <th scope="row">{row.name}</th>
                  <td>{row.category}</td>
                  <td className={row.contracted ? '' : 'neg'}>
                    {row.contracted
                      ? `Contracted to ${row.contractEnds ?? '—'}`
                      : 'No contract in place'}
                  </td>
                  <td className="num">{row.orders}</td>
                  <td className="num">{formatValue(row.committedMinor, 'currency')}</td>
                  <td className={`num ${row.share > CONCENTRATION_THRESHOLD ? 'neg' : ''}`}>
                    {formatValue(row.share, 'percent')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="chart-note">
            {capital.concentration.breach ? (
              <>
                <strong>Concentration above policy.</strong> {capital.concentration.name} holds{' '}
                {formatValue(capital.concentration.share, 'percent')} of the committed book, against a{' '}
                {formatValue(CONCENTRATION_THRESHOLD, 'percent')} threshold. That is a single point of
                failure on delivery and no competitive tension on price.
              </>
            ) : (
              <>
                No supplier holds more than{' '}
                {formatValue(CONCENTRATION_THRESHOLD, 'percent')} of the committed book. The largest
                is {capital.concentration.name} at{' '}
                {formatValue(capital.concentration.share, 'percent')}.
              </>
            )}{' '}
            Leakage — committed spend with no contract behind it — is{' '}
            {formatValue(capital.leakageMinor, 'currency')}, or{' '}
            {formatValue(capital.leakageShare, 'percent')} of the book.
          </p>
        </div>
      </section>

      <section className="section focusable" id="section-upcoming" aria-label="Upcoming payments">
        <div className="section-head">
          <h2 className="section-title">What lands in the next thirteen weeks</h2>
          <span className="section-note">
            The same horizon the cash surface uses, so a commitment shows up before the invoice does
            rather than after. Every one of these is money already agreed; none of it is in the
            ledger.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col" className="num">
                  Week
                </th>
                <th scope="col">Order</th>
                <th scope="col">Supplier</th>
                <th scope="col">What for</th>
                <th scope="col" className="num">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {capital.upcoming.map((payment) => (
                <tr key={payment.order.id}>
                  <td className="num">{payment.week}</td>
                  <th scope="row">{payment.order.id}</th>
                  <td className={payment.contracted ? '' : 'neg'}>{payment.supplierName}</td>
                  <td>{payment.order.description}</td>
                  <td className="num">{formatValue(payment.amountMinor, 'currency')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="chart-note">
            Suppliers shown in red have no contract behind them. The cash surface&rsquo;s weekly line
            carries the ordinary capital run rate; these are the specific orders behind it, with the
            week each is expected to be paid.
          </p>
        </div>
      </section>
    </main>
  );
}
