/**
 * The thirteen-week cash forecast, as columns with a floor line.
 *
 * The one chart in this product where the *shape* is the finding. A cash forecast rendered as a table of
 * thirteen closing balances is thirteen numbers a reader has to compare in their head; rendered as
 * columns against the board's floor, the week that breaches is the week their eye lands on. That is the
 * whole argument for drawing it.
 *
 * Receipts and payments are drawn as opposed columns from the axis rather than as one net bar, because
 * a net figure hides the thing a treasurer needs: a week that nets to zero because £2m came in and £2m
 * went out is not a quiet week. The closing balance rides over the top as a line, so the level and the
 * flows are readable together.
 *
 * The floor is a labelled line, not a background band. A band reads as a tolerance; a line reads as a
 * commitment, which is what a board minute is.
 */

import type { DirectForecast } from '@kestrel/analysis';
import { MINIMUM_CASH } from '@kestrel/analysis';
import { formatValue } from '@kestrel/measures';

const WIDTH = 760;
const HEIGHT = 300;
const PAD = { top: 20, right: 16, bottom: 46, left: 72 };

export function CashColumns({
  forecast,
  title,
}: {
  readonly forecast: DirectForecast;
  readonly title?: string;
}) {
  const weeks = forecast.weeks;
  if (weeks.length === 0) return null;

  const floor = MINIMUM_CASH.amountMinor;
  const balances = [forecast.opening, ...weeks.map((w) => w.closing)];
  const flows = weeks.flatMap((w) => [w.receipts, -w.payments]);

  // One scale for both, so a column's height and the balance line's height mean the same thing. Two
  // scales would let a small flow look like a large one beside a line it is meant to explain.
  const max = Math.max(...balances, ...flows, floor);
  const min = Math.min(...balances, ...flows, 0);
  const span = max - min || 1;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / weeks.length;
  const colW = Math.min(slot * 0.34, 18);
  const y = (v: number): number => PAD.top + ((max - v) / span) * plotH;
  const centre = (i: number): number => PAD.left + slot * i + slot / 2;

  const balancePath = balances
    .map((value, i) => {
      // The opening balance sits at the left edge; each closing balance sits at its week's centre.
      const px = i === 0 ? PAD.left : centre(i - 1);
      return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${y(value).toFixed(1)}`;
    })
    .join(' ');

  const breach = forecast.breach;

  return (
    <figure className="chart">
      {title === undefined ? null : <figcaption className="chart-title">{title}</figcaption>}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg"
        role="img"
        aria-label={`Thirteen-week cash forecast, low point ${formatValue(forecast.low.amount, 'currency')}`}
      >
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} className="chart-axis" />

        {/* The breached week, marked behind everything so it reads as context rather than as a bar. */}
        {breach === undefined ? null : (
          <rect
            x={PAD.left + slot * (breach.index - 1)}
            y={PAD.top}
            width={slot}
            height={plotH}
            className="cash-breach-band"
          />
        )}

        {weeks.map((week, i) => (
          <g key={week.week}>
            <rect
              x={centre(i) - colW}
              y={y(week.receipts)}
              width={colW}
              height={Math.max(y(0) - y(week.receipts), 1)}
              className="cash-receipt"
            />
            <rect
              x={centre(i)}
              y={y(0)}
              width={colW}
              height={Math.max(y(-week.payments) - y(0), 1)}
              className="cash-payment"
            />
            <text
              x={centre(i)}
              y={HEIGHT - PAD.bottom + 30}
              className="chart-tick"
              textAnchor="middle"
            >
              {week.index}
            </text>
          </g>
        ))}

        <path d={balancePath} className="cash-balance" />

        {/* The floor last, so it is never hidden by a column. */}
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={y(floor)}
          y2={y(floor)}
          className="cash-floor"
        />
        <text x={WIDTH - PAD.right} y={y(floor) - 6} className="cash-floor-label" textAnchor="end">
          Board floor {formatValue(floor, 'currency')}
        </text>
      </svg>
      <p className="chart-legend">
        <span className="key key-receipt" /> Receipts
        <span className="key key-payment" /> Payments
        <span className="key key-balance" /> Closing balance
        <span className="chart-note-inline">Week number along the axis.</span>
      </p>
    </figure>
  );
}
