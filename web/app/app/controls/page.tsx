import { resolveView } from '@demo-kit/shell';
import { entity, glCodeControl } from '@kestrel/model';
import { formatValue } from '@kestrel/measures';

import { Masthead } from '../../../components/Chrome';
import { FocusOnLoad } from '../../../components/FocusOnLoad';
import { Selectors } from '../../../components/Selectors';
import { QualityControlsNav } from '../../../components/QualityControlsNav';
import { controlsFor } from '../../../lib/controls';
import { PERSONAS } from '../../../lib/permissions';
import type { Params } from '../../../lib/world';
import { hrefFor, monthLabel, viewOf } from '../../../lib/world';

/**
 * Controls — the evidence behind the finance surfaces.
 *
 * This is one controller workbench rather than an admin menu. A load leads to a close position, a
 * named check, the mapping exceptions that explain it, and finally the governed definitions and
 * publication record a reader relied on. The page receives a permission-scoped projection from
 * `lib/controls`; it never decides in JSX which rows a persona may see.
 */

export const dynamic = 'force-dynamic';

const JUMPS = [
  ['section-new-codes', 'New GL codes'],
  ['section-sources', 'Sources'],
  ['section-vintages', 'Loads & vintages'],
  ['section-close', 'Close'],
  ['section-checks', 'Checks'],
  ['section-mappings', 'Mappings'],
  ['section-catalogue', 'Catalogue'],
  ['section-versions', 'Versions'],
  ['section-lineage', 'Lineage'],
  ['section-ai-log', 'AI log'],
  ['section-permissions', 'Permissions'],
] as const;

/** Keep already-shared pre-focus URLs useful while every new link uses the supported section IDs. */
const LEGACY_PANEL_FOCUS: Readonly<Record<string, string>> = {
  mapping: 'section-mappings',
  intercompany: 'section-checks',
  close: 'section-close',
  vintages: 'section-vintages',
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readable(value: string): string {
  return value.replaceAll('_', ' ');
}

function timestamp(value: string): string {
  return value.replace('T', ' · ').replace('Z', ' UTC');
}

function statusTone(status: string): 'ok' | 'warn' | 'fail' | 'neutral' {
  if (['passed', 'accepted', 'approved', 'closed', 'published'].includes(status)) return 'ok';
  if (['failed', 'rejected'].includes(status)) return 'fail';
  if (['accepted_with_exceptions', 'submitted', 'draft', 'in_review', 'pending'].includes(status)) {
    return 'warn';
  }
  return 'neutral';
}

function Status({ value }: { readonly value: string }) {
  return (
    <span className={`control-status control-status-${statusTone(value)}`}>{readable(value)}</span>
  );
}

function Empty({ children }: { readonly children: React.ReactNode }) {
  return <p className="control-empty">{children}</p>;
}

export default async function Controls({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const requestedFocus = first(params.focus);
  const legacyPanel = first(params.panel);
  const focus =
    requestedFocus ?? (legacyPanel === undefined ? undefined : LEGACY_PANEL_FOCUS[legacyPanel]);
  const selectedCheckId =
    first(params.check) ?? (legacyPanel === 'intercompany' ? 'intercompany_trading' : undefined);
  const selectedMappingSetId = first(params.set);
  const selectedVintageId = first(params.vintage);
  const view = viewOf(params);
  const controls = controlsFor(view);

  /* New ledger codes created this month. A different control from the unmapped exception below: an
     unmapped code is a problem being reported, a new code is a queue with a deadline. Scoped to what
     this session can read, like every other list on this surface. */
  const codes = glCodeControl(view.scope.endMonth, view.permission.entityIds);

  const failedChecks = controls.checks?.filter((check) => check.status === 'failed').length ?? 0;
  const passedChecks = controls.checks?.filter((check) => check.status === 'passed').length ?? 0;
  const loadExceptions = controls.sourceStatuses.reduce(
    (sum, source) => sum + source.exceptionCount,
    0,
  );
  const restatements = controls.sourceStatuses.reduce(
    (sum, source) => sum + source.restatementCount,
    0,
  );
  const closeHold = controls.close.open[0];
  const failedCheck = controls.checks?.find((check) => check.status === 'failed');
  const focusHref = (section: string, exact?: Readonly<Record<string, string>>): string => {
    const base = hrefFor('/app/controls', view);
    const query = new URLSearchParams({ focus: section, ...exact });
    return `${base}${base.includes('?') ? '&' : '?'}${query.toString()}`;
  };

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      <Masthead path="/app/controls" view={view} />
      <Selectors path="/app/controls" view={view} />
      <QualityControlsNav active="controls" view={view} />

      {controls.requestedRefusal === null ? null : (
        <p className="banner banner-warn" role="alert">
          <strong>Requested scope refused.</strong> {controls.requestedRefusal} The page has stayed
          inside {entity(view.permission.entityRootId).name}.
        </p>
      )}

      {codes.created === 0 ? null : (
        <section className="section focusable" id="section-new-codes" aria-label="New GL codes">
          <div className="section-head">
            <h2 className="section-title">
              {codes.created} new ledger {codes.created === 1 ? 'code' : 'codes'} this month
              {codes.unauthorised === 0 ? '' : `, ${codes.unauthorised} outside the standard`}
            </h2>
            <span className="section-note">
              At the top of this surface because it is the earliest signal there is. An unmapped
              code is a problem already carrying value; a new code is one that may be about to. Most
              are fine — what matters is that Finance sees them in the month they appear rather than
              at year end, when a comparative stops agreeing with itself.
            </span>
          </div>

          <div className="pane">
            <table className="grid">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Label</th>
                  <th scope="col">Entity</th>
                  <th scope="col">Type</th>
                  <th scope="col">Created</th>
                  <th scope="col">By</th>
                  <th scope="col">Authorised</th>
                  <th scope="col">Mapping</th>
                  <th scope="col" className="num">
                    Posted
                  </th>
                </tr>
              </thead>
              <tbody>
                {codes.codes.map((code) => (
                  <tr
                    key={code.sourceCode}
                    className={!code.authorised || code.mapping === 'unmapped' ? 'row-warn' : ''}
                  >
                    <th scope="row" className="mono-cell">
                      {code.sourceCode}
                    </th>
                    <td>
                      {code.label}
                      {code.note === undefined ? null : (
                        <span className="row-note">{code.note}</span>
                      )}
                    </td>
                    <td>{code.entityName}</td>
                    <td className="mono-cell">{code.accountType.toUpperCase()}</td>
                    <td className="mono-cell">{code.createdAt.slice(0, 10)}</td>
                    <td>{code.createdBy}</td>
                    <td className={code.authorised ? 'pos' : 'neg'}>
                      {code.authorised ? 'yes' : 'no'}
                    </td>
                    <td className={code.mapping === 'mapped' ? 'pos' : 'neg'}>
                      {readable(code.mapping)}
                    </td>
                    <td className="num">{formatValue(code.postedMinor, 'currency')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="chart-note">
              {formatValue(codes.atRiskMinor, 'currency')} is posted to codes that are either
              unauthorised or not yet mapped. Either failure on its own puts a balance somewhere a
              reader cannot rely on, so the exposure counts both rather than only the codes that
              fail both tests. The unmapped ones are the same two the mapping panel reports — one
              fact, two readings.
            </p>
          </div>

          {/* The alert, modelled. The fields are the ones that make it actionable: who acts, by when,
              and what goes wrong if nobody does. An alert with no deadline is a notification. */}
          <div className="pane">
            <table className="grid">
              <caption>Control alert · modelled, not sent</caption>
              <tbody>
                <tr>
                  <th scope="row">To</th>
                  <td>{codes.alert.recipient}</td>
                </tr>
                <tr>
                  <th scope="row">Raised</th>
                  <td className="mono-cell">{codes.alert.raisedAt.slice(0, 10)}</td>
                </tr>
                <tr>
                  <th scope="row">Review by</th>
                  <td className="mono-cell">
                    {codes.alert.dueBy.slice(0, 10)} · {codes.alert.reviewWindowDays} working days
                  </td>
                </tr>
                <tr>
                  <th scope="row">Risk if unreviewed</th>
                  <td>{codes.alert.risk}</td>
                </tr>
              </tbody>
            </table>
            <p className="chart-note">
              <strong>No message is sent.</strong> This demo dials no mail server and holds no
              mailbox. What is modelled is the shape of the alert — recipient, deadline and
              consequence — because a demo that appeared to send email would be making a claim about
              a system nobody has built.
            </p>
          </div>
        </section>
      )}

      <section className="section focusable" id="section-control-room" aria-label="Control room">
        <div className="section-head">
          <h2 className="section-title">The controller&rsquo;s evidence chain</h2>
          <span className="section-note">
            Load, close, reconcile, map, define and publish. Every status below is projected from
            the same world as the reported figures; none is a dashboard-only flag.
          </span>
        </div>
        <div className="cards">
          <a className="card card-link" href={focusHref('section-close')}>
            <span className="card-k">Close readiness</span>
            <span className="card-v">
              {controls.close.closed}/{controls.close.total}
            </span>
            <span className={`card-d ${controls.close.ready ? 'pos' : 'neg'}`}>
              {controls.close.ready
                ? 'Ready to close'
                : `${closeHold?.entityName ?? 'One entity'} ${readable(closeHold?.state ?? 'open')}`}
            </span>
          </a>
          <a
            className="card card-link"
            href={focusHref(
              'section-checks',
              failedCheck === undefined ? undefined : { check: failedCheck.id },
            )}
          >
            <span className="card-k">Named checks</span>
            <span className="card-v">
              {controls.checks === null ? 'Scoped' : `${passedChecks}/${controls.checks.length}`}
            </span>
            <span className={`card-d ${failedChecks > 0 ? 'neg' : ''}`}>
              {controls.checks === null
                ? 'Group totals withheld'
                : failedChecks === 0
                  ? 'All passed'
                  : `${failedChecks} blocking failure`}
            </span>
          </a>
          <a
            className="card card-link"
            href={focusHref(
              'section-mappings',
              controls.mapping === null ? undefined : { set: controls.mapping.mappingSet.id },
            )}
          >
            <span className="card-k">Mapping exposure</span>
            <span className="card-v">
              {formatValue(controls.mapping?.amountAtStakeMinor ?? null, 'currency')}
            </span>
            <span className={`card-d ${(controls.mapping?.unmappedCount ?? 0) > 0 ? 'neg' : ''}`}>
              {controls.mapping?.unmappedCount ?? 0} unmapped account
              {(controls.mapping?.unmappedCount ?? 0) === 1 ? '' : 's'} in scope
            </span>
          </a>
          <a className="card card-link" href={focusHref('section-vintages')}>
            <span className="card-k">Load register</span>
            <span className="card-v">{controls.totalLoads}</span>
            <span className={`card-d ${loadExceptions > 0 ? 'neg' : ''}`}>
              {loadExceptions} exception{loadExceptions === 1 ? '' : 's'} · {restatements}{' '}
              restatement{restatements === 1 ? '' : 's'}
            </span>
          </a>
        </div>
        <nav className="control-jumps" aria-label="Control register sections">
          {JUMPS.map(([id, label]) => (
            <a key={id} className="chip-link" href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>
      </section>

      <section className="section focusable" id="section-sources" aria-label="Sources">
        <div className="section-head">
          <h2 className="section-title">Sources</h2>
          <span className="section-note">
            {controls.sharedSourceMetadataWithheld
              ? 'Only feeds wholly contained in this entity grant are shown with status and counts.'
              : 'Configured feeds remain visible when they have not loaded. Omitting them would make “not loaded” look like “not required”.'}
          </span>
        </div>
        {controls.sharedSourceMetadataWithheld ? (
          <p className="banner banner-warn">
            <strong>Shared-feed metadata withheld.</strong> Some feeds also serve entities outside
            this grant. A vintage has one source-wide row count and validation result, so no
            fabricated entity slice is shown.
          </p>
        ) : null}
        <div className="pane pane-scroll">
          <table className="grid grid-controls">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Feed</th>
                <th scope="col">Ingestion</th>
                <th scope="col">Latest load</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">
                  Exceptions
                </th>
              </tr>
            </thead>
            <tbody>
              {controls.sourceStatuses.map((source) => (
                <tr key={source.source.id}>
                  <th scope="row">
                    {source.source.name}
                    <span className="row-note mono-cell">{source.source.id}</span>
                  </th>
                  <td>{readable(source.source.feed)}</td>
                  <td>{readable(source.source.mechanism)}</td>
                  <td className="mono-cell">
                    {source.latestLoad === undefined
                      ? 'No modelled load'
                      : timestamp(source.latestLoad.vintage.loadedAt)}
                  </td>
                  <td>
                    <Status value={source.latestStatus} />
                  </td>
                  <td className="num">{source.exceptionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section focusable" id="section-vintages" aria-label="Loads and vintages">
        <div className="section-head">
          <h2 className="section-title">Loads and vintages</h2>
          <span className="section-note">
            The newest twelve loads from fully scoped feeds. Corrections arrive as a new vintage
            that names the load it restates; the old rows remain reproducible.
          </span>
        </div>
        {controls.recentLoads.length === 0 ? (
          <div className="pane">
            <Empty>
              {controls.sharedSourceMetadataWithheld
                ? 'No feed has load metadata wholly contained in this entity grant. Shared-feed histories are withheld, not treated as zero.'
                : 'No modelled load records are available inside this entity grant.'}
            </Empty>
          </div>
        ) : (
          <div className="pane pane-scroll">
            <table className="grid grid-controls">
              <thead>
                <tr>
                  <th scope="col">Vintage</th>
                  <th scope="col">Source</th>
                  <th scope="col">Window</th>
                  <th scope="col">Loaded</th>
                  <th scope="col" className="num">
                    Rows
                  </th>
                  <th scope="col">Validation</th>
                  <th scope="col">Restates</th>
                </tr>
              </thead>
              <tbody>
                {controls.recentLoads.map((load) => (
                  <tr
                    key={load.vintage.id}
                    id={`control-vintage-${load.vintage.id}`}
                    className={[
                      load.vintage.note ? 'row-warn' : '',
                      load.vintage.id === selectedVintageId ? 'row-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <th scope="row">
                      <span className="mono-cell">{load.vintage.id}</span>
                      {load.vintage.note === undefined ? null : (
                        <span className="row-note">{load.vintage.note}</span>
                      )}
                    </th>
                    <td>{load.source.name}</td>
                    <td className="mono-cell">
                      {load.vintage.fromMonth === load.vintage.toMonth
                        ? load.vintage.fromMonth
                        : `${load.vintage.fromMonth} – ${load.vintage.toMonth}`}
                    </td>
                    <td className="mono-cell">{timestamp(load.vintage.loadedAt)}</td>
                    <td className="num">{load.vintage.rowCount.toLocaleString('en-GB')}</td>
                    <td>
                      <Status value={load.vintage.status} />
                    </td>
                    <td className="mono-cell">{load.vintage.restatesVintageId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="chart-note">
              Showing {controls.recentLoads.length} of {controls.totalLoads} load records available
              from fully scoped feeds.
            </p>
          </div>
        )}
      </section>

      <section className="section focusable" id="section-close" aria-label="Close readiness">
        <div className="section-head">
          <h2 className="section-title">Close readiness · {monthLabel(view.through)}</h2>
          <span className="section-note">
            Submitted and closed are separate acts. A submitted ledger can support a working group
            number and still move before the controller locks it.
          </span>
        </div>
        <p className={`banner ${controls.close.ready ? 'banner-ok' : 'banner-warn'}`}>
          <strong>
            {controls.close.closed} of {controls.close.total} entities closed.
          </strong>{' '}
          {controls.close.ready
            ? 'This selected scope is ready.'
            : `${controls.close.open.map((position) => position.entityName).join(', ')} remains ${controls.close.open.map((position) => readable(position.state)).join(', ')}.`}
        </p>
        <div className="pane pane-scroll">
          <table className="grid grid-controls">
            <thead>
              <tr>
                <th scope="col">Entity</th>
                <th scope="col">State</th>
                <th scope="col">Owner</th>
                <th scope="col">Submitted</th>
                <th scope="col">Closed</th>
              </tr>
            </thead>
            <tbody>
              {controls.close.positions.map((position) => (
                <tr
                  key={position.entityId}
                  className={position.state === 'closed' ? '' : 'row-warn'}
                >
                  <th scope="row">
                    {position.entityName}
                    {position.note === undefined ? null : (
                      <span className="row-note">{position.note}</span>
                    )}
                  </th>
                  <td>
                    <Status value={position.state} />
                  </td>
                  <td>{position.owner}</td>
                  <td className="mono-cell">
                    {position.submittedAt === undefined ? '—' : timestamp(position.submittedAt)}
                  </td>
                  <td className="mono-cell">
                    {position.closedAt === undefined ? '—' : timestamp(position.closedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section focusable" id="section-checks" aria-label="Named checks">
        <div className="section-head">
          <h2 className="section-title">The reconciliation gate</h2>
          <span className="section-note">
            Each control names its arithmetic and both sides. A red icon without the numbers it
            compared is not a reconciliation.
          </span>
        </div>
        {controls.checks === null ? (
          <p className="banner banner-warn">
            <strong>Group reconciliation is not available at this scope.</strong> The check would
            disclose consolidated sides outside {entity(view.permission.entityRootId).name}, so no
            sliced substitute is shown under the group control&rsquo;s name.
          </p>
        ) : (
          <div className="pane pane-scroll">
            <table className="grid grid-controls grid-checks">
              <thead>
                <tr>
                  <th scope="col">Named check</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">
                    Left side
                  </th>
                  <th scope="col" className="num">
                    Right side
                  </th>
                  <th scope="col" className="num">
                    Difference
                  </th>
                </tr>
              </thead>
              <tbody>
                {controls.checks.map((check) => (
                  <tr
                    key={check.id}
                    id={`control-check-${check.id}`}
                    className={[
                      check.status === 'failed' ? 'row-warn' : '',
                      check.id === selectedCheckId ? 'row-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <th scope="row">
                      {check.name}
                      <span className="row-note">{check.rule}</span>
                      <span className="row-note mono-cell">Run {timestamp(check.lastRunAt)}</span>
                    </th>
                    <td>
                      <Status value={check.status} />
                    </td>
                    {check.sides.map((side) => (
                      <td key={side.id} className="num">
                        {formatValue(side.amountMinor, 'currency')}
                        <span className="row-note control-side-label">{side.label}</span>
                        <span className="row-note control-side-entities">
                          {side.entityNames.join(', ') || 'No contributing entity rows'}
                        </span>
                      </td>
                    ))}
                    <td className={`num ${check.status === 'failed' ? 'neg' : 'pos'}`}>
                      {formatValue(check.differenceMinor, 'currency')}
                      <span className="row-note">
                        threshold {formatValue(check.thresholdMinor, 'currency')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section focusable" id="section-mappings" aria-label="Mappings">
        <div className="section-head">
          <h2 className="section-title">Mappings</h2>
          <span className="section-note">
            The amount at stake is summed from the exception register. It is the same amount used by
            the mapped-P&amp;L reconciliation, not a second dashboard figure.
          </span>
        </div>
        {controls.mapping === null ? (
          <div className="pane">
            <Empty>No approved mapping set is effective for this period.</Empty>
          </div>
        ) : (
          <>
            <p
              className={`banner ${controls.mapping.unmappedCount > 0 ? 'banner-warn' : 'banner-ok'}`}
            >
              <strong>
                {controls.mapping.unmappedCount} unmapped account
                {controls.mapping.unmappedCount === 1 ? '' : 's'} ·{' '}
                {formatValue(controls.mapping.amountAtStakeMinor, 'currency')} at stake.
              </strong>{' '}
              Mapping set {controls.mapping.mappingSet.id} is in force from{' '}
              {controls.mapping.mappingSet.effectiveFrom}.
            </p>
            <div className="pane pane-scroll">
              {controls.mapping.unmapped.length === 0 ? (
                <Empty>No mapping exceptions are visible inside this entity grant.</Empty>
              ) : (
                <table className="grid grid-controls">
                  <thead>
                    <tr>
                      <th scope="col">Source account</th>
                      <th scope="col">Description</th>
                      <th scope="col">Entity</th>
                      <th scope="col">First seen</th>
                      <th scope="col" className="num">
                        Amount at stake
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {controls.mapping.unmapped.map((row) => (
                      <tr key={`${row.entityId}:${row.sourceCode}`} className="row-warn">
                        <th scope="row" className="mono-cell">
                          {row.sourceCode}
                        </th>
                        <td>{row.sourceLabel}</td>
                        <td>{row.entityName}</td>
                        <td className="mono-cell">{row.firstSeen}</td>
                        <td className="num neg">{formatValue(row.amountMinor, 'currency')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        <div className="pane pane-scroll">
          <table className="grid grid-controls">
            <caption>Effective-dated mapping versions</caption>
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Effective</th>
                <th scope="col">Status</th>
                <th scope="col">Owner</th>
                <th scope="col" className="num">
                  Mapped codes
                </th>
                <th scope="col" className="num">
                  Coverage
                </th>
                <th scope="col" className="num">
                  Exceptions in scope
                </th>
              </tr>
            </thead>
            <tbody>
              {controls.mappingVersions.map((mapping) => (
                <tr
                  key={mapping.mappingSet.id}
                  id={`control-mapping-${mapping.mappingSet.id}`}
                  className={
                    mapping.mappingSet.id === selectedMappingSetId ? 'row-active' : undefined
                  }
                >
                  <th scope="row">
                    v{mapping.mappingSet.version}
                    <span className="row-note mono-cell">{mapping.mappingSet.id}</span>
                  </th>
                  <td className="mono-cell">
                    {mapping.mappingSet.effectiveFrom} – {mapping.mappingSet.effectiveTo ?? 'open'}
                  </td>
                  <td>
                    <Status value={mapping.mappingSet.status} />
                  </td>
                  <td>{mapping.mappingSet.owner}</td>
                  <td className="num">
                    {mapping.totalCodes === null ? 'withheld' : mapping.mappingSet.mappedCodes}
                  </td>
                  <td className="num">
                    {mapping.coverage === null
                      ? 'withheld'
                      : formatValue(mapping.coverage, 'percent')}
                  </td>
                  <td className="num">{mapping.unmappedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section focusable" id="section-catalogue" aria-label="Measure catalogue">
        <div className="section-head">
          <h2 className="section-title">Measure catalogue</h2>
          <span className="section-note">
            Definition, basis, owner and approval state live beside each other. These are the same
            definitions used by every surface and by the question tools.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid grid-controls grid-catalogue">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Definition</th>
                <th scope="col">Basis</th>
                <th scope="col">Owner</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {controls.measures.map((measure) => (
                <tr key={measure.id}>
                  <th scope="row">
                    {measure.label}
                    <span className="row-note mono-cell">{measure.id}</span>
                  </th>
                  <td>
                    {measure.formula}
                    {measure.note === undefined ? null : (
                      <span className="row-note">{measure.note}</span>
                    )}
                  </td>
                  <td className="mono-cell">
                    {measure.unit} · {measure.trend}
                    {measure.annualise === true ? ' · annualised' : ''}
                  </td>
                  <td>{measure.owner}</td>
                  <td>
                    <Status value={measure.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section focusable" id="section-versions" aria-label="Planning versions">
        <div className="section-head">
          <h2 className="section-title">Planning versions</h2>
          <span className="section-note">
            Approved, superseded and draft beliefs remain distinct. The newest draft is visible and
            is not silently substituted for the approved forecast.
          </span>
        </div>
        <div className="pane pane-scroll">
          <table className="grid grid-controls">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Scenario</th>
                <th scope="col">State</th>
                <th scope="col">Actuals through</th>
                <th scope="col">Owner</th>
              </tr>
            </thead>
            <tbody>
              {controls.versions.map((version) => (
                <tr key={version.id}>
                  <th scope="row">
                    {version.label}
                    <span className="row-note mono-cell">{version.id}</span>
                  </th>
                  <td>{readable(version.scenario.toLowerCase())}</td>
                  <td>
                    <Status value={version.status} />
                  </td>
                  <td className="mono-cell">{version.actualsThrough}</td>
                  <td>{version.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section focusable" id="section-lineage" aria-label="Published lineage">
        <div className="section-head">
          <h2 className="section-title">Published lineage</h2>
          <span className="section-note">
            Publication copies the approved words and their figure references into a vintage-pinned
            snapshot. The value is recomputed from that pinned vintage; a later restatement may
            change the live June view, but it cannot rewrite what was signed.
          </span>
        </div>
        {controls.lineage === null ? (
          <p className="banner banner-warn">
            <strong>No published commentary is readable in this entity grant.</strong> Group
            publication metadata and its source rows are withheld with the group figure.
          </p>
        ) : (
          <ol className="control-lineage">
            <li className="control-lineage-step">
              <span className="control-lineage-k">1 · Published commentary</span>
              <strong>{controls.lineage.snapshot.headline}</strong>
              <span>
                {controls.lineage.snapshot.publishedBy} ·{' '}
                {timestamp(controls.lineage.snapshot.publishedAt)} · revision{' '}
                {controls.lineage.snapshot.revision}
              </span>
            </li>
            <li className="control-lineage-step">
              <span className="control-lineage-k">2 · Governed figure</span>
              <strong>
                {controls.lineage.pinnedFigure.label}{' '}
                {formatValue(
                  controls.lineage.pinnedFigure.value,
                  controls.lineage.pinnedFigure.unit,
                )}
              </strong>
              <span>
                {controls.lineage.snapshot.period.startMonth} –{' '}
                {controls.lineage.snapshot.period.endMonth} · against{' '}
                {readable(controls.lineage.snapshot.comparatorId)} · version{' '}
                {controls.lineage.snapshot.versionId}
              </span>
              <span className="mono-cell">
                {controls.lineage.item.provenance.figureRefs.join(' · ')}
              </span>
            </li>
            <li className="control-lineage-step">
              <span className="control-lineage-k">3 · Pinned source load</span>
              <strong>{controls.lineage.load.source.name}</strong>
              <span className="mono-cell">{controls.lineage.snapshot.dataVintageId}</span>
              <span>
                {controls.lineage.load.vintage.rowCount.toLocaleString('en-GB')} source rows ·
                loaded {timestamp(controls.lineage.load.vintage.loadedAt)}
              </span>
            </li>
            <li className="control-lineage-step control-lineage-later">
              <span className="control-lineage-k">4 · Later live state</span>
              <strong>
                {controls.lineage.currentFigure.label}{' '}
                {formatValue(
                  controls.lineage.currentFigure.value,
                  controls.lineage.currentFigure.unit,
                )}
              </strong>
              {controls.lineage.laterRestatements.length === 0 ? (
                <span>No later restatement covers the pinned load.</span>
              ) : (
                controls.lineage.laterRestatements.map((load) => (
                  <span key={load.vintage.id}>
                    {load.vintage.id} restates {load.vintage.restatesVintageId}; it changes the live
                    June view and is not substituted into the published snapshot.
                  </span>
                ))
              )}
            </li>
          </ol>
        )}
      </section>

      <section className="section focusable" id="section-ai-log" aria-label="AI usage log">
        <div className="section-head">
          <h2 className="section-title">AI usage log</h2>
          <span className="section-note">
            One append-only row per material narration: purpose, model or explicit keyless fallback,
            prompt, vintage, governed references, output and the named human disposition.
          </span>
        </div>
        {controls.aiLog.length === 0 ? (
          <div className="pane">
            <Empty>No narrated output records are readable in this entity grant.</Empty>
          </div>
        ) : (
          <div className="pane pane-scroll">
            <table className="grid grid-controls grid-ai-log">
              <thead>
                <tr>
                  <th scope="col">Interaction</th>
                  <th scope="col">Model &amp; prompt</th>
                  <th scope="col">Vintage</th>
                  <th scope="col">Governed references</th>
                  <th scope="col">Output</th>
                  <th scope="col">Human review</th>
                </tr>
              </thead>
              <tbody>
                {controls.aiLog.map((entry) => (
                  <tr key={entry.id}>
                    <th scope="row">
                      {readable(entry.purpose)}
                      <span className="row-note mono-cell">{entry.id}</span>
                      <span className="row-note mono-cell">{timestamp(entry.occurredAt)}</span>
                    </th>
                    <td className="mono-cell">
                      {entry.modelId}
                      <span className="row-note">{entry.promptVersion}</span>
                    </td>
                    <td className="mono-cell">{entry.dataVintageId}</td>
                    <td className="mono-cell">{entry.figureRefs.join(' · ')}</td>
                    <td>{entry.output.split('\n')[0]}</td>
                    <td>
                      <Status value={entry.review.outcome} />
                      {entry.review.outcome === 'pending' ? (
                        <span className="row-note">Awaiting named review</span>
                      ) : (
                        <span className="row-note">
                          {entry.review.actor} · {timestamp(entry.review.at)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section focusable" id="section-permissions" aria-label="Permissions">
        <div className="section-head">
          <h2 className="section-title">Who you are, and what you can read</h2>
          <span className="section-note">
            Role controls the action; an entity-subtree grant controls the rows. Pages and Ask use
            this same resolved scope, so chat cannot become a wider route around the product.
          </span>
        </div>
        <div className="selectors control-personas">
          <div className="sel-row">
            <span className="sel-label">Act as</span>
            <div className="sel-chips">
              {PERSONAS.map((persona) => (
                <a
                  key={persona.id}
                  className={`chip-link${view.principal.id === persona.id ? ' is-active' : ''}`}
                  href={hrefFor('/app/controls', view, { persona: persona.id })}
                >
                  {persona.label}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="pane">
          <dl className="control-permission-grid">
            <div>
              <dt>Active principal</dt>
              <dd>{view.principal.label}</dd>
              <dd className="mono-cell">{view.principal.id}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{view.principal.role}</dd>
            </div>
            <div>
              <dt>Entity root</dt>
              <dd>{entity(view.principal.grant.entityRootId).name}</dd>
              <dd className="mono-cell">{view.principal.grant.entityRootId}</dd>
            </div>
            <div>
              <dt>Resolved rows</dt>
              <dd>{view.permission.entityIds.map((id) => entity(id).name).join(', ')}</dd>
            </div>
            <div>
              <dt>Dimension filters</dt>
              <dd>
                {Object.keys(view.permission.dimensionFilters).length === 0
                  ? 'No additional dimension filter'
                  : Object.entries(view.permission.dimensionFilters)
                      .map(([key, value]) => `${readable(key)} = ${value}`)
                      .join(' · ')}
              </dd>
            </div>
            <div>
              <dt>Publish commentary</dt>
              <dd>{view.permission.canPublish ? 'Allowed' : 'Not granted'}</dd>
            </div>
          </dl>
        </div>
        {controls.groupRefusal === null ? (
          <p className="banner banner-ok">
            <strong>Group scope granted.</strong> This principal may resolve the complete
            legal-entity subtree; choosing an entity narrows that grant and never widens it.
          </p>
        ) : (
          <p className="banner banner-warn" role="status">
            <strong>Named denial.</strong> {controls.groupRefusal}
          </p>
        )}
      </section>
    </main>
  );
}
