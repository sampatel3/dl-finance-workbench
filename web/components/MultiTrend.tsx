/**
 * Four measures on one indexed axis, with the actual values underneath.
 *
 * The chart answers *did they move together*; the table answers *to what*. Neither answers the other,
 * and trying to make one do both is how a dual axis gets added — see `lib/trend.ts` for why that is the
 * one chart shape this product will not draw.
 *
 * ## Lines are labelled at their ends, not in a legend
 *
 * A legend makes a reader look away from the line, hold a colour in their head, and look back. At four
 * series that is four round trips. The label sits at the end of its own line instead, which is also what
 * survives a screenshot printed in greyscale — and the toggles above double as the legend for anyone who
 * wants one.
 */

import type { Unit } from '@kestrel/measures';
import { formatValue } from '@kestrel/measures';

import type { Trend } from '../lib/trend';
import { shortMonthLabel } from '../lib/world';

const W = 720;
const H = 260;
const PAD = { top: 16, right: 96, bottom: 28, left: 44 };

/**
 * Four series distinguished by tone **and** dash, not by tone alone.
 *
 * The palette holds four chart inks, and the fourth (`--series-4`) is near-black — fine as a fill behind
 * a bar, invisible as a 2px line on this background. The first render lost the PAT line entirely.
 *
 * Rather than brighten a token every other chart depends on, the third and fourth series reuse a legible
 * tone and separate by dash pattern. That also survives what tone cannot: a greyscale print, and a reader
 * who cannot distinguish two greys. One accent still leads, which is the brand rule.
 */
const INK = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-2)'];
const DASH = [undefined, undefined, undefined, '2 4'];

export function MultiTrend({ trend }: { readonly trend: Trend }) {
  const indexed = trend.series.flatMap((s) =>
    s.points.map((p) => p.indexed).filter((v): v is number => v !== null),
  );
  if (indexed.length === 0 || trend.months.length < 2) {
    return <p className="chart-empty">No data for this window.</p>;
  }

  /* The axis always contains 100, because 100 is the baseline every line starts from and a chart that
     cropped it would hide whether a series is above or below where it began. */
  const max = Math.max(...indexed, 100);
  const min = Math.min(...indexed, 100);
  const span = max - min || 1;
  const pad = span * 0.12;
  const top = max + pad;
  const bottom = min - pad;

  const x = (i: number) => PAD.left + (i / (trend.months.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + ((top - v) / (top - bottom)) * (H - PAD.top - PAD.bottom);

  return (
    <div className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Indexed trend">
        {/* The 100 line: where every series started. The only gridline worth drawing here. */}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(100)} y2={y(100)} className="chart-base" />
        <text x={PAD.left - 6} y={y(100) + 3} className="chart-axis" textAnchor="end">
          100
        </text>

        {trend.months.map((month, i) =>
          i % 3 === 0 || i === trend.months.length - 1 ? (
            <text key={month} x={x(i)} y={H - 8} className="chart-axis" textAnchor="middle">
              {shortMonthLabel(month)}
            </text>
          ) : null,
        )}

        {/* End labels, nudged apart before anything is drawn.
            Two series ending within a few index points put their labels on top of each other — which
            happened the first time this rendered, with "EBITDA" and "PAT" overprinted into an unreadable
            smudge. Resolved by laying the labels out once, in y order, with a minimum gap. */}
        {(() => {
          const ends = trend.series
            .map((series, i) => {
              const last = [...series.points]
                .map((point, index) => ({ point, index }))
                .reverse()
                .find(({ point }) => point.indexed !== null);
              return last === undefined || last.point.indexed === null
                ? null
                : { short: series.short, i, x: x(last.index), y: y(last.point.indexed) };
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
            .sort((a, b) => a.y - b.y);

          const GAP = 13;
          ends.forEach((entry, index) => {
            const previous = ends[index - 1];
            if (previous !== undefined && entry.y - previous.y < GAP) entry.y = previous.y + GAP;
          });

          return ends.map((entry) => (
            <text
              key={entry.short}
              x={entry.x + 6}
              y={entry.y + 3}
              className="trend-tag"
              fill={INK[Math.min(entry.i, INK.length - 1)]}
            >
              {entry.short}
            </text>
          ));
        })()}

        {trend.series.map((series, seriesIndex) => {
          /* A gap breaks the path rather than bridging it. A straight line drawn through a month with
             no data is a claim about that month. */
          const segments: string[] = [];
          let open = false;
          series.points.forEach((point, i) => {
            if (point.indexed === null) {
              open = false;
              return;
            }
            segments.push(`${open ? 'L' : 'M'}${x(i).toFixed(1)} ${y(point.indexed).toFixed(1)}`);
            open = true;
          });

          return (
            <g key={series.measureId}>
              <path
                d={segments.join(' ')}
                className="chart-line"
                stroke={INK[Math.min(seriesIndex, INK.length - 1)]}
                {...(DASH[Math.min(seriesIndex, DASH.length - 1)] === undefined
                  ? {}
                  : { strokeDasharray: DASH[Math.min(seriesIndex, DASH.length - 1)] })}
              />
            </g>
          );
        })}
      </svg>

      <p className="chart-note">
        Rebased to 100 at {shortMonthLabel(trend.months[0] ?? '')}, so four measures in three units
        share one axis honestly. A second axis would let any two of these be made to look
        correlated. The values themselves are in the table below.
      </p>

      <table className="grid trend-table">
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col" className="num">
              {shortMonthLabel(trend.months[0] ?? '')}
            </th>
            <th scope="col" className="num">
              {shortMonthLabel(trend.months.at(-1) ?? '')}
            </th>
            <th scope="col" className="num">
              Growth
            </th>
          </tr>
        </thead>
        <tbody>
          {trend.series.map((series) => {
            const first = series.points.find((p) => p.value !== null)?.value ?? null;
            const last = [...series.points].reverse().find((p) => p.value !== null)?.value ?? null;
            return (
              <tr key={series.measureId}>
                <th scope="row">{series.label}</th>
                <td className="num">{formatValue(first, series.unit as Unit)}</td>
                <td className="num">{formatValue(last, series.unit as Unit)}</td>
                <td className="num">{formatValue(series.growth, 'percent')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
