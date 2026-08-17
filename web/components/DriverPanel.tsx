/**
 * What drove one headline movement: the sentence, then the rows it was written from.
 *
 * The order is the argument. An executive reads the sentence and stops; a controller reads the rows and
 * checks the sentence against them. Putting the prose first and the arithmetic under it means the same
 * panel serves both without either being asked to read the other's half — and the sentence is written
 * from the rows by code, so a reader who does check will always find it consistent.
 *
 * ## The residual is printed, always
 *
 * `contributorsFor` computes each row as its own measurement, so the rows do not add up to the total:
 * intercompany trade is eliminated on consolidation, and not every posting carries a segment. The gap is
 * a labelled row here rather than a footnote, because a reader adding the column up and finding it short
 * concludes the product is broken — and they are right to, if nobody told them.
 *
 * ## What it does not do
 *
 * It does not say "because of X, therefore Y". `becauseOf` names the largest mover and its share; the
 * causal step is the reader's. That distinction is the whole difference between reporting a driver and
 * asserting a cause, and it is the reason this panel is built from a decomposition rather than from a
 * model asked to explain a variance.
 */

import type { Contributors } from '@kestrel/analysis';
import { CONTRIBUTOR_DIMENSION_LABELS } from '@kestrel/analysis';
import { formatValue } from '@kestrel/measures';

import type { Headline } from '../lib/headline';
import { directionClass, movement } from '../lib/format';
import type { View } from '../lib/world';
import { hrefFor } from '../lib/world';

export function DriverPanel({
  headline,
  contributors,
  because,
  view,
}: {
  readonly headline: Headline;
  readonly contributors: Contributors;
  readonly because: string;
  readonly view: View;
}) {
  const where = CONTRIBUTOR_DIMENSION_LABELS[contributors.dimension];
  /* An explore link pre-set to the cut this panel is showing, so "show me the rest" is one click rather
     than a reconstruction. The dimension is in the URL because the panel chose it by heuristic — a
     reader who disagrees should be able to see the other cuts without arguing with the page. */
  const exploreBase = hrefFor('/explore', view);
  const exploreHref =
    `${exploreBase}${exploreBase.includes('?') ? '&' : '?'}` +
    `rows=${contributors.dimension}&cols=measure&measure=${contributors.measureId}`;

  return (
    /* A card, and a plain one. It carries no state class on purpose: it explains a movement that
       has already happened, so it is information rather than something waiting on a person or
       something that was refused. Most cards should look like this. */
    <article className="card-kit driver-panel">
      <header className="driver-head">
        <h3 className="driver-title">
          {headline.label}
          <span className={`driver-move ${directionClass(headline.favourable)}`}>
            {movement(headline.movement, headline.movementUnit)}
          </span>
        </h3>
        <span className="driver-cut">by {where}</span>
      </header>

      <p className="driver-because">{because}</p>

      <table className="grid driver-grid">
        <thead>
          <tr>
            <th scope="col">
              {where.charAt(0).toUpperCase()}
              {where.slice(1)}
            </th>
            <th scope="col" className="num">
              Now
            </th>
            <th scope="col" className="num">
              Movement
            </th>
            <th scope="col" className="num">
              Share
            </th>
            <th scope="col">Owner</th>
          </tr>
        </thead>
        <tbody>
          {contributors.rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td className="num">{formatValue(row.current, contributors.unit)}</td>
              <td className={`num ${directionClass(row.favourable)}`}>
                {movement(row.movement, contributors.movementUnit)}
              </td>
              <td className="num">
                {row.share === null ? '—' : formatValue(row.share, 'percent')}
              </td>
              <td>{row.owner}</td>
            </tr>
          ))}

          {/* Named rather than left as a gap. A reader who adds the column up finds this waiting. */}
          {contributors.residual === null || Math.abs(contributors.residual) < 1 ? null : (
            <tr className="driver-residual">
              <th scope="row">Eliminations and unattributed</th>
              <td className="num">—</td>
              <td className="num">{movement(contributors.residual, contributors.movementUnit)}</td>
              <td className="num">
                {contributors.total === null || contributors.total === 0
                  ? '—'
                  : formatValue(contributors.residual / contributors.total, 'percent')}
              </td>
              <td>Group Financial Controller</td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="chart-note">
        {contributors.note} <a href={exploreHref}>See every {where}</a>
      </p>
    </article>
  );
}
