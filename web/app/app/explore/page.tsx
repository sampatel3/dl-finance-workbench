import { FocusOnLoad, resolveView } from '@demo-kit/shell';
import { formatValue, measure } from '@kestrel/measures';
import type { Dimension } from '@kestrel/analysis';
import { DIMENSIONS, DIMENSION_LABELS, buildPivot, drillCell } from '@kestrel/analysis';

import { Masthead } from '../../../components/Chrome';
import { Selectors } from '../../../components/Selectors';
import type { Params } from '../../../lib/world';
import { ALL_MONTHS, contextOf, hrefFor, viewOf } from '../../../lib/world';

/**
 * Explore — the analyst's pivot.
 *
 * The grid is the least interesting part. What this surface is for is the promise underneath it: **a
 * cell agrees with the same measure computed on the front page, and a total is recomputed rather than
 * added.** `packages/analysis/src/pivot.ts` argues that at length; the tests would fail on any
 * implementation that summed its own cells, for two independent reasons.
 *
 * ## The axes are in the URL
 *
 * `?rows=entity,segment&cols=measure,period` is the whole state of this page. So an analyst who builds
 * a view can send it, a tour step can land on it, and there is no arrangement on screen that the address
 * bar does not describe. It is also why the axis pickers are links.
 *
 * ## The drill is a query, not a filter
 *
 * `?drill=<row>:<col>` opens one cell. The panel re-runs the measure one level finer rather than
 * filtering a result set, which is what lets the parts be *measurements* rather than shares — and what
 * makes the intercompany elimination appear as its own line rather than as a gap the reader has to
 * notice.
 */

export const dynamic = 'force-dynamic';

const DEFAULT_MEASURES = [
  'revenue',
  'gross_profit',
  'gross_margin',
  'ebitda',
  'cash',
  'dso',
] as const;

/** Read an axis from the URL: a comma-separated list of dimensions, filtered to the ones that exist. */
function axis(raw: string | string[] | undefined, fallback: readonly Dimension[]): Dimension[] {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (text === undefined) return [...fallback];
  const parsed = text
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is Dimension => DIMENSIONS.includes(part as Dimension));
  return parsed.length === 0 ? [...fallback] : parsed;
}

function axisHref(path: string, params: Params, key: string, value: string): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === 'drill') continue; // a new axis invalidates a cell reference
    const single = Array.isArray(v) ? v[0] : v;
    if (single !== undefined) next.set(k, single);
  }
  next.set(key, value);
  return `${path}?${next.toString()}`;
}

export default async function Explore({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;

  const view = viewOf(params);
  const ctx = contextOf(view);

  const rows = axis(params.rows, ['measure']);
  const columns = axis(params.cols, ['period']);
  const grain =
    (Array.isArray(params.grain) ? params.grain[0] : params.grain) === 'quarter'
      ? ('quarter' as const)
      : ('month' as const);

  /* Six months rather than the whole window: a grid of forty-three columns is a grid nobody reads, and
     an analyst who wants more can change the period grain. */
  const months = ALL_MONTHS.slice(-6);

  const pivot = buildPivot({
    ctx,
    rows,
    columns,
    measureIds: [...DEFAULT_MEASURES],
    months,
    periodGrain: grain,
  });

  /* `?drill=<rowIndex>:<colIndex>`. Indices rather than a key, because a cell's identity is its
     position in the grid the URL already describes — encoding the whole slice again would let the two
     disagree. */
  const drillRaw = Array.isArray(params.drill) ? params.drill[0] : params.drill;
  const [rowRaw, colRaw] = (drillRaw ?? '').split(':');
  const rowIndex = Number(rowRaw);
  const colIndex = Number(colRaw);
  const openCell =
    Number.isInteger(rowIndex) && Number.isInteger(colIndex)
      ? pivot.rows[rowIndex]?.cells[colIndex]
      : undefined;
  const drill = openCell === undefined ? null : drillCell(openCell);

  const drillHref = (r: number, c: number): string =>
    axisHref('/app/explore', params, 'drill', `${r}:${c}`);

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      {inner ? null : <Masthead path="/app/explore" view={view} />}
      <Selectors path="/app/explore" view={view} />

      <section className="section focusable" id="section-axes" aria-label="Axes">
        <div className="section-head">
          <h2 className="section-title">Explore</h2>
          <span className="section-note">
            Any dimension on either axis. The arrangement is in the address, so a view you build is
            a link you can send — and every cell is the measure computed at that cell&rsquo;s slice,
            never a share of the one above it.
          </span>
        </div>

        <div className="selectors">
          <div className="sel-row">
            <span className="sel-label">Down</span>
            <div className="sel-chips">
              {DIMENSIONS.map((d) => (
                <a
                  key={d}
                  className={`chip-link${rows.includes(d) ? ' is-active' : ''}`}
                  href={axisHref('/app/explore', params, 'rows', d)}
                >
                  {DIMENSION_LABELS[d]}
                </a>
              ))}
              <a
                className="chip-link"
                href={axisHref('/app/explore', params, 'rows', 'entity,segment')}
              >
                Entity › Segment
              </a>
            </div>
          </div>
          <div className="sel-row">
            <span className="sel-label">Across</span>
            <div className="sel-chips">
              {DIMENSIONS.map((d) => (
                <a
                  key={d}
                  className={`chip-link${columns.includes(d) ? ' is-active' : ''}`}
                  href={axisHref('/app/explore', params, 'cols', d)}
                >
                  {DIMENSION_LABELS[d]}
                </a>
              ))}
            </div>
          </div>
          <div className="sel-row">
            <span className="sel-label">Grain</span>
            <div className="sel-chips">
              {(['month', 'quarter'] as const).map((g) => (
                <a
                  key={g}
                  className={`chip-link${grain === g ? ' is-active' : ''}`}
                  href={axisHref('/app/explore', params, 'grain', g)}
                >
                  {g === 'month' ? 'Month' : 'Quarter'}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="pane pane-scroll">
          <table className="grid grid-pivot">
            <thead>
              <tr>
                <th scope="col">{rows.map((d) => DIMENSION_LABELS[d]).join(' › ')}</th>
                {pivot.columnPaths.map((path, i) => (
                  <th key={i} scope="col" className="num">
                    {path.map((m) => m.label).join(' · ')}
                  </th>
                ))}
                <th scope="col" className="num">
                  Window
                </th>
              </tr>
            </thead>
            <tbody>
              {pivot.rows.map((row, r) => (
                <tr key={r}>
                  <th scope="row">{row.path.map((m) => m.label).join(' › ')}</th>
                  {row.cells.map((cell, c) => (
                    <td key={c} className="num">
                      <a className="cell-link" href={drillHref(r, c)}>
                        {formatValue(cell.value, cell.unit)}
                      </a>
                    </td>
                  ))}
                  <td className="num total">
                    {row.total === null ? (
                      <span className="cell-none" title={pivot.totalNote}>
                        —
                      </span>
                    ) : (
                      formatValue(row.total.value, row.total.unit)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="chart-note">{pivot.totalNote}</p>
      </section>

      {drill === null || openCell === undefined ? null : (
        <section className="section focusable" id="section-drill" aria-label="Drill">
          <div className="section-head">
            <h2 className="section-title">{measure(openCell.measureId).label}, one level down</h2>
            <span className="section-note">{drill.note}</span>
          </div>

          <div className="pane">
            <table className="grid">
              <caption>
                {formatValue(openCell.value, openCell.unit)} ·{' '}
                {openCell.consolidated ? 'consolidated' : 'combined, not consolidated'}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Level</th>
                  <th scope="col" className="num">
                    Value
                  </th>
                  <th scope="col" className="num">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody>
                {drill.steps.map((step) => (
                  <tr key={`${step.dimension}-${step.key}`}>
                    <th scope="row">{step.label}</th>
                    <td className={`num ${step.key === 'eliminations' ? 'muted-cell' : ''}`}>
                      {formatValue(step.value, step.unit)}
                    </td>
                    <td className="num">
                      {openCell.value === null || openCell.value === 0 || step.value === null
                        ? '—'
                        : formatValue(step.value / openCell.value, 'percent')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={`chart-note ${drill.sums ? '' : 'warn-note'}`}>
              {drill.sums
                ? 'These parts sum to the cell exactly.'
                : 'These parts do not sum to the cell, which is reported rather than hidden.'}
            </p>
          </div>

          <div className="pane">
            <table className="grid">
              <caption>
                Source rows — {drill.rows.length} of them, from{' '}
                {drill.vintageIds.length === 1 ? 'one load' : `${drill.vintageIds.length} loads`}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Month</th>
                  <th scope="col">Segment</th>
                  <th scope="col">Cost centre</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                  <th scope="col">Vintage</th>
                </tr>
              </thead>
              <tbody>
                {/* Capped, and the cap is stated. A drill that silently shows the first forty rows of
                    four hundred is a drill that has stopped being evidence. */}
                {drill.rows.slice(0, 40).map((row, i) => (
                  <tr key={i}>
                    <th scope="row">{row.accountId}</th>
                    <td>{row.month}</td>
                    <td>{row.segmentId ?? '—'}</td>
                    <td>{row.costCentreId ?? '—'}</td>
                    <td className="num">{formatValue(row.amountMinor, 'currency')}</td>
                    <td className="mono-cell">{row.vintageId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {drill.rows.length > 40 ? (
              <p className="chart-note">
                Showing 40 of {drill.rows.length} rows. This is the demo&rsquo;s cap, not the
                data&rsquo;s — and the rows below the cut are the same shape as the ones above.
              </p>
            ) : null}
          </div>

          <p className="chart-note">
            The rows terminate the drill spine. They are seeded and shaped like ledger lines; they
            are not ledger lines, which is the accepted weakness this demo states rather than
            implies. <a href={hrefFor('/app/controls', view)}>Controls</a> holds the lineage.
          </p>
        </section>
      )}

      {drill === null ? (
        <p className="chart-note">Choose any figure in the grid to drill it.</p>
      ) : null}
    </main>
  );
}
