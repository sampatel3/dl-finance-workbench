/**
 * Twelve months, four lines, hand-written SVG.
 *
 * There is no charting library in this demo and that is a decision, not an omission
 * (01-decisions.md §16). A line chart is a path built from a scale; a library brings a
 * runtime, a theming layer and a set of defaults that will not match the tokens, in exchange
 * for arithmetic that fits on this page. It also renders on the server with no client
 * JavaScript at all, which is why the tour's screenshots of it are never caught mid-hydration.
 *
 * The chart is drawn in viewBox units and stretched by CSS, so the same markup holds its
 * proportions on a 1280pt desktop and a 402pt phone.
 */

import type { Month, World } from '../lib/world';

/* The viewBox. Wide enough that a 9px axis label is legible when the chart is shown at a
   phone's width, which is the narrowest place it appears. */
const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 22, left: 40 };

/**
 * Series colours, as token names rather than values.
 *
 * The values live in `globals.css`, in both treatments. A hex literal written here is a
 * colour the dark surface cannot reach, and four hues tuned against a white canvas go muddy
 * on a near-black one — so the chart names its ink and the stylesheet decides what it is.
 */
const INK = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

export function SeriesChart({
  world,
  months,
}: {
  world: World;
  months: readonly Month[];
}) {
  const values = world.sites.flatMap((s) => s.months.map((m) => m.volume));
  const max = Math.max(...values);
  const min = Math.min(...values);
  /* Padded by a tenth of the range so the highest line is not drawn on the frame and the
     lowest is not drawn on the axis. A chart whose extremes touch its edges reads as clipped. */
  const head = (max - min) * 0.1 || 1;
  const top = max + head;
  const bottom = Math.max(0, min - head);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (index: number) =>
    PAD.left + (months.length <= 1 ? 0 : (index / (months.length - 1)) * plotW);
  const y = (value: number) => PAD.top + plotH - ((value - bottom) / (top - bottom)) * plotH;

  /* Four gridlines, labelled. Fewer and the reader cannot place a line; more and the grid
     starts competing with the data for attention. */
  const ticks = [0, 1, 2, 3].map((i) => bottom + ((top - bottom) * i) / 3);

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly dispatched volume by site">
        {ticks.map((value) => (
          <g key={value}>
            <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} />
            <text className="chart-axis" x={PAD.left - 6} y={y(value) + 3} textAnchor="end">
              {Math.round(value)}
            </text>
          </g>
        ))}

        {months.map((month, i) =>
          /* Every other month, or the labels collide at a phone's width. */
          i % 2 === 0 ? (
            <text key={month.id} className="chart-axis" x={x(i)} y={H - 6} textAnchor="middle">
              {month.label}
            </text>
          ) : null,
        )}

        {world.sites.map((site, si) => (
          <path
            key={site.id}
            className="chart-line"
            stroke={INK[si % INK.length]}
            d={site.months.map((row, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(row.volume)}`).join(' ')}
          />
        ))}
      </svg>

      <div className="legend">
        {world.sites.map((site, si) => (
          <span className="legend-item" key={site.id}>
            <span className="legend-swatch" style={{ background: INK[si % INK.length] }} />
            {site.name}
          </span>
        ))}
      </div>
    </>
  );
}
