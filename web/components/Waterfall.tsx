/**
 * The bridge, as a waterfall.
 *
 * Hand-written SVG, and the reason is not purity. A bridge chart has to say a specific thing — that
 * these bars *sum* to the difference between those two terminals — and a charting library draws bars
 * from a series without knowing that, so the two terminals become two more bars and the claim
 * disappears. Here the terminals are drawn as columns from the axis and the contributions are drawn as
 * floating segments that each start where the last one ended, which is the claim, in the geometry.
 *
 * Three details that are the difference between a bridge and a bar chart:
 *
 *   **The running total is the y-position.** Each contribution's rectangle begins at the cumulative
 *   value before it. So a reader can put a finger on the top of one bar and follow it across.
 *
 *   **Direction is coloured by polarity, not by sign.** A cost bar that rose is a negative
 *   contribution to profit and is painted adverse; on a cost bridge the same arithmetic sign means the
 *   opposite thing. The caller passes `favourableWhen`, because only the caller knows which measure
 *   this is.
 *
 *   **The residual is drawn.** Always, even at zero width, with its label. A decomposition that hides
 *   its residual has explained less than it claims to, and the one time this bridge's residual grew
 *   past the smallest real bar it was because a change elsewhere had quietly moved intercompany trade.
 *
 * The zero line is drawn only when the data crosses it, because a floating axis on a chart whose bars
 * are all positive is a line a reader has to account for and cannot.
 */

import type { Bridge, BridgeBar } from '@kestrel/analysis';
import { formatValue } from '@kestrel/measures';

const WIDTH = 760;
const HEIGHT = 300;
const PAD = { top: 18, right: 12, bottom: 52, left: 12 };

/** A terminal is a column from the axis; a contribution floats. */
const isTerminal = (bar: BridgeBar): boolean => bar.kind === 'opening' || bar.kind === 'closing';

export function Waterfall({
  bridge,
  favourableWhen = 'up',
  title,
}: {
  readonly bridge: Bridge;
  /** Which direction of contribution is good news for the measure being bridged. */
  readonly favourableWhen?: 'up' | 'down';
  readonly title?: string;
}) {
  const bars = bridge.bars;
  if (bars.length === 0) return null;

  // Walk the bars once to find every y-value the chart will draw: the two terminals, and the running
  // total before and after each contribution. The extent has to include the intermediate tops, or a
  // bridge that overshoots its closing value and comes back is clipped.
  let running = 0;
  const geometry = bars.map((bar) => {
    if (isTerminal(bar)) return { bar, from: 0, to: bar.value };
    const from = running;
    running += bar.value;
    return { bar, from, to: running };
  });
  // Terminals are absolute, so seed the walk at the opening value rather than at zero.
  const opening = bars.find((b) => b.kind === 'opening')?.value ?? 0;
  running = opening;
  const walked = bars.map((bar) => {
    if (isTerminal(bar)) return { bar, from: 0, to: bar.value };
    const from = running;
    running += bar.value;
    return { bar, from, to: running };
  });
  void geometry;

  const values = walked.flatMap(({ from, to }) => [from, to]);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const plotW = WIDTH - PAD.left - PAD.right;
  const y = (value: number): number => PAD.top + ((max - value) / span) * plotH;

  const slot = plotW / walked.length;
  const barW = Math.min(slot * 0.62, 64);
  const crossesZero = min < 0 && max > 0;

  return (
    <figure className="chart">
      {title === undefined ? null : <figcaption className="chart-title">{title}</figcaption>}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg"
        role="img"
        aria-label={`${bridge.label} from ${formatValue(bridge.from, 'currency')} to ${formatValue(bridge.to, 'currency')}`}
      >
        {crossesZero ? (
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} className="chart-axis" />
        ) : null}

        {walked.map(({ bar, from, to }, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const top = Math.min(y(from), y(to));
          const height = Math.max(Math.abs(y(to) - y(from)), 1.5);
          const terminal = isTerminal(bar);
          const rising = to >= from;
          const good = favourableWhen === 'up' ? rising : !rising;
          const cls = terminal
            ? 'wf-terminal'
            : bar.kind === 'other'
              ? 'wf-residual'
              : good
                ? 'wf-pos'
                : 'wf-neg';

          return (
            <g key={`${bar.kind}-${i}`}>
              {/* The connector to the next bar, drawn first so a rectangle always sits on top of it. */}
              {i < walked.length - 1 ? (
                <line
                  x1={cx + barW / 2}
                  x2={PAD.left + slot * (i + 1) + slot / 2 - barW / 2}
                  y1={y(terminal ? bar.value : to)}
                  y2={y(terminal ? bar.value : to)}
                  className="wf-link"
                />
              ) : null}
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={height}
                className={cls}
                rx="1.5"
              />
              <text x={cx} y={top - 6} className="wf-value" textAnchor="middle">
                {terminal
                  ? formatValue(bar.value, 'currency')
                  : `${bar.value < 0 ? '−' : '+'}${formatValue(Math.abs(bar.value), 'currency')}`}
              </text>
              <text x={cx} y={HEIGHT - PAD.bottom + 18} className="wf-label" textAnchor="middle">
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="chart-note">
        {bridge.sums
          ? `The bars sum to the movement exactly. Residual ${formatValue(bridge.residual, 'currency')}.`
          : 'These bars do not sum to the movement — the decomposition is incomplete.'}
      </p>
    </figure>
  );
}
