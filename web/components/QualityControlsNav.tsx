import type { View } from '../lib/world';
import { hrefFor } from '../lib/world';

/** Two specialist views under one finance-domain destination. */
export function QualityControlsNav({ active, view }: { readonly active: 'quality' | 'controls'; readonly view: View }) {
  return (
    <nav className="domain-switch" aria-label="Quality and controls views">
      <a
        className={`chip-link${active === 'quality' ? ' is-active' : ''}`}
        href={hrefFor('/app/quality', view)}
        aria-current={active === 'quality' ? 'page' : undefined}
      >
        Forecast bias &amp; accuracy
      </a>
      <a
        className={`chip-link${active === 'controls' ? ' is-active' : ''}`}
        href={hrefFor('/app/controls', view)}
        aria-current={active === 'controls' ? 'page' : undefined}
      >
        Data &amp; controls
      </a>
    </nav>
  );
}
