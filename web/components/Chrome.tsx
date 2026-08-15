/**
 * The chrome every surface shares: the rail, the masthead and their navigation.
 *
 * Extracted once there were more than two surfaces. It had been copied into each page, which was
 * tolerable at two and is how a nav ends up with a different set of links on different pages at seven —
 * the failure being invisible from any single page.
 *
 * The nav is generated from one list, so a surface that exists is reachable and a surface that is not
 * in the list is not silently unreachable: it is absent from the list, which is a thing a reader of this
 * file can see.
 *
 * ## Left is where you are, top is what you are looking at
 *
 * The sections moved out of the masthead and into a rail, and the split is the point rather than the
 * placement. Twelve destinations across a horizontal bar cannot be scanned — a reader takes the first
 * three and hunts for the rest — and it leaves no room to say what any of them are *for*. A rail has
 * vertical space, so the four questions in {@link NAV_GROUPS} become visible headings rather than an
 * order somebody has to infer.
 *
 * What stays at the top is **context**: role, period, entity, comparator, currency. Those are not
 * places, they are the lens every place is read through, and a control that changes what a figure
 * means belongs beside the figure rather than in the list of destinations.
 *
 * ## Three chromes, one product
 *
 * The tour renders the app inside a device frame at a fraction of the viewport, where a 232px rail
 * would eat a third of the width and the page would be a column of wrapped table cells. So the inner
 * treatment keeps the horizontal strip it always had, grouped by the same headings. `view.inner` is
 * the switch, and the two are otherwise the same links from the same list.
 */

import { DEMO_MARK, DEMO_NAME } from '../lib/demo';
import { NAV_GROUPS, SURFACES, groupFor, surfaceFor, surfacesIn } from '../lib/navigation';
import type { RailSignals } from '../lib/signals';
import { railSignals } from '../lib/signals';
import type { View } from '../lib/world';
import { hrefFor } from '../lib/world';
import { ActiveNavScroll } from './ActiveNavScroll';

function NavLink({
  surface,
  path,
  view,
  signals,
}: {
  readonly surface: (typeof SURFACES)[number];
  readonly path: string;
  readonly view: View;
  readonly signals?: RailSignals;
}) {
  const active = surface.activePaths.includes(path);
  const signal = signals?.[surface.path];
  return (
    <a
      className={`nav-link${active ? ' is-active' : ''}`}
      href={hrefFor(surface.path, view)}
      /* The count goes into the accessible name rather than sitting beside it as a bare numeral: a
         screen reader announcing "Cash and WC, 1" has said nothing a reader can act on. */
      aria-label={signal === undefined ? surface.ariaLabel : `${surface.ariaLabel} — ${signal.label}`}
      {...(active ? { 'aria-current': 'page' as const } : {})}
    >
      <span className="nav-label">{surface.label}</span>
      {signal === undefined ? null : (
        <span className="nav-signal" title={signal.label} aria-hidden>
          {signal.count}
        </span>
      )}
    </a>
  );
}

/**
 * The rail: four questions, and the sections that answer each.
 *
 * A `<nav>` of nested lists rather than a flat run of links, because the grouping is real
 * information and a screen reader should get it too — "Position, 3 items" is the same orientation
 * the eyebrow gives a sighted reader.
 */
export function Rail({ path, view }: { readonly path: string; readonly view: View }) {
  const signals = railSignals(view);
  return (
    <nav className="rail" aria-label="Finance workbench sections">
      <a className="rail-brand" href={hrefFor('/app', view)}>
        <span className="masthead-mark" aria-hidden>
          {DEMO_MARK}
        </span>
        <span className="rail-brand-name">{DEMO_NAME}</span>
      </a>

      {NAV_GROUPS.map((group) => {
        const surfaces = surfacesIn(group.id);
        if (surfaces.length === 0) return null;
        return (
          <div className="rail-group" key={group.id}>
            {group.label === '' ? null : (
              <h2 className="rail-eyebrow" title={group.question}>
                {group.label}
              </h2>
            )}
            <ul className="rail-list" aria-label={group.label === '' ? undefined : group.question}>
              {surfaces.map((surface) => (
                <li key={surface.path}>
                  <NavLink surface={surface} path={path} view={view} signals={signals} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Masthead({ path, view }: { readonly path: string; readonly view: View }) {
  const title = surfaceFor(path)?.label ?? DEMO_NAME;
  const group = groupFor(path);
  /* The tool has no question, and inventing one for it would be filler. */
  const question = group === undefined || group.label === '' ? undefined : group.question;
  const skipLink = (
    <a className="skip-link" href="#main-content">
      Skip to content
    </a>
  );
  const pageTitle = (
    <h1 className="visually-hidden" id="main-content" tabIndex={-1}>
      {title}
    </h1>
  );

  if (view.inner) {
    return (
      <>
        {skipLink}
        {view.surfaceNav ? (
          /* The tour's frame is too narrow for a rail, so the strip stays — but grouped, so the
             inner treatment teaches the same structure the full product uses. */
          <nav className="inner-surface-nav" aria-label="Finance workbench sections">
            {NAV_GROUPS.map((group) => {
              const surfaces = surfacesIn(group.id);
              if (surfaces.length === 0) return null;
              return (
                <span className="inner-nav-group" key={group.id}>
                  {group.label === '' ? null : (
                    <span className="inner-nav-eyebrow">{group.label}</span>
                  )}
                  {surfaces.map((entry) => (
                    <NavLink key={entry.path} surface={entry} path={path} view={view} />
                  ))}
                </span>
              );
            })}
          </nav>
        ) : null}
        {pageTitle}
        <ActiveNavScroll />
      </>
    );
  }

  /* The masthead is the page's name and the question it answers — nothing else.
   *
   * It used to carry the sections, the role, the entity and the period. The rail took the sections,
   * and the moment it did, the rest was duplication in adjacent lines: "Group CFO · Kestrel
   * Industrial Group plc" sat directly above a context bar reading "Role: Group CFO · Period: Jul 26
   * · Organisational scope: Kestrel Industrial Group plc", and the period appeared twice within two
   * inches. Repeating a value beside itself does not reinforce it, it teaches a reader that the
   * chrome is decoration and their eye should start lower.
   *
   * So the context bar keeps every one of those, where they are also editable, and what goes here
   * instead is the one thing nothing else said: which of the four questions this page answers. */
  return (
    <>
      {skipLink}
      <Rail path={path} view={view} />
      <header className="masthead">
        <span className="masthead-id">
          <span className="masthead-name">{title}</span>
          {question === undefined ? null : (
            <>
              <br />
              <span className="masthead-sub">{question}</span>
            </>
          )}
        </span>
      </header>
      {pageTitle}
      <ActiveNavScroll />
    </>
  );
}
