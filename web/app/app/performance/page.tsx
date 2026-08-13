import { FocusOnLoad, resolveView } from '@demo-kit/shell';
import { SEGMENTS, entity, segment as segmentSpec, tradingEntities } from '@kestrel/model';
import { compareMeasure, computeMeasure, formatValue } from '@kestrel/measures';
import { buildBridge, directForecast, grossProfitBridge, principalDriver } from '@kestrel/analysis';

import { CashColumns } from '../../../components/CashColumns';
import { Selectors } from '../../../components/Selectors';
import { Waterfall } from '../../../components/Waterfall';
import { DEMO_MARK, DEMO_NAME } from '../../../lib/demo';
import { directionClass, movement } from '../../../lib/format';
import type { Params } from '../../../lib/world';
import { contextOf, hrefFor, scopeLabel, viewOf } from '../../../lib/world';

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

/** A row in the level tables: the measure, its comparative, and the movement between them. */
function Row({
  label,
  measureId,
  ctx,
  comparator,
  href,
}: {
  readonly label: string;
  readonly measureId: string;
  readonly ctx: ReturnType<typeof contextOf>;
  readonly comparator: Parameters<typeof compareMeasure>[2];
  readonly href?: string;
}) {
  const c = compareMeasure(measureId, ctx, comparator);
  const money =
    c.current.value === null || c.comparativeValue === null
      ? null
      : c.current.value - c.comparativeValue;
  return (
    <tr>
      <th scope="row">{href === undefined ? label : <a href={href}>{label}</a>}</th>
      <td className="num">{formatValue(c.current.value, c.current.unit)}</td>
      <td className="num">{formatValue(c.comparativeValue, c.current.unit)}</td>
      <td className={`num ${directionClass(c.favourable)}`}>{movement(money, c.current.unit)}</td>
      <td className={`num ${directionClass(c.favourable)}`}>
        {movement(c.movement, c.movementUnit)}
      </td>
    </tr>
  );
}

export default async function Performance({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;

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
  const principal = revenueBridge === null ? undefined : principalDriver(revenueBridge);

  const cash = directForecast(ctx);
  const basis = compareMeasure('revenue', ctx, view.comparator).comparator.basis;

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />

      {inner ? null : (
        <header className="masthead">
          <span className="masthead-mark" aria-hidden>
            {DEMO_MARK}
          </span>
          <span>
            <span className="masthead-name">{DEMO_NAME}</span>
            <br />
            <span className="masthead-sub">{entity(view.entityId).name}</span>
          </span>
          <nav className="masthead-nav" aria-label="Surfaces">
            <a className="nav-link" href={hrefFor('/app', view)}>
              Overview
            </a>
            <a
              className="nav-link is-active"
              href={hrefFor('/app/performance', view)}
              aria-current="page"
            >
              Performance
            </a>
          </nav>
          <span className="masthead-right">{scopeLabel(view.periodKind, view.scope)}</span>
        </header>
      )}

      <Selectors path="/app/performance" view={view} />

      <section className="section focusable" id="section-bridge" aria-label="Revenue bridge">
        <div className="section-head">
          <h2 className="section-title">Revenue, decomposed</h2>
          <span className="section-note">
            {scopeLabel(view.periodKind, view.scope)} against {basis}. Currency is separated first,
            so no commercial bar carries a translation effect.
          </span>
        </div>
        {revenueBridge === null ? (
          <p className="board-empty">
            A trend cannot be bridged: there are no quantities behind a fitted line, so there is
            nothing to attribute. Choose a comparator that names a version.
          </p>
        ) : (
          <>
            <div className="pane">
              <Waterfall bridge={revenueBridge} favourableWhen="up" />
            </div>
            {principal === undefined ? null : (
              <p className="narration">
                The largest single component is <strong>{principal.label.toLowerCase()}</strong> at{' '}
                {formatValue(Math.abs(principal.value), 'currency')}
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
      </section>

      {marginBridge === null ? null : (
        <section className="section focusable" id="section-margin" aria-label="Gross profit bridge">
          <div className="section-head">
            <h2 className="section-title">Gross profit, decomposed</h2>
            <span className="section-note">
              Composed as revenue less cost, so the two bridges cannot disagree about the same
              movement.
            </span>
          </div>
          <div className="pane">
            <Waterfall bridge={marginBridge} favourableWhen="up" />
          </div>
        </section>
      )}

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
              </tr>
            </thead>
            <tbody>
              <Row
                label={entity('group').name}
                measureId="revenue"
                ctx={contextOf({ ...view, entityId: 'group' })}
                comparator={view.comparator}
                href={hrefFor('/app/performance', view, { entity: 'group' })}
              />
              {tradingEntities().map((e) => (
                <Row
                  key={e.id}
                  label={e.name}
                  measureId="revenue"
                  ctx={contextOf({ ...view, entityId: e.id })}
                  comparator={view.comparator}
                  href={hrefFor('/app/performance', view, { entity: e.id })}
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
              </tr>
            </thead>
            <tbody>
              {SEGMENTS.map((spec) => (
                <Row
                  key={spec.code}
                  label={spec.label}
                  measureId="gross_margin"
                  ctx={{ ...ctx, segmentId: spec.code }}
                  comparator={view.comparator}
                />
              ))}
            </tbody>
          </table>
          <p className="chart-note">
            A segment slice is combined rather than consolidated: intercompany trade has no segment,
            so it is not eliminated here. The group row above is the consolidated figure.
          </p>
        </div>
      </section>

      <section className="section focusable" id="section-cash" aria-label="Cash forecast">
        <div className="section-head">
          <h2 className="section-title">Thirteen weeks of cash</h2>
          <span className="section-note">
            Receipts and payments scored separately, because a week that nets to zero because £2m
            arrived and £2m left is not a quiet week. Opening balance{' '}
            {formatValue(computeMeasure('cash', ctx).value, 'currency')}.
          </span>
        </div>
        <div className="pane">
          <CashColumns forecast={cash} />
        </div>
      </section>
    </main>
  );
}
