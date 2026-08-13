import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { viewOf } from '../lib/world';
import { Selectors } from './Selectors';

describe('finance context selector semantics', () => {
  it('separates role, granted access and selected organisational scope', () => {
    const html = renderToStaticMarkup(
      <Selectors path="/app" view={viewOf({ as: 'gulf-controller' })} />,
    );

    expect(html).toContain('Role:');
    expect(html).toContain('Business-unit controller');
    expect(html).toContain('Role access');
    expect(html).toContain('Kestrel Gulf Technical Services FZ-LLC only');
    expect(html).toContain('Organisational scope:');
    expect(html).not.toContain('Gulf business-unit controller');
  });

  it('names the GBP presentation currency and constant-rate basis explicitly', () => {
    const reported = renderToStaticMarkup(<Selectors path="/app" view={viewOf({})} />);
    const constant = renderToStaticMarkup(
      <Selectors path="/app" view={viewOf({ lens: 'constant' })} />,
    );

    expect(reported).toContain('GBP presentation currency');
    expect(constant).toContain('GBP presentation currency · constant rates');
    expect(constant).toContain('Currency basis');
  });
});
