/**
 * The finance context, and the one thing that is not part of it.
 *
 * The context moved into the rail, and splitting it left two components that must not drift back
 * together: {@link ContextPanel} is the settings — role, period, scope, comparator, currency — and
 * `Selectors` is the access refusal, which is not a setting at all. It is the product telling a reader
 * that what they asked for was refused and what they are seeing instead, so it belongs above the
 * figures it describes rather than in a column of controls.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { viewOf } from '../lib/world';
import { ContextPanel, Selectors } from './Selectors';

describe('finance context selector semantics', () => {
  it('separates role, granted access and selected organisational scope', () => {
    const html = renderToStaticMarkup(
      <ContextPanel path="/" view={viewOf({ as: 'gulf-controller' })} />,
    );

    expect(html).toContain('Role:');
    expect(html).toContain('Business-unit controller');
    expect(html).toContain('Role access');
    expect(html).toContain('Kestrel Gulf Technical Services FZ-LLC only');
    expect(html).toContain('Organisational scope:');
    expect(html).not.toContain('Gulf business-unit controller');
  });

  it('names the GBP presentation currency and constant-rate basis explicitly', () => {
    const reported = renderToStaticMarkup(<ContextPanel path="/" view={viewOf({})} />);
    const constant = renderToStaticMarkup(
      <ContextPanel path="/" view={viewOf({ lens: 'constant' })} />,
    );

    expect(reported).toContain('GBP presentation currency');
    expect(constant).toContain('GBP presentation currency · constant rates');
    expect(constant).toContain('Currency basis');
  });

  it('and every control it offers is a link, never component state', () => {
    /* The href *is* the view, which is what makes a context copyable, back-buttonable and
       reproducible from a tour step. A control holding state would break all three at once. */
    const html = renderToStaticMarkup(<ContextPanel path="/" view={viewOf({})} />);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<input');
    expect(html.match(/<a /g)?.length ?? 0).toBeGreaterThan(10);
  });
});

describe('the access refusal is not a setting', () => {
  it('renders nothing where nothing was refused', () => {
    expect(renderToStaticMarkup(<Selectors view={viewOf({})} />)).toBe('');
  });

  it('and names both the refused entity and the one shown instead', () => {
    /* A refusal that does not say what is being shown instead leaves a reader reading someone else's
       figures believing they are their own. */
    const html = renderToStaticMarkup(
      <Selectors view={viewOf({ as: 'gulf-controller', entity: 'manufacturing' })} />,
    );
    expect(html).toContain('Access refused');
    expect(html).toContain('Kestrel Manufacturing Ltd');
    expect(html).toContain('Kestrel Gulf Technical Services FZ-LLC');
  });
});
