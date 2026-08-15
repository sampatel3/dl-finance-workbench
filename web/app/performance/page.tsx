import { resolveView } from '@demo-kit/shell';
import { SEGMENTS, entity, segment as segmentSpec } from '@kestrel/model';
import { compareMeasure, formatValue } from '@kestrel/measures';
import {
  buildBridge,
  buildThreeWaySplit,
  ebitdaBridge,
  grossProfitBridge,
  principalDriver,
} from '@kestrel/analysis';

import { Masthead } from '../../components/Chrome';
import { FocusOnLoad } from '../../components/FocusOnLoad';
import { MultiTrend } from '../../components/MultiTrend';
import { Selectors } from '../../components/Selectors';
import { ThreeWaySplit } from '../../components/ThreeWaySplit';
import { Waterfall } from '../../components/Waterfall';
import { directionClass, movement } from '../../lib/format';
import { DIVERGENCE_POINTS, TREND_MEASURES, buildTrend, selectedTrend } from '../../lib/trend';
import type { Params } from '../../lib/world';
import {
  ALL_MONTHS,
  contextForEntity,
  contextOf,
  hrefFor,
  scopeLabel,
  selectableEntities,
  viewOf,
} from '../../lib/world';

/**
 * Performance — the surface a variance is explained on.
 *
 * The bridge is the centre, and it is the thing this product is really claiming. Anybody can report that
 * revenue is £618k ahead of plan. The claim worth making is that the £618k decomposes into named causes
 * that **sum to it exactly**, that currency was separated before any of them, and that a reader can put a
 * finger on the volume bar and be told which segment made it.
 *
 * Below it, the same measure at every level a reader might drill to — group, entity, segment — each
 * computed independently rather than apportioned. A margin apportioned from a parent is a number that
 * looks like a measurement and is a division.
 */

export const dynamic = 'force-dynamic';

/**
 * The href that adds or removes one measure from the trend.
 *
 * A toggle rather than a selector, because the review's question — *is growth converting into profit?* —
 * is about two lines at once, and a control that shows one at a time cannot ask it. Held in the URL like
 * every other selection here, so a reader who finds the divergence can send the chart that shows it.
 *
 * Removing the last remaining series is not offered: an empty chart is not a view anybody wanted, and a
 * toggle that can break the page is a toggle somebody will break the page with.
 */
function trendHref(
  view: ReturnType<typeof viewOf>,
  selected: readonly string[],
  measureId: string,
): string {
  const on = selected.includes(measureId);
  const next = on ? selected.filter((id) => id !== measureId) : [...selected, measureId];
  const target = new URL(hrefFor('/performance', view), 'https://finance-workbench.invalid');
  target.searchParams.set('trend', (next.length === 0 ? selected : next).join(','));
  target.searchParams.set('focus', 'section-trend');
  return `${target.pathname}${target.search}`;
}

function commentaryHref(
  view: ReturnType<typeof viewOf>,
  measureId: 'revenue' | 'gross_margin',
  options: { readonly entity?: string; readonly segment?: string } = {},
): string {
  const base = hrefFor(
    '/commentary',
    view,
    options.entity === undefined ? {} : { entity: options.entity },
  );
  const params = new URLSearchParams();
  params.set('focus', 'section-commentary');
  params.set('measure', measureId);
  if (options.segment !== undefined) params.set('segment', options.segment);
  return `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`;
}

/** A row in the level tables: the measure, its comparative, and the movement between them. */
function Row({
  label,
  measureId,
  ctx,
  comparator,
  href,
  active = false,
}: {
  readonly label: string;
  readonly measureId: string;
  readonly ctx: ReturnType<typeof contextOf>;
  readonly comparator: Parameters<typeof compareMeasure>[2];
  readonly href?: string;
  readonly active?: boolean;
}) {
  const c = compareMeasure(measureId, ctx, comparator);
  const money =
    c.current.value === null || c.comparativeValue === null
      ? null
      : c.current.value - c.comparativeValue;
  return (
    <tr className={active ? 'row-active' : ''}>
      <th scope="row">{label}</th>
      <td className="num">{formatValue(c.current.value, c.current.unit)}</td>
      <td className="num">{formatValue(c.comparativeValue, c.current.unit)}</td>
      <td className={`num ${directionClass(c.favourable)}`}>{movement(money, c.current.unit)}</td>
      <td className={`num ${directionClass(c.favourable)}`}>
        {movement(c.movement, c.movementUnit)}
      </td>
      {href === undefined ? null : (
        <td>
          <a
            className="finding-action"
            href={href}
            aria-label={`Open commentary and evidence for ${label}`}
          >
            Commentary &amp; evidence
          </a>
        </td>
      )}
    </tr>
  );
}

export default async function Performance({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;
  const selectedMeasure = typeof params.measure === 'string' ? params.measure : undefined;
  const selectedSegment = typeof params.segment === 'string' ? params.segment : undefined;

  const view = viewOf(params);
  const ctx = contextOf(view);

  /* A trend cannot be bridged — there are no quantities behind a fitted line, so there is nothing to
     attribute — and `buildBridge` throws rather than returning a decomposition it cannot support. So the
     surface says why instead of rendering an empty chart. */
  const bridgeable = view.comparator.id !== 'trend';
  const revenueBridge = bridgeable
    ? buildBridge({ measureId: 'revenue', ctx, comparator: view.comparator })
    : null;
  const marginBridge = bridgeable ? grossProfitBridge({ ctx, comparator: view.comparator }) : null;
  const profitBridge = bridgeable ? ebitdaBridge({ ctx, comparator: view.comparator }) : null;
  const principal = revenueBridge === null ? undefined : principalDriver(revenueBridge);
  const revenueSplit = buildThreeWaySplit({ measureId: 'revenue', ctx });

  /* Four measures on one indexed axis. See `lib/trend.ts`: revenue is £12.4m and margin is 41.8%, so
     they cannot share a value axis, and a second axis on the right is the chart that makes any two
     series look however the author wants. Rebasing to 100 is the only honest way to answer whether
     they moved together. */
  const trendSelection = selectedTrend(params.trend);
  const trend = buildTrend(ctx, ALL_MONTHS, view.through, trendSelection);

  const basis = compareMeasure('revenue', ctx, view.comparator).comparator.basis;

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />

      <Masthead path="/performance" view={view} />

      <Selectors path="/performance" view={view} />

      <section className="section focusable" id="section-bridge" aria-label="Revenue bridge">
        <div className="section-head">
          <h2 className="section-title">Revenue, decomposed</h2>
          <span className="section-note">
            {scopeLabel(view.periodKind, view.scope)} against {basis}. Currency is separated first,
            so no commercial bar carries a translation effect.
          </span>
        </div>
        <div className="performance-bridge-layout">
          <div className="performance-bridge-main">
            {revenueBridge === null ? (
              <div className="pane">
                <p className="board-empty">
                  A trend cannot be bridged: there are no quantities behind a fitted line, so there
                  is nothing to attribute. Choose a comparator that names a version.
                </p>
              </div>
            ) : (
              <>
                <div className="pane">
                  <Waterfall bridge={revenueBridge} favourableWhen="up" />
                </div>
                {principal === undefined ? null : (
                  <p className="narration">
                    The largest single component is <strong>{principal.label.toLowerCase()}</strong>{' '}
                    at {formatValue(Math.abs(principal.value), 'currency')}
                    {principal.bySegment === undefined || principal.bySegment.size === 0
                      ? '.'
                      : `, and within it ${[...principal.bySegment.entries()]
                          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                          .slice(0, 1)
                          .map(
                            ([code, value]) =>
                              `${segmentSpec(code).label.toLowerCase()} at ${formatValue(Math.abs(value), 'currency')}`,
                          )
                          .join('')}.`}
                  </p>
                )}
              </>
            )}
          </div>
          <ThreeWaySplit split={revenueSplit} />
        </div>
      </section>

      <section className="section focusable" id="section-margin" aria-label="Gross profit bridge">
        <div className="section-head">
          <h2 className="section-title">Gross profit, decomposed</h2>
          <span className="section-note">
            Composed as revenue less cost, so the two bridges cannot disagree about the same
            movement.
          </span>
        </div>
        {marginBridge === null ? (
          <div className="pane">
            <p className="board-empty">
              A trend cannot be bridged: there are no planned quantities behind a fitted line, so
              there is nothing to attribute. Choose a comparator that names a version.
            </p>
          </div>
        ) : (
          <div className="pane">
            <Waterfall bridge={marginBridge} favourableWhen="up" />
          </div>
        )}
      </section>

      <section className="section focusable" id="section-ebitda" aria-label="EBITDA bridge">
        <div className="section-head">
          <h2 className="section-title">EBITDA, decomposed</h2>
          <span className="section-note">
            The exact gross-profit bridge, followed by staff, other and unmapped operating-expense
            impacts. Every bar is governed and together they tie to the EBITDA movement against{' '}
            {basis}.
          </span>
        </div>
        {profitBridge === null ? (
          <div className="pane">
            <p className="board-empty">
              A trend cannot be bridged: it has no recorded quantities or version behind it. Choose
              a comparator that names a version for an exact EBITDA explanation.
            </p>
          </div>
        ) : (
          <div className="pane">
            <Waterfall bridge={profitBridge} favourableWhen="up" />
          </div>
        )}
      </section>

      <section
        className="section focusable"
        id="section-opex"
        aria-label="Operating expense analysis"
      >
        <div className="section-head">
          <h2 className="section-title">Operating expense</h2>
          <span className="section-note">
            Actual, comparator, sterling variance and relative movement by the three categories in
            the governed Opex definition. A positive variance is an overspend; the direction colour
            follows that cost polarity.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid">
            <caption>Operating expense against {basis}</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className="num">
                  Actual
                </th>
                <th scope="col" className="num">
                  Comparator
                </th>
                <th scope="col" className="num">
                  £ variance
                </th>
                <th scope="col" className="num">
                  % variance
                </th>
              </tr>
            </thead>
            <tbody>
              <Row
                label="Staff cost"
                measureId="staff_cost"
                ctx={ctx}
                comparator={view.comparator}
              />
              <Row
                label="Other operating expense"
                measureId="other_opex"
                ctx={ctx}
                comparator={view.comparator}
              />
              <Row
                label="Unmapped operating expense"
                measureId="unmapped_opex"
                ctx={ctx}
                comparator={view.comparator}
              />
              <Row
                label="Total operating expense"
                measureId="opex"
                ctx={ctx}
                comparator={view.comparator}
                active={selectedMeasure === 'opex'}
              />
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="section focusable"
        id="section-trend"
        aria-label="Performance over twelve months"
      >
        <div className="section-head">
          <h2 className="section-title">Is growth converting into profit?</h2>
          <span className="section-note">
            Twelve months to {scopeLabel(view.periodKind, view.scope)}, every series rebased to 100
            at the opening month. Toggle a measure to add or remove its line; the selection is in
            the URL, so a chart that shows a divergence is a link you can send.
          </span>
        </div>
        <div className="pane">
          <nav className="sel-chips" aria-label="Measures on the trend">
            {TREND_MEASURES.map((entry) => {
              const on = trendSelection.includes(entry.id);
              return (
                <a
                  key={entry.id}
                  className={`chip-link${on ? ' is-active' : ''}`}
                  href={trendHref(view, trendSelection, entry.id)}
                  {...(on ? { 'aria-current': 'true' as const } : {})}
                >
                  {entry.short}
                </a>
              );
            })}
          </nav>

          <MultiTrend trend={trend} />

          {/* The answer to the section's own question, stated rather than left to the eye. A reader
              scanning four lines sees divergence where the gap is widest, which is not where it
              opened — so the month the lines parted is named. */}
          {trend.divergence === null ? (
            <p className="narration">
              The measures on this chart have moved together over the window, within{' '}
              {DIVERGENCE_POINTS} index points. Growth is converting.
            </p>
          ) : (
            <p className="narration">
              <strong>{trend.divergence.statement}</strong>
            </p>
          )}
        </div>
      </section>

      <section className="section focusable" id="section-levels" aria-label="By entity and segment">
        <div className="section-head">
          <h2 className="section-title">The same measure at every level</h2>
          <span className="section-note">
            Each row is computed independently, never apportioned from its parent. A margin divided
            down from a group figure is a number that looks like a measurement and is a division.
          </span>
        </div>

        <div className="pane">
          <table className="grid">
            <caption>Revenue by entity</caption>
            <thead>
              <tr>
                <th scope="col">Entity</th>
                <th scope="col" className="num">
                  Actual
                </th>
                <th scope="col" className="num">
                  Comparative
                </th>
                <th scope="col" className="num">
                  Variance
                </th>
                <th scope="col" className="num">
                  %
                </th>
                <th scope="col">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {selectableEntities(view.principal).map((e) => (
                <Row
                  key={e.id}
                  label={e.name}
                  measureId="revenue"
                  ctx={contextForEntity(view, e.id)}
                  comparator={view.comparator}
                  href={commentaryHref(view, 'revenue', { entity: e.id })}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="pane">
          <table className="grid">
            <caption>Gross margin by segment — {entity(view.entityId).name}</caption>
            <thead>
              <tr>
                <th scope="col">Segment</th>
                <th scope="col" className="num">
                  Actual
                </th>
                <th scope="col" className="num">
                  Comparative
                </th>
                <th scope="col" className="num">
                  Variance
                </th>
                <th scope="col" className="num">
                  Relative
                </th>
                <th scope="col">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {SEGMENTS.filter(
                (spec) => ctx.segmentId === undefined || spec.code === ctx.segmentId,
              ).map((spec) => (
                <Row
                  key={spec.code}
                  label={spec.label}
                  measureId="gross_margin"
                  ctx={{ ...ctx, segmentId: spec.code }}
                  comparator={view.comparator}
                  href={commentaryHref(view, 'gross_margin', { segment: spec.code })}
                  active={selectedSegment === spec.code}
                />
              ))}
            </tbody>
          </table>
          <p className="chart-note">
            Use the named evidence action for commentary, quantified drivers, accounts and source
            rows. A segment slice is combined rather than consolidated: intercompany trade has no
            segment, so it is not eliminated here. The group row above is the consolidated figure.
          </p>
        </div>
      </section>
    </main>
  );
}
