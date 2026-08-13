import { FocusOnLoad, resolveView } from '@demo-kit/shell';
import { VERSIONS } from '@kestrel/model';
import { formatValue } from '@kestrel/measures';
import {
  ASSUMPTIONS,
  DRIVERS,
  activeApprovedForecast,
  readDriver,
  versionDiff,
  versionList,
} from '@kestrel/analysis';

import { Masthead } from '../../../components/Chrome';
import { Selectors } from '../../../components/Selectors';
import { directionClass, movement } from '../../../lib/format';
import type { Params } from '../../../lib/world';
import { contextOf, hrefFor, viewOf } from '../../../lib/world';

/**
 * Forecast — the version in force, its drivers, and what changed since another version.
 *
 * The version diff is the object the client's PRD asks for and does not have: *"which drivers changed
 * since forecast v6?"* is one of its four illustrative questions, and `FW-MODEL-003` distinguishes
 * versions without ever comparing two.
 *
 * It is only possible because a forecast here is a set of assumptions applied to a generator rather than
 * its own stored output — two versions can be subtracted because both are the same world believed
 * differently. A forecast stored as its numbers can be compared figure by figure, which tells a reader
 * what changed and never why.
 *
 * What the diff deliberately does not do is split the total impact between the assumptions that moved.
 * Doing that properly needs a marginal run per assumption, and this build does not do it — so it reports
 * each assumption's own movement exactly, the total effect exactly, and no invented split. The caveat is
 * carried on the object rather than left to the surface, which is why it renders below.
 */

export const dynamic = 'force-dynamic';

const KIND_NOTE: Readonly<Record<string, string>> = {
  observed: 'Came out of a system.',
  assumed: 'Set by a person in a forecast version.',
};

export default async function Forecast({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;

  const view = viewOf(params);
  const ctx = contextOf(view);
  const approved = activeApprovedForecast();

  /* Which version to diff against. Defaults to the one before the view's, because "what changed since
     last time" is the question, and it is a link so the choice is in the address. */
  const raw = Array.isArray(params.from) ? params.from[0] : params.from;
  const forecasts = versionList().filter((v) => v.scenario === 'FORECAST');
  const index = forecasts.findIndex((v) => v.id === view.version.id);
  const fallback = forecasts[Math.max(0, index - 1)]?.id ?? forecasts[0]?.id ?? 'v4';
  const fromId = VERSIONS.some((v) => v.id === raw) ? (raw as string) : fallback;

  const diff = versionDiff(fromId, view.version.id, ctx);

  const compareHref = (id: string): string => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const single = Array.isArray(v) ? v[0] : v;
      if (single !== undefined && k !== 'from') next.set(k, single);
    }
    next.set('from', id);
    return `/app/forecast?${next.toString()}`;
  };

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      {inner ? null : <Masthead path="/app/forecast" view={view} />}
      <Selectors path="/app/forecast" view={view} />

      <section className="section focusable" id="section-versions" aria-label="Versions">
        <div className="section-head">
          <h2 className="section-title">Versions</h2>
          <span className="section-note">
            The version in force is {approved.label} — the approved forecast, not the draft on top
            of it. A draft is visible and is not what a variance is measured against.
          </span>
        </div>
        <div className="pane">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Status</th>
                <th scope="col">Actuals through</th>
                <th scope="col">Owner</th>
                <th scope="col" className="num">
                  Read it
                </th>
              </tr>
            </thead>
            <tbody>
              {VERSIONS.map((v) => (
                <tr key={v.id} className={v.id === view.version.id ? 'row-active' : ''}>
                  <th scope="row">{v.label}</th>
                  <td>
                    <span className={`chip-${v.status === 'approved' ? 'high' : 'low'}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="mono-cell">{v.actualsThrough}</td>
                  <td>{v.owner}</td>
                  <td className="num">
                    {v.scenario === 'FORECAST' ? (
                      <a href={hrefFor('/app/forecast', view, { version: v.id })}>select</a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section focusable" id="section-diff" aria-label="Version diff">
        <div className="section-head">
          <h2 className="section-title">
            What changed between {diff.from.label} and {diff.to.label}
          </h2>
          <span className="section-note">
            {diff.changes.length === 0
              ? 'No assumption moved between these two versions. An empty list is a real answer.'
              : `${diff.changes.length} of ${ASSUMPTIONS.length} assumptions moved.`}
          </span>
        </div>

        <div className="selectors">
          <div className="sel-row">
            <span className="sel-label">Against</span>
            <div className="sel-chips">
              {forecasts
                .filter((v) => v.id !== view.version.id)
                .map((v) => (
                  <a
                    key={v.id}
                    className={`chip-link${v.id === fromId ? ' is-active' : ''}`}
                    href={compareHref(v.id)}
                  >
                    {v.label}
                  </a>
                ))}
            </div>
          </div>
        </div>

        <div className="pane">
          <table className="grid">
            <caption>Assumptions that moved</caption>
            <thead>
              <tr>
                <th scope="col">Assumption</th>
                <th scope="col">Owner</th>
                <th scope="col" className="num">
                  From
                </th>
                <th scope="col" className="num">
                  To
                </th>
                <th scope="col">Moves</th>
              </tr>
            </thead>
            <tbody>
              {diff.changes.map((change) => (
                <tr key={change.key}>
                  <th scope="row">
                    {change.label}
                    {change.note === undefined ? null : (
                      <span className="row-note">{change.note}</span>
                    )}
                  </th>
                  <td>{change.owner}</td>
                  <td className="num">{formatValue(change.from, change.unit)}</td>
                  <td className="num">{formatValue(change.to, change.unit)}</td>
                  <td className="mono-cell">
                    {change.moves.length === 0 ? '—' : change.moves.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pane">
          <table className="grid">
            <caption>What it did to the figures</caption>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">
                  {diff.from.label}
                </th>
                <th scope="col" className="num">
                  {diff.to.label}
                </th>
                <th scope="col" className="num">
                  Movement
                </th>
              </tr>
            </thead>
            <tbody>
              {diff.impact.map((impact) => (
                <tr key={impact.measureId}>
                  <th scope="row">{impact.label}</th>
                  <td className="num">{formatValue(impact.from, impact.unit)}</td>
                  <td className="num">{formatValue(impact.to, impact.unit)}</td>
                  <td className="num">{movement(impact.movement, impact.movementUnit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* The caveat travels on the diff object, so a surface cannot render the figures without it. */}
          <p className="chart-note">{diff.attributionNote}</p>
        </div>
      </section>

      <section className="section focusable" id="section-drivers" aria-label="Drivers">
        <div className="section-head">
          <h2 className="section-title">The drivers</h2>
          <span className="section-note">
            A driver is the thing somebody can actually change, so each names an owner and the
            measures it moves — attribution runs those edges rather than placing a chart next to a
            variance and hoping the reader joins them up. <strong>Observed</strong> came out of a
            system; <strong>assumed</strong> was set by a person. A surface that did not distinguish
            them would invite a reader to treat somebody&rsquo;s guess as a measurement.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Driver</th>
                <th scope="col" className="num">
                  Actual
                </th>
                <th scope="col" className="num">
                  {view.version.label}
                </th>
                <th scope="col">Kind</th>
                <th scope="col">Owner</th>
                <th scope="col">Moves</th>
              </tr>
            </thead>
            <tbody>
              {DRIVERS.map((driver) => {
                const actual = readDriver(driver.id, ctx);
                const assumed = readDriver(driver.id, {
                  ...ctx,
                  scenario: 'FORECAST',
                  versionId: view.version.id,
                });
                const gap =
                  actual.value === null || assumed.value === null
                    ? null
                    : actual.value - assumed.value;
                return (
                  <tr key={driver.id}>
                    <th scope="row">
                      {driver.label}
                      {driver.note === undefined ? null : (
                        <span className="row-note">{driver.note}</span>
                      )}
                    </th>
                    <td className="num">{formatValue(actual.value, actual.unit)}</td>
                    <td className={`num ${gap === null ? '' : directionClass(gap <= 0)}`}>
                      {formatValue(assumed.value, assumed.unit)}
                    </td>
                    <td>
                      <span className={`chip-${driver.kind === 'observed' ? 'low' : 'medium'}`}>
                        {driver.kind}
                      </span>
                      <span className="row-note">{KIND_NOTE[driver.kind]}</span>
                    </td>
                    <td>{driver.owner}</td>
                    <td className="mono-cell">{driver.moves.join(', ')}</td>
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
