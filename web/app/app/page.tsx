import { FocusOnLoad, resolveView } from '@demo-kit/shell';
import { closeCompleteness, entity } from '@kestrel/model';
import { runDetectors } from '@kestrel/analysis';
import { formatValue } from '@kestrel/measures';

import { Ask } from '../../components/Ask';
import { Masthead } from '../../components/Chrome';
import { BoardPanel, CompletenessBanner, HeadlineCard } from '../../components/Figures';
import { LineChart } from '../../components/LineChart';
import { Selectors } from '../../components/Selectors';
import { headlinesFor } from '../../lib/headline';
import { NARRATION } from '../../lib/narration.generated';
import { deterministicOverviewNarration, overviewRevenueSeries } from '../../lib/overview';
import { SUGGESTIONS } from '../../lib/tools';
import type { Params } from '../../lib/world';
import {
  ALL_MONTHS,
  briefFor,
  contextOf,
  detectorContextOf,
  hrefFor,
  hrefForTarget,
  monthLabel,
  paramsForView,
  scopeLabel,
  viewOf,
  world,
} from '../../lib/world';

/**
 * Overview — the executive surface.
 *
 * The four priority boards are the centre of it, and that is the argument this page makes. An executive
 * dashboard is usually a wall of figures with the findings underneath, and it should be the other way
 * round: a figure tells a reader what happened, a finding tells them what to decide, and only the second
 * is worth the top of a page. So the headline row is four figures one line tall, and everything below it
 * is something that fired.
 *
 * Everything is server-rendered from the memoised world. Nothing fetches, so there is no loading state
 * and nothing for a screenshot or a deck slide to catch half-drawn. Only the question box is a client
 * component, because a question has to be typed.
 *
 * The tour frames this page and drives it; none of that leaks in here. The two concessions are
 * `?view=inner`, which drops the header the tour window's own title bar already provides, and `?focus=`,
 * which lets a tour step land a reader's eye on the section its note is about.
 */

export const dynamic = 'force-dynamic';

export default async function Overview({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const inner = resolveView(typeof params.view === 'string' ? params.view : undefined) === 'inner';
  const focus = typeof params.focus === 'string' ? params.focus : undefined;

  const view = viewOf(params);
  const ctx = contextOf(view);
  const headlines = headlinesFor(ctx, view.comparator);
  const brief = briefFor(view);
  const findingRaw = Array.isArray(params.finding) ? params.finding[0] : params.finding;
  const selectedFinding =
    findingRaw === undefined
      ? undefined
      : runDetectors(detectorContextOf(view)).findings.find(
          (finding) => finding.fingerprint === findingRaw,
        );

  const visibleEntities = new Set(view.permission.entityIds);
  const completeness = closeCompleteness(
    world().closePositions.filter((position) => visibleEntities.has(position.entityId)),
    view.scope.endMonth,
  );
  const openNames = completeness.open.map((p) => entity(p.entityId).name);

  /* Twelve months of revenue ending at the selected through-month, against the same month a year
     earlier. Read through the measure layer once per month rather than out of the store, so the series
     and the headline above it cannot disagree — two paths to the same figure is two figures. */
  const series = overviewRevenueSeries(ctx, ALL_MONTHS, view.through);

  /* The cache contains the one default reporting identity built and freshness-checked ahead of time.
     Every other period, comparator, version or lens gets code-written prose from its selected evidence;
     reusing the monthly cache would attach plausible words to different figures. A narrower principal
     gets no group prose at all, because it may name rows outside that principal's grant. */
  const defaultView = viewOf();
  const mayUseCachedNarration =
    view.entityId === 'group' &&
    view.periodKind === defaultView.periodKind &&
    view.through === defaultView.through &&
    view.comparator.id === defaultView.comparator.id &&
    view.comparator.versionId === defaultView.comparator.versionId &&
    view.version.id === defaultView.version.id &&
    view.lens === defaultView.lens;
  const cachedNarration = mayUseCachedNarration
    ? NARRATION[`overview:${view.scope.endMonth}`]?.narration
    : undefined;
  const narration =
    view.entityId !== 'group'
      ? undefined
      : (cachedNarration ?? deterministicOverviewNarration(view));

  return (
    <main className={`product${inner ? ' inner' : ''}`} id="product">
      <FocusOnLoad elementId={focus} />

      <Masthead path="/app" view={view} />

      <Selectors path="/app" view={view} />

      {/* Said before the figures rather than after them: it is a statement about every number on this
          page, and a note at the foot is a note nobody reads before reading the numbers. */}
      <CompletenessBanner
        closed={completeness.closed}
        total={completeness.total}
        openNames={openNames}
        {...(completeness.open[0]?.note === undefined ? {} : { note: completeness.open[0].note })}
      />

      {view.fellBack ? (
        <p className="banner banner-warn">
          Part of this address could not be read, so a default was used — showing{' '}
          {scopeLabel(view.periodKind, view.scope)} for {entity(view.entityId).name}. Said out loud
          because silently showing a different period is how a screenshot gets the wrong caption.
        </p>
      ) : null}

      <section className="section focusable" id="section-headline" aria-label="Headline measures">
        <div className="section-head">
          <h2 className="section-title">{scopeLabel(view.periodKind, view.scope)}</h2>
          <span className="section-note">
            {entity(view.entityId).name} · against {brief.comparator.basis}
          </span>
        </div>
        <div className="cards">
          {headlines.map((headline) => (
            <HeadlineCard
              key={headline.measureId}
              headline={headline}
              href={hrefFor('/app/performance', view)}
            />
          ))}
        </div>
        {narration === undefined ? null : (
          <p className="narration">
            <strong>{narration.headline}.</strong> {narration.body}
          </p>
        )}
      </section>

      <section className="section focusable" id="section-boards" aria-label="Priority boards">
        <div className="section-head">
          <h2 className="section-title">What needs a decision</h2>
          <span className="section-note">
            Partitioned by direction and horizon, so each finding has exactly one home. Ranked
            within a board by the materiality policy — never across them, because a £48k
            reconciliation break and a £0.8m opportunity are not comparable quantities.
          </span>
        </div>
        <div className="boards">
          {brief.boards.map((board) => (
            <BoardPanel
              key={board.id}
              title={board.title}
              question={board.question}
              findings={board.triage.kept}
              view={view}
              emptyNote={board.emptyNote}
              note={board.triage.note}
            />
          ))}
        </div>
        {brief.errors.length === 0 ? null : (
          <p className="banner banner-warn">
            {brief.errors.length} detector{brief.errors.length === 1 ? '' : 's'} failed to run:{' '}
            {brief.errors.map((e) => e.detectorId).join(', ')}. The boards above are incomplete,
            which is said rather than hidden — a silently missing board item is the worst of the
            three outcomes.
          </p>
        )}
      </section>

      {selectedFinding === undefined ? null : (
        <section
          className="section focusable"
          id="section-finding-evidence"
          aria-label={`${selectedFinding.title} evidence`}
        >
          <div className="section-head">
            <h2 className="section-title">{selectedFinding.title}</h2>
            <span className="section-note">
              Exact detector evidence · {selectedFinding.priority} priority ·{' '}
              {selectedFinding.direction} / {selectedFinding.horizon}
            </span>
          </div>
          <div className="pane">
            <p className="finding-statement">{selectedFinding.statement}</p>
            <dl className="finding-figures">
              {selectedFinding.figures.map((figure) => (
                <div key={figure.label} className="finding-figure">
                  <dt>{figure.label}</dt>
                  <dd>{formatValue(figure.value, figure.unit)}</dd>
                </div>
              ))}
            </dl>
            {selectedFinding.caveat === undefined ? null : (
              <p className="finding-caveat">{selectedFinding.caveat}</p>
            )}
            {selectedFinding.materiality === undefined ? null : (
              <p className="finding-materiality">
                Cleared materiality: {selectedFinding.materiality}
              </p>
            )}
            <p className="chart-note">
              Decision route:{' '}
              <a
                className="finding-action"
                href={hrefForTarget(selectedFinding.action.href, view)}
              >
                {selectedFinding.action.label}
              </a>{' '}
              · owner {selectedFinding.action.owner}
            </p>
          </div>
        </section>
      )}

      <section className="section focusable" id="section-trend" aria-label="Revenue over time">
        <div className="section-head">
          <h2 className="section-title">Revenue, twelve months</h2>
          <span className="section-note">
            Against the same month a year earlier. A gap in a line is a month with no data, not a
            zero.
          </span>
        </div>
        <div className="pane">
          <LineChart
            points={series}
            unit="currency"
            label="Revenue"
            comparativeLabel="Same month last year"
          />
        </div>
      </section>

      <section className="section focusable" id="section-ask" aria-label="Ask a question">
        <div className="section-head">
          <h2 className="section-title">Ask</h2>
          <span className="section-note">
            Every figure in an answer comes from a tool that read the measure layer. None is written
            by the model.
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
    </main>
  );
}
