import { FocusOnLoad, resolveView } from '@demo-kit/shell';
import { formatValue, measure } from '@kestrel/measures';
import { DIMENSIONS, DIMENSION_LABELS, drillCell } from '@kestrel/analysis';

import { Masthead } from '../../../components/Chrome';
import { Selectors } from '../../../components/Selectors';
import {
  EXPLORE_MEASURES,
  cellProvenance,
  exploreDrillHref,
  exploreExportHref,
  exploreHref,
  exploreState,
} from '../../../lib/explore';
import { directionClass, movement } from '../../../lib/format';
import type { Params } from '../../../lib/world';
import { hrefFor } from '../../../lib/world';

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

export default async function Explore({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;

  const state = exploreState(params);
  const { view, rows, columns, grain, pivot, comparisons } = state;

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
  const provenance =
    openCell === undefined ? null : cellProvenance(openCell.measureId, openCell.ctx);

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      <Masthead path="/app/explore" view={view} />
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
                  href={exploreHref(params, 'rows', d)}
                  aria-current={rows.includes(d) ? 'true' : undefined}
                >
                  {DIMENSION_LABELS[d]}
                </a>
              ))}
              <a
                className={`chip-link${rows.join(',') === 'entity,segment' ? ' is-active' : ''}`}
                href={exploreHref(params, 'rows', 'entity,segment')}
                aria-current={rows.join(',') === 'entity,segment' ? 'true' : undefined}
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
                  href={exploreHref(params, 'cols', d)}
                  aria-current={columns.includes(d) ? 'true' : undefined}
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
                  href={exploreHref(params, 'grain', g)}
                  aria-current={grain === g ? 'true' : undefined}
                >
                  {g === 'month' ? 'Month' : 'Quarter'}
                </a>
              ))}
            </div>
          </div>
        </div>

        {state.normalised ? (
          <p className="banner banner-warn">
            A dimension can appear once, on one axis. The repeated dimension in this address was
            removed before the grid was computed.
          </p>
        ) : null}

        <p className="chart-note">
          <a className="finding-action" href={exploreExportHref(params)}>
            Export this view as CSV
          </a>{' '}
          — values, comparator, formula context and contributing load vintages travel with it.
        </p>

        <div className="pane pane-scroll">
          <table className="grid grid-pivot">
            <thead>
              <tr>
                <th scope="col">{rows.map((d) => DIMENSION_LABELS[d]).join(' › ')}</th>
                {pivot.columnPaths.flatMap((path, i) => {
                  const label = path.map((m) => m.label).join(' · ') || 'Value';
                  const comparison = comparisons[0]?.[i];
                  return [
                    <th key={`${i}-actual`} scope="col" className="num">
                      {label} · Actual
                    </th>,
                    <th key={`${i}-comparative`} scope="col" className="num">
                      {label} · {comparison?.comparator.label ?? view.comparator.id}
                    </th>,
                    <th key={`${i}-variance`} scope="col" className="num">
                      {label} · Variance
                    </th>,
                  ];
                })}
                <th scope="col" className="num">
                  Window
                </th>
              </tr>
            </thead>
            <tbody>
              {pivot.rows.map((row, r) => (
                <tr key={r}>
                  <th scope="row">{row.path.map((m) => m.label).join(' › ')}</th>
                  {row.cells.flatMap((cell, c) => {
                    const comparison = comparisons[r]?.[c];
                    return [
                      <td key={`${c}-actual`} className="num">
                        <a className="cell-link" href={exploreDrillHref(params, r, c)}>
                          {formatValue(cell.value, cell.unit)}
                        </a>
                      </td>,
                      <td key={`${c}-comparative`} className="num muted-cell">
                        {formatValue(comparison?.comparativeValue ?? null, cell.unit)}
                      </td>,
                      <td
                        key={`${c}-variance`}
                        className={`num ${directionClass(comparison?.favourable ?? null)}`}
                      >
                        {movement(
                          comparison?.movement ?? null,
                          comparison?.movementUnit ?? cell.unit,
                        )}
                      </td>,
                    ];
                  })}
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

      <section className="section focusable" id="section-formulas" aria-label="Formula inspector">
        <div className="section-head">
          <h2 className="section-title">Formula inspector</h2>
          <span className="section-note">
            The definitions below are the same catalogue entries that compute the grid and ground Ask.
            Open any actual cell for the accounts, rows and vintages used in that calculation.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Formula</th>
                <th scope="col">Owner</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {EXPLORE_MEASURES.map((id) => {
                const definition = measure(id);
                return (
                  <tr key={id} className={openCell?.measureId === id ? 'row-active' : ''}>
                    <th scope="row">{definition.label}</th>
                    <td>{definition.formula}</td>
                    <td>{definition.owner}</td>
                    <td>{definition.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {drill === null || openCell === undefined ? null : (
        <section className="section focusable" id="section-drill" aria-label="Drill">
          <div className="section-head">
            <h2 className="section-title">{measure(openCell.measureId).label}, one level down</h2>
            <span className="section-note">{drill.note}</span>
          </div>

          {provenance === null ? null : (
            <div className="pane pane-scroll">
              <table className="grid">
                <caption>Formula and provenance for this cell</caption>
                <thead>
                  <tr>
                    <th scope="col">Input</th>
                    <th scope="col" className="num">
                      Stored value
                    </th>
                    <th scope="col">Months</th>
                    <th scope="col" className="num">
                      Rows
                    </th>
                    <th scope="col">Vintages</th>
                  </tr>
                </thead>
                <tbody>
                  {provenance.computed.inputs.map((input) => {
                    const evidence = provenance.inputs.get(input.accountId);
                    return (
                      <tr key={input.accountId}>
                        <th scope="row">
                          {input.label}
                          <span className="row-note">{input.accountId}</span>
                        </th>
                        <td className="num">
                          {input.value === null ? '—' : input.value.toLocaleString('en-GB')}
                        </td>
                        <td className="mono-cell">
                          {(evidence?.monthsUsed ?? input.monthsUsed).join(', ')}
                        </td>
                        <td className="num">{evidence?.rowCount ?? input.rowCount}</td>
                        <td className="mono-cell">
                          {(evidence?.vintageIds ?? input.vintageIds).join(', ') || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="chart-note">
                <strong>{provenance.computed.formula}.</strong> Owned by{' '}
                {provenance.computed.owner}; definition {provenance.computed.status}. Current value{' '}
                {formatValue(provenance.computed.value, provenance.computed.unit)} from{' '}
                {provenance.vintageIds.length} contributing vintage
                {provenance.vintageIds.length === 1 ? '' : 's'}. Input values are the measure
                engine&rsquo;s stored values; the computed result above carries the display unit.
              </p>
            </div>
          )}

          <div className="pane pane-scroll">
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

          <div className="pane pane-scroll">
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
