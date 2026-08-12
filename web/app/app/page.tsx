import { FocusOnLoad, resolveView } from '@demo-kit/shell';
import { Ask } from '../../components/Ask';
import { Bars } from '../../components/Bars';
import { SeriesChart } from '../../components/SeriesChart';
import { IconCalendar, IconInfo, IconSparkle, IconTrendDown, IconTrendUp } from '../../components/Icons';
import { DEMO_MARK, DEMO_NAME } from '../../lib/demo';
import { findings, monthLabel } from '../../lib/findings';
import { money, moneyRate, percent, units } from '../../lib/format';
import { NETWORK_BRIEF } from '../../lib/narration';
import { NARRATION } from '../../lib/narration.generated';
import { SUGGESTIONS } from '../../lib/tools';
import { LATEST_MONTH, MONTHS, networkCost, networkVolume, ranked, world } from '../../lib/world';

/**
 * The product. Nothing on this page is demo furniture.
 *
 * The tour frames it, explains it and drives it; none of that leaks in here. The one
 * concession is `?view=inner`, which says this render is inside the tour's window and so
 * drops the page header the window's own title bar already provides — and `?focus=`, which
 * lets a tour step land the reader's eye on the section its note is about.
 *
 * Everything is server-rendered from the memoised world, so there is no loading state, no
 * client fetch and nothing for a screenshot to catch half-drawn. Only the question box is a
 * client component, because a question has to be typed.
 */

export const dynamic = 'force-dynamic';

export default async function Product({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; focus?: string }>;
}) {
  const { view, focus } = await searchParams;
  const inner = resolveView(view) === 'inner';

  const source = world();
  const month = LATEST_MONTH;
  const previous = MONTHS[month.index - 1];

  const volume = networkVolume(source, month.id);
  const cost = networkCost(source, month.id);
  const priorVolume = previous === undefined ? volume : networkVolume(source, previous.id);
  const change = priorVolume === 0 ? 0 : (volume - priorVolume) / priorVolume;

  const leader = ranked(source, month.id)[0];
  const finding = findings(source)[0];
  const brief = NARRATION[NETWORK_BRIEF];

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
            <span className="masthead-sub">Operations</span>
          </span>
          <span className="masthead-right">
            <IconCalendar /> {month.label}
          </span>
        </header>
      )}

      <section className="section focusable" id="section-summary" aria-label="This month">
        <div className="section-head">
          <h2 className="section-title">{month.label}</h2>
          <span className="section-note">Four sites, twelve closed months, one seed.</span>
        </div>
        <div className="cards">
          <div className="card">
            <div className="card-k">Network volume</div>
            <div className="card-v">{units(volume)}</div>
            <div className={`card-d ${change < 0 ? 'neg' : 'pos'}`}>
              {change < 0 ? <IconTrendDown /> : <IconTrendUp />} {percent(change)} on{' '}
              {previous?.label ?? 'the prior month'}
            </div>
          </div>
          <div className="card">
            <div className="card-k">Network cost</div>
            <div className="card-v">{money(cost)}</div>
            <div className="card-d">{moneyRate(cost / volume)} per unit</div>
          </div>
          <div className="card">
            <div className="card-k">Largest site</div>
            <div className="card-v">{leader?.site.name ?? '—'}</div>
            <div className="card-d">{units(leader?.row.volume ?? 0)} units</div>
          </div>
          <div className="card">
            <div className="card-k">Sites falling</div>
            <div className="card-v">{findings(source).length}</div>
            <div className="card-d">three months running</div>
          </div>
        </div>
      </section>

      <section className="section focusable" id="section-series" aria-label="Twelve months">
        <div className="section-head">
          <h2 className="section-title">Volume by site</h2>
          <span className="section-note">Units dispatched, {MONTHS[0]?.label} to {month.label}.</span>
        </div>
        <div className="pane">
          <SeriesChart world={source} months={MONTHS} />
        </div>
      </section>

      <section className="section focusable" id="section-brief" aria-label="The brief">
        <div className="section-head">
          <h2 className="section-title">Brief</h2>
        </div>
        <div className="pane">
          <h3 className="brief-h">{brief?.narration.headline ?? 'No brief has been generated.'}</h3>
          <p className="brief-b">{brief?.narration.body ?? ''}</p>
          <div className="brief-meta">
            <span className="tag">
              <IconSparkle />
              {brief?.narration.narratedBy === 'claude' ? 'Written by Claude at build time' : 'Template prose'}
            </span>
            {finding === undefined ? (
              <span>
                <IconInfo /> No site fell three months running.
              </span>
            ) : (
              <span>
                {/* The run's ends, not every month in it: "Apr to May to Jun" reads as three
                    separate things happening rather than as one continuous fall. */}
                <IconTrendDown /> {finding.site}, {monthLabel(finding.months[0] ?? '')} to{' '}
                {monthLabel(finding.months[finding.months.length - 1] ?? '')}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="section focusable" id="section-ranked" aria-label="This month by site">
        <div className="section-head">
          <h2 className="section-title">{month.label} by site</h2>
        </div>
        <div className="pane">
          <Bars world={source} month={month.id} />
        </div>
      </section>

      <section className="section focusable" id="section-ask" aria-label="Ask a question">
        <div className="section-head">
          <h2 className="section-title">Ask</h2>
          <span className="section-note">Answered from the figures above, or not at all.</span>
        </div>
        <div className="pane">
          <Ask suggestions={SUGGESTIONS} />
        </div>
      </section>
    </main>
  );
}
