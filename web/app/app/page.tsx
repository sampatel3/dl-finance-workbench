import { FocusOnLoad, resolveView } from '@demo-kit/shell';
import { closeCompleteness, entity, monthScope } from '@kestrel/model';
import { computeMeasure } from '@kestrel/measures';

import { Ask } from '../../components/Ask';
import { Masthead } from '../../components/Chrome';
import { BoardPanel, CompletenessBanner, HeadlineCard } from '../../components/Figures';
import { LineChart } from '../../components/LineChart';
import { Selectors } from '../../components/Selectors';
import { headlinesFor } from '../../lib/headline';
import { NARRATION } from '../../lib/narration.generated';
import { SUGGESTIONS } from '../../lib/tools';
import type { Params } from '../../lib/world';
import {
  ALL_MONTHS,
  briefFor,
  contextOf,
  hrefFor,
  monthLabel,
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

  const visibleEntities = new Set(view.permission.entityIds);
  const completeness = closeCompleteness(
    world().closePositions.filter((position) => visibleEntities.has(position.entityId)),
    view.scope.endMonth,
  );
  const openNames = completeness.open.map((p) => entity(p.entityId).name);

  /* Twelve months of revenue against the same month a year earlier. Read through the measure layer once
     per month rather than out of the store, so the series and the headline above it cannot disagree —
     two paths to the same figure is two figures. */
  const series = ALL_MONTHS.slice(-12).map((month) => {
    const priorMonth = `${Number(month.slice(0, 4)) - 1}-${month.slice(5)}`;
    return {
      month,
      value: computeMeasure('revenue', { ...ctx, scope: monthScope(month) }).value,
      comparative: computeMeasure('revenue', { ...ctx, scope: monthScope(priorMonth) }).value,
    };
  });

  /* The committed narration is a group brief. A narrower principal gets the scoped figures and findings
     above, never prose whose numbers were generated from rows they cannot read. */
  const narration =
    view.entityId === 'group' ? NARRATION[`overview:${view.scope.endMonth}`] : undefined;

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
            <strong>{narration.narration.headline}.</strong> {narration.narration.body}
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
          <Ask suggestions={SUGGESTIONS} principalId={view.principal.id} />
        </div>
      </section>
    </main>
  );
}
