/**
 * One month, four sites, ranked.
 *
 * The bar and the figure beside it say the same thing twice on purpose: the bar is for
 * comparing at a glance and the figure is for quoting, and a chart that offers only the
 * first forces a reader to guess at a number they are about to repeat out loud.
 *
 * Widths are percentages of the largest value, so the row layout is CSS and there is no
 * measurement to do on the client.
 */

import { units } from '../lib/format';
import { ranked, type World } from '../lib/world';

export function Bars({ world, month }: { world: World; month: string }) {
  const rows = ranked(world, month);
  const max = rows.reduce((top, entry) => Math.max(top, entry.row.volume), 0);

  return (
    <div className="bars">
      {rows.map(({ site, row }) => (
        <div className="bar-row" key={site.id}>
          <span className="bar-name">{site.name}</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: `${max === 0 ? 0 : Math.round((row.volume / max) * 100)}%` }}
            />
          </span>
          <span className="bar-value">{units(row.volume)}</span>
        </div>
      ))}
    </div>
  );
}
