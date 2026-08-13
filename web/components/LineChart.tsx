/**
 * A dual line: a measure over months, against its comparative.
 *
 * Hand-written, for the same reason as the waterfall — but the specific thing a library gets wrong here
 * is `null`. A missing month is not a zero, and every charting library's default is to either plot it at
 * the axis or silently join the gap, both of which are claims about data that does not exist. Here a run
 * of present points is one path, and a gap ends the path and starts a new one, so a hole in the series
 * looks like a hole.
 *
 * The comparative is drawn first and dashed, so the actual reads as the subject rather than as one of
 * two equal lines. Neither line is coloured by direction: a series is not good or bad, and painting the
 * whole line green because the last point rose is the chart equivalent of colouring by sign.
 */

import type { Unit } from '@kestrel/measures';
import { formatValue } from '@kestrel/measures';
import type { FiscalMonth } from '@kestrel/model';

import { shortMonthLabel } from '../lib/world';

const WIDTH = 760;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 34, left: 68 };

export interface SeriesPoint {
  readonly month: FiscalMonth;
  readonly value: number | null;
  readonly comparative?: number | null;
}

/** Contiguous runs of present values, as `[x, y]` pairs. A gap breaks the run. */
function runs(
  points: readonly SeriesPoint[],
  pick: (p: SeriesPoint) => number | null | undefined,
  x: (i: number) => number,
  y: (v: number) => number,
): string[] {
  const paths: string[] = [];
  let current: string[] = [];
  points.forEach((point, i) => {
    const value = pick(point);
    if (value === null || value === undefined) {
      if (current.length > 1) paths.push(current.join(' '));
      current = [];
      return;
    }
    current.push(`${current.length === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(value).toFixed(1)}`);
  });
  if (current.length > 1) paths.push(current.join(' '));
  return paths;
}

export function LineChart({
  points,
  unit,
  label,
  comparativeLabel,
  title,
}: {
  readonly points: readonly SeriesPoint[];
  readonly unit: Unit;
  readonly label: string;
  readonly comparativeLabel?: string;
  readonly title?: string;
}) {
  const values = points.flatMap((p) =>
    [p.value, p.comparative].filter((v): v is number => v !== null && v !== undefined),
  );
  if (values.length === 0) {
    return <p className="chart-empty">No data for this window.</p>;
  }

  // The axis includes zero for a currency measure and does not for a percentage. A margin chart zoomed
  // to its own range shows the movement a reader is looking for; a revenue chart that excludes zero
  // makes a 3% rise look like a doubling, which is the chart that gets screenshotted and misread.
  const includeZero = unit === 'currency' || unit === 'count' || unit === 'hours';
  const rawMax = Math.max(...values, includeZero ? 0 : -Infinity);
  const rawMin = Math.min(...values, includeZero ? 0 : Infinity);
  const headroom = (rawMax - rawMin) * 0.08 || Math.abs(rawMax) * 0.08 || 1;
  const max = rawMax + headroom;
  const min = includeZero ? Math.min(0, rawMin) : rawMin - headroom;
  const span = max - min || 1;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number): number =>
    PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number): number => PAD.top + ((max - v) / span) * plotH;

  const ticks = [max, min + span / 2, min];
  // Every third month, and always the last one: twelve labels on this width overlap into a grey band.
  const labelled = points.map((_, i) => i % 3 === 0 || i === points.length - 1);

  return (
    <figure className="chart">
      {title === undefined ? null : <figcaption className="chart-title">{title}</figcaption>}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg"
        role="img"
        aria-label={title ?? label}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className="chart-grid"
            />
            <text x={PAD.left - 8} y={y(tick) + 4} className="chart-tick" textAnchor="end">
              {formatValue(tick, unit)}
            </text>
          </g>
        ))}

        {runs(points, (p) => p.comparative, x, y).map((d, i) => (
          <path key={`c${i}`} d={d} className="line-comparative" />
        ))}
        {runs(points, (p) => p.value, x, y).map((d, i) => (
          <path key={`a${i}`} d={d} className="line-actual" />
        ))}

        {points.map((point, i) =>
          point.value === null ? null : (
            <circle key={point.month} cx={x(i)} cy={y(point.value)} r="2.4" className="line-dot" />
          ),
        )}

        {points.map((point, i) =>
          labelled[i] === true ? (
            <text
              key={point.month}
              x={x(i)}
              y={HEIGHT - 12}
              className="chart-tick"
              textAnchor="middle"
            >
              {shortMonthLabel(point.month)}
            </text>
          ) : null,
        )}
      </svg>
      <p className="chart-legend">
        <span className="key key-actual" /> {label}
        {comparativeLabel === undefined ? null : (
          <>
            <span className="key key-comparative" /> {comparativeLabel}
          </>
        )}
      </p>
    </figure>
  );
}
