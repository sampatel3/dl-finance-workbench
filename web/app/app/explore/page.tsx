import { resolveView } from '@demo-kit/shell';
import { SEGMENTS, VERSIONS, closeCompleteness, entity } from '@kestrel/model';
import { compareMeasure, formatValue, measure } from '@kestrel/measures';
import { DIMENSIONS, DIMENSION_LABELS, drillCell } from '@kestrel/analysis';

import { Masthead } from '../../../components/Chrome';
import { FocusOnLoad } from '../../../components/FocusOnLoad';
import { Selectors } from '../../../components/Selectors';
import {
  ALL_EXPLORE_MEASURES,
  EXPLORE_PRESETS,
  cellProvenance,
  exploreCloseDrillHref,
  exploreDrillHref,
  exploreExportHref,
  exploreHref,
  explorePresetHref,
  exploreState,
} from '../../../lib/explore';
import { directionClass, movement } from '../../../lib/format';
import { SUGGESTIONS } from '../../../lib/tools';
import { Ask } from '../../../components/Ask';
import type { Params } from '../../../lib/world';
import { hrefFor, paramsForView, world } from '../../../lib/world';

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
  const { view, ctx, rows, columns, grain, measures, pivot, comparisons } = state;
  const datasetLabel =
    view.dataScenario === 'ACTUAL'
      ? 'Actual'
      : view.dataScenario === 'BUDGET'
        ? 'Budget FY26'
        : view.version.label;
  const requestedMeasure =
    typeof params.measure === 'string' && ALL_EXPLORE_MEASURES.includes(params.measure)
      ? params.measure
      : undefined;
  const citedComparison =
    requestedMeasure === undefined
      ? undefined
      : compareMeasure(requestedMeasure, ctx, view.comparator);
  const selectedSegmentLabel =
    state.segmentId === undefined
      ? undefined
      : SEGMENTS.find((candidate) => candidate.code === state.segmentId)?.label;
  const citedDifference =
    citedComparison?.current.value === null ||
    citedComparison?.current.value === undefined ||
    citedComparison.comparativeValue === null
      ? null
      : citedComparison.current.value - citedComparison.comparativeValue;
  const citedVintages =
    citedComparison === undefined
      ? []
      : [...new Set(citedComparison.current.inputs.flatMap((input) => input.vintageIds))].sort();
  const citedRows =
    citedComparison?.current.inputs.reduce((sum, input) => sum + input.rowCount, 0) ?? 0;
  const citedClose = closeCompleteness(
    world().closePositions.filter((position) => view.permission.entityIds.includes(position.entityId)),
    view.scope.endMonth,
  );

  /* `?drill=<rowIndex>:<colIndex>`. Indices rather than a key, because a cell's identity is its
     position in the grid the URL already describes — encoding the whole slice again would let the two
     disagree. */
  const drillRaw = Array.isArray(params.drill) ? params.drill[0] : params.drill;
  const [rowRaw, colRaw] = (drillRaw ?? '').split(':');
  const rowIndex = Number(rowRaw);
  const colIndex = Number(colRaw);
  const selectedRow = Number.isInteger(rowIndex) ? pivot.rows[rowIndex] : undefined;
  const selectedColumn = Number.isInteger(colIndex) ? pivot.columnPaths[colIndex] : undefined;
  const openCell =
    selectedRow !== undefined && selectedColumn !== undefined
      ? selectedRow.cells[colIndex]
      : undefined;
  const openComparison =
    openCell === undefined ? undefined : comparisons[rowIndex]?.[colIndex];
  const drill = openCell === undefined ? null : drillCell(openCell);
  const provenance =
    openCell === undefined ? null : cellProvenance(openCell.measureId, openCell.ctx);
  const drillPath =
    openCell === undefined || selectedRow === undefined || selectedColumn === undefined
      ? []
      : [
          measure(openCell.measureId).label,
          ...selectedRow.path.map((member) => member.label),
          ...selectedColumn.map((member) => member.label),
        ].filter((label, index, labels) => labels.indexOf(label) === index);

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      <Masthead path="/explore" view={view} />
      <Selectors path="/explore" view={view} />

      <section className="section focusable" id="section-ask" aria-label="Ask finance">
        <div className="section-head">
          <h2 className="section-title">Ask from this finance context</h2>
          <span className="section-note">
            The question inherits the selected role, organisational scope, period, comparator,
            currency basis and forecast version. Every returned figure links back to governed
            evidence; unsupported or unauthorised questions are refused.
          </span>
        </div>
        <div className="pane">
          <Ask
            suggestions={SUGGESTIONS}
            principalId={view.principal.id}
            viewParams={paramsForView(view)}
          />
        </div>
      </section>

      <section className="section focusable" id="section-axes" aria-label="Axes">
        <div className="section-head">
          <h2 className="section-title">Explore</h2>
          <span className="section-note">
            Any dimension on either axis. The arrangement is in the address, so a view you build is
            a link you can send — and every cell is the measure computed at that cell&rsquo;s slice,
            never a share of the one above it.
          </span>
        </div>

        <nav className="explore-presets" aria-label="Ready-made finance views">
          {EXPLORE_PRESETS.map((preset) => (
            <a key={preset.id} href={explorePresetHref(params, preset.id)}>
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </a>
          ))}
        </nav>

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
          <div className="sel-row">
            <span className="sel-label">Dataset</span>
            <div className="sel-chips">
              {(['actual', 'budget', 'forecast'] as const).map((scenario) => (
                <a
                  key={scenario}
                  className={`chip-link${view.dataScenario.toLowerCase() === scenario ? ' is-active' : ''}`}
                  href={exploreHref(params, 'scenario', scenario)}
                  aria-current={view.dataScenario.toLowerCase() === scenario ? 'true' : undefined}
                >
                  {scenario === 'actual' ? 'Actual' : scenario === 'budget' ? 'Budget' : 'Forecast'}
                </a>
              ))}
            </div>
          </div>
          {view.dataScenario === 'FORECAST' ? (
            <div className="sel-row">
              <span className="sel-label">Version</span>
              <div className="sel-chips">
                {VERSIONS.filter((version) => version.scenario === 'FORECAST').map((version) => (
                  <a
                    key={version.id}
                    className={`chip-link${view.version.id === version.id ? ' is-active' : ''}`}
                    href={exploreHref(params, 'version', version.id)}
                    aria-current={view.version.id === version.id ? 'true' : undefined}
                  >
                    {version.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <p className="chart-note">
          Dataset: {view.dataScenario.toLowerCase()}
          {view.dataScenario === 'FORECAST' ? ` · ${view.version.label}` : ''}. The grid contains{' '}
          {measures.length} governed measure{measures.length === 1 ? '' : 's'} and ends at{' '}
          {view.through}; the reporting selector above sets the comparator and total context.
        </p>

        {state.normalised ? (
          <p className="banner banner-warn">
            A dimension can appear once, on one axis. The repeated dimension in this address was
            removed before the grid was computed.
          </p>
        ) : null}

        {state.dimensionRefusal === undefined ? null : (
          <p className="banner banner-warn">{state.dimensionRefusal}</p>
        )}

        <p className="chart-note">
          <a className="finding-action" href={exploreExportHref(params)}>
            Export this view as CSV
          </a>{' '}
          — values, comparator, formula context and contributing load vintages travel with it.
        </p>

        <div className="pane pane-scroll">
          <table className="grid grid-pivot" id="explore-grid">
            <caption>
              Open any {datasetLabel} value to drill. Comparator and variance remain alongside as
              context.
            </caption>
            <thead>
              <tr>
                <th scope="col">{rows.map((d) => DIMENSION_LABELS[d]).join(' › ')}</th>
                {pivot.columnPaths.flatMap((path, i) => {
                  const label = path.map((m) => m.label).join(' · ') || 'Value';
                  const comparison = comparisons[0]?.[i];
                  return [
                    <th key={`${i}-actual`} scope="col" className="num">
                      {label} · {datasetLabel}
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
                    const selected = r === rowIndex && c === colIndex;
                    const cellContext = [
                      measure(cell.measureId).label,
                      ...row.path.map((member) => member.label),
                      ...(pivot.columnPaths[c] ?? []).map((member) => member.label),
                    ].filter((label, index, labels) => labels.indexOf(label) === index);
                    return [
                      <td
                        key={`${c}-actual`}
                        className={`num cell-drillable${selected ? ' cell-selected' : ''}`}
                      >
                        <a
                          id={`explore-cell-${r}-${c}`}
                          className={`cell-link${selected ? ' is-selected' : ''}`}
                          href={exploreDrillHref(params, r, c)}
                          aria-current={selected ? 'location' : undefined}
                          aria-label={`Drill into ${cellContext.join(', ')}, ${formatValue(cell.value, cell.unit)}`}
                        >
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

      {drill === null || openCell === undefined ? null : (
        <section className="section focusable" id="section-drill" aria-label="Selected cell drill-down">
          <nav className="drill-breadcrumb" aria-label="Drill breadcrumb">
            <a className="finding-action" href={exploreCloseDrillHref(params)}>
              &larr; Back to grid
            </a>
            <span aria-current="page">{drillPath.join(' › ')}</span>
          </nav>

          <div className="section-head">
            <h2 className="section-title">{drillPath.join(' › ')}</h2>
            <span className="section-note">
              {entity(view.entityId).name} · {datasetLabel} · {openCell.ctx.scope.label}
              {openComparison === undefined ? '' : ` · against ${openComparison.comparator.basis}`}
              . {drill.note}
            </span>
          </div>

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

          <details className="pane drill-evidence">
            <summary className="drill-evidence-summary">
              Technical evidence
              <span>Formula, provenance and source rows</span>
            </summary>

            {provenance === null ? null : (
              <div className="pane-scroll">
                <table className="grid">
                  <caption>Formula and provenance for this cell</caption>
                  <thead>
                    <tr>
                      <th scope="col">Input</th>
                      <th scope="col" className="num">
                        Stored value (minor units)
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
                  {provenance.vintageIds.length === 1 ? '' : 's'}. Stored inputs are raw fact values
                  in minor units; the computed result above carries the governed display unit.
                </p>
              </div>
            )}

            <div className="pane-scroll">
              <table className="grid">
                <caption>
                  Source rows — {drill.rows.length} of them, from{' '}
                  {drill.vintageIds.length === 1 ? 'one load' : `${drill.vintageIds.length} loads`}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Month</th>
                    <th scope="col">Entity</th>
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
                      <td>{entity(row.entityId).name}</td>
                      <td>{row.segmentId ?? '—'}</td>
                      <td>{row.costCentreId ?? '—'}</td>
                      {/* In the entity's own functional currency, which is what `Fact.amountMinor`
                          holds. Printing an AED or USD row with the group's £ symbol made the rows
                          appear not to tie to the figure they are evidence for — the Gulf rows read
                          4.6× their sterling contribution. */}
                      <td className="num">
                        {formatValue(row.amountMinor, 'currency', {
                          currency: entity(row.entityId).functional,
                        })}
                      </td>
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
              Each row is in its own entity&rsquo;s functional currency, which is how the ledger
              holds it. So these rows do not add up to the consolidated figure above them, and are
              not meant to: reaching that figure means translating each row at the closing rate for
              its month and then eliminating intercompany trade. The provenance table above shows
              that translated total; this table shows what was posted.
            </p>
            <p className="chart-note">
              The rows terminate the drill spine. They are seeded and shaped like ledger lines; they
              are not ledger lines, which is the accepted weakness this demo states rather than
              implies. <a href={hrefFor('/controls', view)}>Controls</a> holds the lineage.
            </p>
          </details>
        </section>
      )}

      {requestedMeasure === undefined || citedComparison === undefined ? null : (
        <section
          className="section focusable"
          id="section-cited-measure"
          aria-label={`${citedComparison.current.label} evidence`}
        >
          <div className="section-head">
            <h2 className="section-title">{citedComparison.current.label} evidence</h2>
            <span className="section-note">
              The exact governed value, selected comparison and formula cited by Ask for{' '}
              {view.scope.label}.
            </span>
          </div>
          <div className="pane pane-scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th scope="col">Dataset</th>
                  <th scope="col" className="num">Value</th>
                  <th scope="col">Basis</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{datasetLabel}</th>
                  <td className="num">
                    {formatValue(citedComparison.current.value, citedComparison.current.unit)}
                  </td>
                  <td>{view.scope.label}</td>
                </tr>
                {selectedSegmentLabel === undefined ? null : (
                  <tr>
                    <th scope="row">Segment slice</th>
                    <td colSpan={2}>{selectedSegmentLabel}</td>
                  </tr>
                )}
                <tr>
                  <th scope="row">{citedComparison.comparator.label}</th>
                  <td className="num">
                    {formatValue(citedComparison.comparativeValue, citedComparison.current.unit)}
                  </td>
                  <td>{citedComparison.comparator.basis}</td>
                </tr>
                <tr>
                  <th scope="row">Difference</th>
                  <td className={`num ${directionClass(citedComparison.favourable)}`}>
                    {formatValue(citedDifference, citedComparison.current.unit)}
                  </td>
                  <td>
                    {formatValue(citedComparison.movement, citedComparison.movementUnit)} relative
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="chart-note">
              <strong>{citedComparison.current.formula}.</strong> Owned by{' '}
              {citedComparison.current.owner}; definition {citedComparison.current.status}.
            </p>
            <dl className="evidence-summary">
              <div>
                <dt>Currency &amp; rate basis</dt>
                <dd>
                  GBP presentation ·{' '}
                  {view.lens === 'constant'
                    ? 'constant currency at prior-year rates'
                    : 'reported rates'}
                </dd>
              </div>
              <div>
                <dt>Aggregation</dt>
                <dd>
                  {citedComparison.current.consolidated
                    ? 'Consolidated, including eliminations'
                    : 'Combined slice; not consolidated'}
                </dd>
              </div>
              <div>
                <dt>Contributing evidence</dt>
                <dd>
                  {citedComparison.current.inputs.length} accounts · {citedRows} source rows ·{' '}
                  {citedVintages.length} load vintage{citedVintages.length === 1 ? '' : 's'}
                </dd>
              </div>
              <div>
                <dt>Close status</dt>
                <dd>
                  {citedClose.closed}/{citedClose.total} ledger
                  {citedClose.total === 1 ? '' : 's'} closed ·{' '}
                  {citedClose.open.length === 0 ? 'period final' : 'provisional'}
                </dd>
              </div>
              <div>
                <dt>Vintages</dt>
                <dd className="mono-cell">{citedVintages.join(', ') || 'No contributing load'}</dd>
              </div>
            </dl>
            <p className="chart-note">
              Open the same measure in the grid below for the account inputs, entity drill,
              eliminations and source-shaped rows. Controls holds load validation, mappings,
              reconciliation and published lineage for this governed model.
            </p>
          </div>
        </section>
      )}

      <section className="section focusable" id="section-formulas" aria-label="Formula inspector">
        <div className="section-head">
          <h2 className="section-title">Formula inspector</h2>
          <span className="section-note">
            The definitions below are the same catalogue entries that compute the grid and ground Ask.
            Open any dataset cell for the accounts, rows and vintages used in that calculation.
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
              {ALL_EXPLORE_MEASURES.map((id) => {
                const definition = measure(id);
                return (
                  <tr
                    key={id}
                    className={
                      openCell?.measureId === id || requestedMeasure === id ? 'row-active' : ''
                    }
                  >
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

      {drill === null ? (
        <p className="chart-note">Choose any figure in the grid to drill it.</p>
      ) : null}
    </main>
  );
}
