import { FocusOnLoad, resolveView } from '@demo-kit/shell';
import type {
  CommentaryAction,
  CommentaryItem,
  CommentaryState,
  PublishedCommentarySnapshot,
} from '@kestrel/model';
import { entity, seedCommentaryQueue } from '@kestrel/model';
import { formatValue } from '@kestrel/measures';

import { Masthead } from '../../../components/Chrome';
import { Selectors } from '../../../components/Selectors';
import {
  COMMENTARY_STATES,
  COMMENTARY_STATE_LABELS,
  carriedCommentary,
  commentaryAffordances,
  commentaryEvidence,
  commentaryFilterHref,
  commentaryForView,
  commentaryState,
} from '../../../lib/commentary';
import type { CommentaryEvidence } from '../../../lib/commentary';
import { movement } from '../../../lib/format';
import type { Params, View } from '../../../lib/world';
import { monthLabel, viewOf, world } from '../../../lib/world';

/**
 * Commentary — the governed narrative, never detached prose.
 *
 * Every card states its period, comparator and version as part of its identity. The first level is
 * the Board-ready statement; the native details element opens a chain computed from the same
 * measure and bridge objects as Performance. Expanding it performs no navigation, so those three
 * identity parameters cannot change. Published content is rendered from its immutable snapshot and
 * evidence is recomputed `asOfVintage`, which is the difference between an audit trail and a label.
 */

export const dynamic = 'force-dynamic';

const ACTION_NOTE: Readonly<Record<CommentaryAction, string>> = {
  submit: 'Moves draft to in review',
  approve: 'Records controller approval',
  publish: 'Pins this wording and data vintage',
  reject: 'Requires a reason',
  revise: 'Starts the next revision',
};

const COMPARATOR_LABEL: Readonly<Record<CommentaryItem['comparatorId'], string>> = {
  prior_period: 'prior period',
  prior_year: 'prior year',
  budget: 'budget',
  forecast: 'forecast',
  trend: 'trend',
};

function StateChip({ state }: { readonly state: CommentaryState }) {
  return <span className={`commentary-state is-${state}`}>{COMMENTARY_STATE_LABELS[state]}</span>;
}

function Identity({ item }: { readonly item: CommentaryItem }) {
  return (
    <dl className="commentary-identity">
      <div>
        <dt>Period</dt>
        <dd>{monthLabel(item.period.endMonth)}</dd>
      </div>
      <div>
        <dt>Comparator</dt>
        <dd>{COMPARATOR_LABEL[item.comparatorId]}</dd>
      </div>
      <div>
        <dt>Version</dt>
        <dd>{item.versionId}</dd>
      </div>
      <div>
        <dt>Anchor</dt>
        <dd>
          {item.anchor.measureId} · {entity(item.anchor.entityId).name}
        </dd>
      </div>
    </dl>
  );
}

function PublishedPin({ snapshot }: { readonly snapshot: PublishedCommentarySnapshot }) {
  return (
    <aside className="commentary-pin" aria-label="Published snapshot">
      <span className="commentary-pin-mark" aria-hidden>
        ↳
      </span>
      <span>
        <strong>Published snapshot</strong> · revision {snapshot.revision} · vintage{' '}
        <code>{snapshot.dataVintageId}</code>
        <small>
          Published by {snapshot.publishedBy} on {snapshot.publishedAt.slice(0, 10)}. Later loads do
          not rewrite it.
        </small>
      </span>
    </aside>
  );
}

function PriorCommentary({ snapshot }: { readonly snapshot: PublishedCommentarySnapshot }) {
  return (
    <aside className="commentary-prior">
      <span className="commentary-kicker">Previous published commentary</span>
      <strong>{snapshot.headline}</strong>
      <p>{snapshot.detail}</p>
      <span className="commentary-meta">
        {monthLabel(snapshot.period.endMonth)} · {snapshot.versionId} · pinned to{' '}
        <code>{snapshot.dataVintageId}</code>
      </span>
    </aside>
  );
}

function EvidenceChain({ evidence }: { readonly evidence: CommentaryEvidence }) {
  return (
    <div className="commentary-chain">
      <section className="commentary-chain-step" aria-label="Movement">
        <span className="commentary-step-no">01</span>
        <div>
          <span className="commentary-kicker">Movement</span>
          <strong className="commentary-movement">
            {formatValue(evidence.comparison.current.value, evidence.comparison.current.unit)}{' '}
            <span>
              versus{' '}
              {formatValue(
                evidence.comparison.comparativeValue,
                evidence.comparison.current.unit,
              )}
            </span>
          </strong>
          <p>
            {movement(evidence.movement, evidence.movementUnit)} against{' '}
            {evidence.comparison.comparator.basis}.
          </p>
        </div>
      </section>

      <section className="commentary-chain-step" aria-label="Drivers">
        <span className="commentary-step-no">02</span>
        <div>
          <span className="commentary-kicker">Drivers with amounts</span>
          <div className="pane-scroll commentary-driver-scroll">
            <table className="grid commentary-driver-table">
              <thead>
                <tr>
                  <th scope="col">Driver</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Accounts</th>
                  <th scope="col" className="num">
                    Contribution
                  </th>
                </tr>
              </thead>
              <tbody>
                {evidence.drivers.map((driver, index) => (
                  <tr key={`${driver.label}:${index}`}>
                    <th scope="row">
                      {driver.label}
                      {driver.note === undefined ? null : (
                        <span className="row-note">{driver.note}</span>
                      )}
                    </th>
                    <td>{driver.owner}</td>
                    <td className="mono-cell">
                      {driver.accounts.map((accountId) => accountId.replaceAll('_', ' ')).join(', ')}
                    </td>
                    <td className="num">{movement(driver.value, driver.unit)}</td>
                  </tr>
                ))}
                <tr className="commentary-driver-total">
                  <th scope="row">Reconciled movement</th>
                  <td>{evidence.driversSum ? 'sums exactly' : 'does not reconcile'}</td>
                  <td>—</td>
                  <td className="num">{movement(evidence.driverTotal, evidence.movementUnit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="commentary-chain-step" aria-label="Accounts and operational factors">
        <span className="commentary-step-no">03</span>
        <div>
          <span className="commentary-kicker">Accounts and operational factors</span>
          <div className="commentary-account-grid">
            {evidence.inputs.map((input) => (
              <article key={input.accountId} className="commentary-account">
                <strong>{input.label}</strong>
                <span>{formatValue(input.value, 'currency')}</span>
                <small>
                  {input.rowCount} consolidated line{input.rowCount === 1 ? '' : 's'} ·{' '}
                  {input.vintageIds.length === 0
                    ? evidence.dataVintageId
                    : input.vintageIds.join(', ')}
                </small>
              </article>
            ))}
            {evidence.drivers.flatMap((driver, driverIndex) =>
              driver.factors.map((factor) => (
                <article
                  key={`${driver.label}:${factor.label}:${driverIndex}`}
                  className="commentary-account"
                >
                  <strong>{factor.label}</strong>
                  <span>{movement(factor.value, 'currency')}</span>
                  <small>{driver.label} contribution</small>
                </article>
              )),
            )}
          </div>
        </div>
      </section>

      <section className="commentary-chain-step" aria-label="Source rows">
        <span className="commentary-step-no">04</span>
        <div>
          <span className="commentary-kicker">Source rows</span>
          <div className="pane-scroll commentary-source-scroll">
            <table className="grid commentary-source-table">
              <thead>
                <tr>
                  <th scope="col">Entity</th>
                  <th scope="col">Account</th>
                  <th scope="col">Month</th>
                  <th scope="col">Factor</th>
                  <th scope="col" className="num">
                    Local amount
                  </th>
                  <th scope="col">Vintage</th>
                </tr>
              </thead>
              <tbody>
                {evidence.sourceRows.slice(0, 24).map((row, index) => (
                  <tr key={`${row.entityId}:${row.accountId}:${row.month}:${index}`}>
                    <th scope="row">{row.entityLabel}</th>
                    <td>{row.accountLabel}</td>
                    <td className="mono-cell">{row.month}</td>
                    <td>{row.segmentLabel ?? row.costCentreId ?? 'entity total'}</td>
                    <td className="num">
                      {formatValue(row.amountMinor, 'currency', { currency: row.currency })}
                    </td>
                    <td className="mono-cell">{row.vintageId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {evidence.sourceRows.length > 24 ? (
            <p className="chart-note">
              First 24 of {evidence.sourceRows.length} governed source rows. The count is disclosed;
              the preview is not presented as the whole population.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ApprovalHistory({ item }: { readonly item: CommentaryItem }) {
  return (
    <ol className="commentary-history">
      <li>
        <span>Created draft</span>
        <strong>{item.author}</strong>
        <time dateTime={item.createdAt}>{item.createdAt.slice(0, 10)}</time>
      </li>
      {item.approvalHistory.map((event, index) => (
        <li key={`${event.action}:${event.at}:${index}`}>
          <span>
            {COMMENTARY_STATE_LABELS[event.from]} → {COMMENTARY_STATE_LABELS[event.to]}
          </span>
          <strong>{event.actor}</strong>
          <time dateTime={event.at}>{event.at.slice(0, 10)}</time>
          {event.reason === undefined ? null : <p>{event.reason}</p>}
        </li>
      ))}
    </ol>
  );
}

function Actions({ item, view }: { readonly item: CommentaryItem; readonly view: View }) {
  const actions = commentaryAffordances(item, view.principal);
  if (actions.length === 0) {
    return (
      <p className="commentary-action-note">
        {item.state === 'published'
          ? 'Published items are immutable.'
          : `${view.principal.label} has no transition from this state.`}
      </p>
    );
  }
  return (
    <div className="commentary-actions" aria-label="Available workflow actions">
      {actions.map((action) => (
        <span key={action.action} className="commentary-action" title={ACTION_NOTE[action.action]}>
          {action.label}
        </span>
      ))}
      <small>Preview only · this deterministic demo does not persist workflow changes.</small>
    </div>
  );
}

function Provenance({ item, evidence }: { readonly item: CommentaryItem; readonly evidence: CommentaryEvidence }) {
  return (
    <dl className="commentary-provenance">
      <div>
        <dt>Figure references</dt>
        <dd>{item.provenance.figureRefs.join(', ')}</dd>
      </div>
      <div>
        <dt>Authored by</dt>
        <dd>{item.provenance.authoredBy}</dd>
      </div>
      <div>
        <dt>Model</dt>
        <dd>{item.provenance.modelId ?? 'not applicable'}</dd>
      </div>
      <div>
        <dt>Prompt</dt>
        <dd>{item.provenance.promptVersion ?? 'not applicable'}</dd>
      </div>
      <div>
        <dt>Data vintage</dt>
        <dd>
          {evidence.dataVintageId}
          {evidence.pinned ? ' · pinned publication' : ' · live draft basis'}
        </dd>
      </div>
    </dl>
  );
}

function CommentaryCard({
  item,
  queue,
  view,
  index,
}: {
  readonly item: CommentaryItem;
  readonly queue: readonly CommentaryItem[];
  readonly view: View;
  readonly index: number;
}) {
  const snapshot = item.publishedSnapshot;
  const evidence = commentaryEvidence(item, view, world());
  const prior = carriedCommentary(queue, item);
  return (
    <article className="commentary-card" id={`commentary-${index + 1}`}>
      <header className="commentary-card-head">
        <div>
          <span className="commentary-kicker">Board-ready headline</span>
          <h3>{snapshot?.headline ?? item.headline}</h3>
        </div>
        <StateChip state={item.state} />
      </header>

      <Identity item={item} />
      <p className="commentary-board-copy">{snapshot?.detail ?? item.detail}</p>
      {snapshot === undefined ? null : <PublishedPin snapshot={snapshot} />}
      {prior === undefined ? null : <PriorCommentary snapshot={prior} />}

      <details className="commentary-detail">
        <summary>
          Open supporting chain
          <span>movement → drivers → accounts → source rows</span>
        </summary>
        <EvidenceChain evidence={evidence} />
      </details>

      <div className="commentary-governance">
        <section>
          <span className="commentary-kicker">Approval history</span>
          <ApprovalHistory item={item} />
        </section>
        <section>
          <span className="commentary-kicker">Draft provenance</span>
          <Provenance item={item} evidence={evidence} />
          <Actions item={item} view={view} />
        </section>
      </div>
    </article>
  );
}

export default async function Commentary({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;
  const selectedState = commentaryState(params.state);
  const view = viewOf(params);
  const queue = seedCommentaryQueue(world());
  const visibleQueue = commentaryForView(queue, view, selectedState);

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />
      <Masthead path="/app/commentary" view={view} />
      <Selectors path="/app/commentary" view={view} />

      <section className="section focusable" id="section-commentary" aria-label="Commentary queue">
        <div className="section-head">
          <h2 className="section-title">Commentary that stays attached to its figures</h2>
          <span className="section-note">
            The headline is for the Board; the supporting chain is for the controller. Opening one
            changes no period, version or comparator. Each approval event names the actor, and
            publication freezes both wording and vintage.
          </span>
        </div>

        <div className="commentary-toolbar">
          <div className="sel-row">
            <span className="sel-label">State</span>
            <div className="sel-chips">
              <a
                className={`chip-link${selectedState === undefined ? ' is-active' : ''}`}
                href={commentaryFilterHref(params)}
                aria-current={selectedState === undefined ? 'true' : undefined}
              >
                All
              </a>
              {COMMENTARY_STATES.map((state) => (
                <a
                  key={state}
                  className={`chip-link${selectedState === state ? ' is-active' : ''}`}
                  href={commentaryFilterHref(params, state)}
                  aria-current={selectedState === state ? 'true' : undefined}
                >
                  {COMMENTARY_STATE_LABELS[state]}
                </a>
              ))}
            </div>
          </div>
          <span className="commentary-role">
            Signed in as <strong>{view.principal.label}</strong> ·{' '}
            {view.permission.canPublish ? 'may publish' : 'cannot publish'}
          </span>
        </div>

        {visibleQueue.length === 0 ? (
          <div className="pane commentary-empty">
            <strong>No commentary is visible in this scope.</strong>
            <p>
              {view.entityId === 'group'
                ? 'No seeded item matches this state.'
                : `The seeded queue is anchored to Group figures. ${view.principal.label} is scoped to ${entity(view.entityId).name}, so those narratives are withheld rather than recomputed from a partial slice.`}
            </p>
          </div>
        ) : (
          <div className="commentary-list">
            {visibleQueue.map((item, index) => (
              <CommentaryCard key={item.id} item={item} queue={queue} view={view} index={index} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
