/**
 * The chrome every surface shares: the masthead and its navigation.
 *
 * Extracted once there were more than two surfaces. It had been copied into each page, which was
 * tolerable at two and is how a nav ends up with a different set of links on different pages at seven —
 * the failure being invisible from any single page.
 *
 * The nav is generated from one list, so a surface that exists is reachable and a surface that is not
 * in the list is not silently unreachable: it is absent from the list, which is a thing a reader of this
 * file can see.
 */

import { entity } from '@kestrel/model';

import { DEMO_MARK, DEMO_NAME } from '../lib/demo';
import type { View } from '../lib/world';
import { hrefFor, scopeLabel } from '../lib/world';
import { ActiveNavScroll } from './ActiveNavScroll';

/** Every surface, in the order a reader meets them: executive, then analyst, then governance. */
export const SURFACES = [
  { path: '/app', label: 'Overview', ariaLabel: 'Overview' },
  {
    path: '/app/performance',
    label: 'Performance',
    ariaLabel: 'Performance — variance analysis',
  },
  { path: '/app/explore', label: 'Explore', ariaLabel: 'Explore — data explorer' },
  { path: '/app/forecast', label: 'Forecast', ariaLabel: 'Forecast planning' },
  { path: '/app/cash', label: 'Cash', ariaLabel: 'Cash and liquidity' },
  { path: '/app/quality', label: 'Forecast accuracy', ariaLabel: 'Forecast accuracy' },
  { path: '/app/scenarios', label: 'Scenarios', ariaLabel: 'Scenarios — scenario planning' },
  {
    path: '/app/commentary',
    label: 'Commentary',
    ariaLabel: 'Commentary — reporting approvals',
  },
  { path: '/app/controls', label: 'Controls', ariaLabel: 'Controls and governance' },
] as const;

export function Masthead({ path, view }: { readonly path: string; readonly view: View }) {
  const title = SURFACES.find((surface) => surface.path === path)?.label ?? DEMO_NAME;
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
          <nav className="inner-surface-nav" aria-label="Finance workbench sections">
            {SURFACES.map((surface) => {
              const active = surface.path === path;
              return (
                <a
                  key={surface.path}
                  className={`nav-link${active ? ' is-active' : ''}`}
                  href={hrefFor(surface.path, view)}
                  aria-label={surface.ariaLabel}
                  {...(active ? { 'aria-current': 'page' as const } : {})}
                >
                  {surface.label}
                </a>
              );
            })}
          </nav>
        ) : null}
        {pageTitle}
        <ActiveNavScroll />
      </>
    );
  }

  return (
    <>
      {skipLink}
      <header className="masthead">
        <span className="masthead-mark" aria-hidden>
          {DEMO_MARK}
        </span>
        <span className="masthead-id">
          <span className="masthead-name">{DEMO_NAME}</span>
          <br />
          <span className="masthead-sub">
            {view.principal.label} · {entity(view.entityId).name}
          </span>
        </span>
        <nav className="masthead-nav" aria-label="Finance workbench sections">
          {SURFACES.map((surface) => {
            const active = surface.path === path;
            return (
              <a
                key={surface.path}
                className={`nav-link${active ? ' is-active' : ''}`}
                href={hrefFor(surface.path, view)}
                aria-label={surface.ariaLabel}
                {...(active ? { 'aria-current': 'page' as const } : {})}
              >
                {surface.label}
              </a>
            );
          })}
        </nav>
        <span className="masthead-right">{scopeLabel(view.periodKind, view.scope)}</span>
      </header>
      {pageTitle}
      <ActiveNavScroll />
    </>
  );
}
