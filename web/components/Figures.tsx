/**
 * The small pieces every surface prints: a headline card, a movement, a board item.
 *
 * The one rule holding this file together is that **direction is passed in, never derived**. Every
 * component here takes `favourable` from a comparison rather than looking at the sign of a number,
 * because the sign cannot answer it: a cost that rose is a positive movement and bad news. A component
 * that decided for itself would paint a rising expense in the same green as rising income, on every
 * surface at once.
 *
 * They are all server components. Nothing here has state, and a figure that cannot change does not need
 * a client bundle to render it.
 */

import type { Finding } from '@kestrel/analysis';
import { formatValue } from '@kestrel/measures';

import type { Headline } from '../lib/headline';
import type { AccountingStatus } from '../lib/close';
import { shortDate } from '../lib/close';
import { directionClass, movement } from '../lib/format';
import type { View } from '../lib/world';
import { hrefForTarget } from '../lib/world';

/** One of the four headline figures, with its comparative and what it is compared against. */
export function HeadlineCard({
  headline,
  analyseHref,
  evidenceHref,
}: {
  readonly headline: Headline;
  readonly analyseHref?: string;
  readonly evidenceHref?: string;
}) {
  return (
    <article className="card headline-card" title={headline.formula}>
      <span className="card-k">
        {headline.label}
        {headline.draft ? <span className="chip chip-draft">draft</span> : null}
        {headline.material ? (
          <span className="chip chip-material" title={headline.materialityReason}>
            material
          </span>
        ) : null}
      </span>
      <span className="card-v">{formatValue(headline.value, headline.unit)}</span>
      <span className={`card-d ${directionClass(headline.favourable)}`}>
        {movement(headline.movement, headline.movementUnit)}
        <span className="card-basis"> vs {headline.basis}</span>
      </span>
      {analyseHref === undefined && evidenceHref === undefined ? null : (
        <span className="card-actions" aria-label={`${headline.label} actions`}>
          {analyseHref === undefined ? null : <a href={analyseHref}>Analyse</a>}
          {evidenceHref === undefined ? null : <a href={evidenceHref}>Evidence</a>}
        </span>
      )}
    </article>
  );
}

/**
 * A board item.
 *
 * The figures come from the finding's own closed set, so what is rendered here and what the narration
 * was allowed to say are the same list. The action is a link the engine named, not a button this
 * component invented — a surface cannot offer a capability the engine does not express.
 */
export function FindingCard({ finding, view }: { readonly finding: Finding; readonly view: View }) {
  /* The five the review asked for — *finding, driver, £ impact, owner, next action* — as five labelled
     rows rather than a paragraph a reader has to mine. The statement stays, because a sentence carries
     the qualification a table cannot, but it is no longer the only place the driver appears.

     `driver` and `impact` are optional on a Finding. A rule with no single driver — a reconciliation
     break has two sides and no driver — prints nothing there rather than a plausible guess, which is why
     these are rendered conditionally instead of being filled with the first figure in the set. */
  const impact = finding.impact;
  return (
    <article className={`finding finding-${finding.priority}`}>
      <header className="finding-head">
        <h3 className="finding-title">{finding.title}</h3>
        <span className={`chip chip-${finding.priority}`}>{finding.priority}</span>
      </header>

      <p className="finding-statement">{finding.statement}</p>

      <dl className="decision-row">
        {finding.driver === undefined ? null : (
          <div className="decision-cell">
            <dt>Driver</dt>
            <dd>{finding.driver}</dd>
          </div>
        )}
        {impact === undefined ? null : (
          <div className="decision-cell">
            <dt>{impact.label}</dt>
            <dd className={`decision-impact ${directionClass(finding.direction === 'favourable')}`}>
              {formatValue(impact.value, impact.unit)}
            </dd>
          </div>
        )}
        <div className="decision-cell">
          <dt>Owner</dt>
          <dd>{finding.action.owner}</dd>
        </div>
      </dl>

      <dl className="finding-figures">
        {finding.figures.slice(0, 4).map((figure) => (
          <div key={figure.label} className="finding-figure">
            <dt>{figure.label}</dt>
            <dd>{formatValue(figure.value, figure.unit)}</dd>
          </div>
        ))}
      </dl>

      {finding.caveat === undefined ? null : <p className="finding-caveat">{finding.caveat}</p>}

      <footer className="finding-foot">
        <a className="finding-action" href={hrefForTarget(finding.action.href, view)}>
          {finding.action.label}
        </a>
        <span className="finding-owner">{finding.action.owner}</span>
      </footer>

      {finding.materiality === undefined ? null : (
        <p className="finding-materiality">Cleared materiality: {finding.materiality}</p>
      )}
    </article>
  );
}

/**
 * A board: four of these are the surface.
 *
 * An empty board prints its own note rather than collapsing. A panel that vanishes when it has nothing
 * to say leaves a reader unable to tell "nothing to report" from "not implemented", and on the healthy
 * twin all four are empty — which is a state the product has to render honestly, not hide.
 */
export function BoardPanel({
  title,
  question,
  findings,
  view,
  emptyNote,
  note,
}: {
  readonly title: string;
  readonly question: string;
  readonly findings: readonly Finding[];
  readonly view: View;
  readonly emptyNote: string;
  readonly note?: string;
}) {
  return (
    <section className="board">
      <header className="board-head">
        <h2 className="board-title">{title}</h2>
        <p className="board-question">{question}</p>
      </header>
      {findings.length === 0 ? (
        <p className="board-empty">{emptyNote}</p>
      ) : (
        <div className="board-items">
          {findings.map((finding) => (
            <FindingCard key={finding.fingerprint} finding={finding} view={view} />
          ))}
        </div>
      )}
      {note === undefined || findings.length === 0 ? null : <p className="board-note">{note}</p>}
    </section>
  );
}

/**
 * Accounting status.
 *
 * Rendered above the figures rather than below them, because it is a statement about every figure on the
 * page. A note at the foot saying the numbers may move is a note nobody reads before reading the numbers.
 *
 * It was "4/5 ledgers closed" and a sentence. The review's point was that this is a **control**, not a
 * system message, and a control names the thing, the owner and the date. So the outstanding ledgers are a
 * table: a reader scanning for whose it is should not have to read a paragraph to find a name, and a date
 * buried in prose is a date nobody schedules against.
 */
export function AccountingStatusBanner({
  status,
  detailHref,
}: {
  readonly status: AccountingStatus;
  /** Where the full close position lives, so the banner is a route rather than a dead end. */
  readonly detailHref?: string;
}) {
  return (
    <section
      className={`status-banner status-${status.grade}`}
      aria-label="Accounting status"
      role={status.grade === 'at_risk' ? 'alert' : 'status'}
    >
      <p className="status-line">
        <span className="status-mark">Accounting status</span>
        <strong>{status.summary}</strong> {status.consequence}
      </p>

      {status.outstanding.length === 0 ? null : (
        <table className="status-grid">
          <thead>
            <tr>
              <th scope="col">Outstanding</th>
              <th scope="col">Waiting on</th>
              <th scope="col">Expected</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            {status.outstanding.map((ledger) => (
              <tr key={ledger.entityId}>
                <th scope="row">{ledger.entityName}</th>
                <td>{ledger.owner}</td>
                <td className={ledger.expected === undefined ? 'neg' : ''}>
                  {ledger.expected === undefined ? 'no date committed' : shortDate(ledger.expected)}
                </td>
                <td>{ledger.reason ?? 'Submitted, not closed.'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {detailHref === undefined || status.outstanding.length === 0 ? null : (
        <p className="status-route">
          <a href={detailHref}>Open close readiness</a>
        </p>
      )}
    </section>
  );
}
