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
import { directionClass, movement } from '../lib/format';
import type { View } from '../lib/world';
import { hrefForTarget } from '../lib/world';

/** One of the four headline figures, with its comparative and what it is compared against. */
export function HeadlineCard({
  headline,
  href,
}: {
  readonly headline: Headline;
  readonly href?: string;
}) {
  const body = (
    <>
      <span className="card-k">
        {headline.label}
        {headline.draft ? <span className="chip chip-draft">draft</span> : null}
      </span>
      <span className="card-v">{formatValue(headline.value, headline.unit)}</span>
      <span className={`card-d ${directionClass(headline.favourable)}`}>
        {movement(headline.movement, headline.movementUnit)}
        <span className="card-basis"> vs {headline.basis}</span>
      </span>
    </>
  );
  return href === undefined ? (
    <div className="card">{body}</div>
  ) : (
    <a className="card card-link" href={href} title={headline.formula}>
      {body}
    </a>
  );
}

/**
 * A board item.
 *
 * The figures come from the finding's own closed set, so what is rendered here and what the narration
 * was allowed to say are the same list. The action is a link the engine named, not a button this
 * component invented — a surface cannot offer a capability the engine does not express.
 */
export function FindingCard({
  finding,
  view,
}: {
  readonly finding: Finding;
  readonly view: View;
}) {
  return (
    <article className={`finding finding-${finding.priority}`}>
      <header className="finding-head">
        <h3 className="finding-title">{finding.title}</h3>
        <span className={`chip chip-${finding.priority}`}>{finding.priority}</span>
      </header>

      <p className="finding-statement">{finding.statement}</p>

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
 * The completeness banner.
 *
 * Rendered above the figures rather than below them, because it is a statement about every figure on the
 * page. A note at the foot saying the numbers may move is a note nobody reads before reading the numbers.
 */
export function CompletenessBanner({
  closed,
  total,
  openNames,
  note,
}: {
  readonly closed: number;
  readonly total: number;
  readonly openNames: readonly string[];
  readonly note?: string;
}) {
  if (openNames.length === 0) {
    return (
      <p className="banner banner-ok">
        All {total} ledgers closed for this period. Figures are final.
      </p>
    );
  }
  return (
    <p className="banner banner-warn">
      <strong>
        {closed} of {total} ledgers closed.
      </strong>{' '}
      {openNames.join(', ')} {openNames.length === 1 ? 'has' : 'have'} submitted and not closed, so
      these figures are not final. {note ?? ''}
    </p>
  );
}
