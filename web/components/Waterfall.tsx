/**
 * The bridge, as a waterfall.
 *
 * Hand-written SVG, and the reason is not purity. A bridge has to say a specific thing — that these
 * bars *sum* to the difference between those two terminals — and a charting library draws bars from a
 * series without knowing that, so the terminals become two more bars and the claim disappears. Here the
 * terminals are level markers and the contributions are floating segments that each begin where the last
 * one ended, which is the claim, in the geometry.
 *
 * ## The axis does not start at zero, and says so
 *
 * The first version of this chart was zero-based, and it was useless. Revenue moved from £11.8m to
 * £12.4m, so every contribution — the entire content of the chart — was a two-pixel sliver at the top
 * of two near-identical full-height columns. A bridge whose bars cannot be seen has explained nothing,
 * which is the same failure as a decomposition that does not sum, arrived at through layout instead of
 * arithmetic.
 *
 * So the axis is scaled to the **walk**: the terminals and every running total between them, padded.
 * That makes the contributions legible and makes the two end columns no longer proportional to their
 * values — a real cost, and the reason the floor is drawn and labelled rather than left implied. A
 * truncated axis that announces itself is a reading aid; one that hides is the most common way a chart
 * lies. The note under the chart says it in words as well.
 *
 * ## Terminals are markers, not columns
 *
 * The obvious drawing is a full-height column for each terminal. On a truncated axis that is a lie, and
 * a loud one: the opening at £11.8m and the closing at £12.4m are five per cent apart, and drawn from a
 * floor of £11.7m they came out at a tenth and four-fifths of the plot height. Two figures that are
 * nearly equal looked like a tripling. That is worse than the sliver problem it replaced, because a
 * sliver is merely unreadable and this was readable and wrong.
 *
 * So a terminal is a level marker — a slim neutral bar at its own value — and the connectors carry the
 * eye from one to the next. Nothing in the chart now claims a proportion the axis cannot support.
 *
 * ## Two scales, because there are two kinds of quantity here
 *
 * `formatValue` picks thousands or millions from a value's own magnitude, which is right in a table and
 * wrong on one axis: it put `−£8,055.29` beside `−£19k`. But forcing *one* scale across the whole chart
 * is wrong too, and worse — the terminals are a hundred times the contributions, so a shared scale
 * rendered every contribution as `£0.0m`. Levels and movements are different quantities. The terminals
 * take the scale of a level, the contributions share a scale chosen from the contributions alone.
 *
 * ## Direction is coloured by polarity, not sign
 *
 * A cost bar that rose is a negative contribution to profit and is painted adverse; on a cost bridge the
 * same arithmetic sign means the opposite. `favourableWhen` is passed in, because only the caller knows
 * which measure this is.
 */

import type { Bridge, BridgeBar } from '@kestrel/analysis';
import type { FormatOptions } from '@kestrel/measures';
import { formatValue } from '@kestrel/measures';

const WIDTH = 780;
const HEIGHT = 320;
const PAD = { top: 30, right: 14, bottom: 54, left: 14 };

/** A terminal is a level marker; a contribution floats between two running totals. */
const isTerminal = (bar: BridgeBar): boolean => bar.kind === 'opening' || bar.kind === 'closing';

/** The scale every label on one chart shares, chosen from the largest value on it. */
function sharedScale(values: readonly number[]): FormatOptions['scale'] {
  const largest = Math.max(...values.map(Math.abs), 0);
  if (largest >= 100_000_000) return 'millions';
  if (largest >= 1_000_000) return 'thousands';
  return 'unit';
}

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

  /* Walk once: a terminal sits at its own value, a contribution spans from the running total before it
     to the running total after. Seeded at the opening rather than at zero, because the first
     contribution begins where the opening column ends. */
  let running = bars.find((b) => b.kind === 'opening')?.value ?? 0;
  const walked = bars.map((bar) => {
    if (isTerminal(bar)) return { bar, from: bar.value, to: bar.value };
    const from = running;
    running += bar.value;
    return { bar, from, to: running };
  });

  /* The extent covers every y the chart draws, including the intermediate tops — a bridge that
     overshoots its closing value and comes back would otherwise be clipped. */
  const levels = walked.flatMap(({ from, to }) => [from, to]);
  const low = Math.min(...levels);
  const high = Math.max(...levels);
  /* A tenth of the range, so the tallest bar's label has somewhere to sit and the floor is visibly a
     floor rather than the edge of the box. */
  const pad = (high - low) * 0.12 || Math.abs(high) * 0.05 || 1;
  const max = high + pad;
  const min = low - pad;
  const span = max - min || 1;

  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const plotW = WIDTH - PAD.left - PAD.right;
  const floorY = PAD.top + plotH;
  const y = (value: number): number => PAD.top + ((max - value) / span) * plotH;

  const slot = plotW / walked.length;
  const barW = Math.min(slot * 0.56, 58);
  /* A terminal's marker height. Fixed in pixels on purpose: it is a position, not a magnitude, so it
     must not vary with the value it marks. */
  const MARKER_H = 9;

  /* One scale for the levels, another for the movements. See the header. */
  const levelScale = sharedScale(walked.filter((w) => isTerminal(w.bar)).map((w) => w.bar.value));
  const moveScale = sharedScale(walked.filter((w) => !isTerminal(w.bar)).map((w) => w.bar.value));
  const at = (value: number, scale: FormatOptions['scale'], signed = false): string =>
    formatValue(value, 'currency', { scale, signed, places: scale === 'unit' ? 0 : undefined });
  const level = (value: number): string => at(value, levelScale);
  const move = (value: number): string => at(value, moveScale, true);

  return (
    <figure className="chart">
      {title === undefined ? null : <figcaption className="chart-title">{title}</figcaption>}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg"
        role="img"
        aria-label={`${bridge.label} from ${level(bridge.from)} to ${level(bridge.to)}, decomposed`}
      >
        {/* The floor, labelled. It is not zero, and a reader has to be able to see that. */}
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={floorY} y2={floorY} className="chart-axis" />
        <text x={PAD.left} y={floorY + 15} className="wf-floor">
          {level(min)}
        </text>

        {walked.map(({ bar, from, to }, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const terminal = isTerminal(bar);
          const top = terminal ? y(bar.value) - MARKER_H / 2 : Math.min(y(from), y(to));
          const height = terminal ? MARKER_H : Math.max(Math.abs(y(to) - y(from)), 2);
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
              {/* Drawn first, so a rectangle always sits on top of the connector. */}
              {i < walked.length - 1 ? (
                <line
                  x1={cx + barW / 2}
                  x2={PAD.left + slot * (i + 1) + slot / 2 - barW / 2}
                  y1={y(to)}
                  y2={y(to)}
                  className="wf-link"
                />
              ) : null}
              <rect x={cx - barW / 2} y={top} width={barW} height={height} className={cls} rx="1" />
              <text x={cx} y={top - 8} className="wf-value" textAnchor="middle">
                {terminal ? level(bar.value) : move(bar.value)}
              </text>
              <text x={cx} y={floorY + 32} className="wf-label" textAnchor="middle">
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="chart-note">
        {bridge.sums
          ? `The bars sum to the movement exactly — residual ${move(bridge.residual)}.`
          : 'These bars do not sum to the movement, so the decomposition is incomplete.'}{' '}
        The axis starts at {level(min)} rather than zero, so the contributions are legible. The two
        terminals are drawn as level markers rather than columns, because on a truncated axis a
        column height is not a proportion.
      </p>
    </figure>
  );
}
