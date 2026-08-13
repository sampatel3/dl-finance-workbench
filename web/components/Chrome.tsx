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

/** Every surface, in the order a reader meets them: executive, then analyst, then governance. */
export const SURFACES = [
  { path: '/app', label: 'Overview' },
  { path: '/app/performance', label: 'Performance' },
  { path: '/app/explore', label: 'Explore' },
  { path: '/app/forecast', label: 'Forecast' },
  { path: '/app/cash', label: 'Cash' },
  { path: '/app/quality', label: 'Quality' },
  { path: '/app/scenarios', label: 'Scenarios' },
  { path: '/app/commentary', label: 'Commentary' },
  { path: '/app/controls', label: 'Controls' },
] as const;

export function Masthead({ path, view }: { readonly path: string; readonly view: View }) {
  if (view.inner) {
    if (!view.surfaceNav) return null;
    return (
      <nav className="inner-surface-nav" aria-label="Surfaces">
        {SURFACES.map((surface) => {
          const active = surface.path === path;
          return (
            <a
              key={surface.path}
              className={`nav-link${active ? ' is-active' : ''}`}
              href={hrefFor(surface.path, view)}
              {...(active ? { 'aria-current': 'page' as const } : {})}
            >
              {surface.label}
            </a>
          );
        })}
      </nav>
    );
  }

  return (
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
      <nav className="masthead-nav" aria-label="Surfaces">
        {SURFACES.map((surface) => {
          const active = surface.path === path;
          return (
            <a
              key={surface.path}
              className={`nav-link${active ? ' is-active' : ''}`}
              href={hrefFor(surface.path, view)}
              {...(active ? { 'aria-current': 'page' as const } : {})}
            >
              {surface.label}
            </a>
          );
        })}
      </nav>
      <span className="masthead-right">{scopeLabel(view.periodKind, view.scope)}</span>
    </header>
  );
}
