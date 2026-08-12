/**
 * The icon set: monoline SVG, drawn on a 16-unit grid, coloured by `currentColor`.
 *
 * **No emoji, anywhere.** They are the single fastest way to make a product demo look
 * cheap: they render differently on every platform, they carry a vendor's illustration
 * style rather than the demo's, and they read as a placeholder that nobody replaced. A
 * two-line SVG path is not more work than typing one, and it inherits the type's colour.
 *
 * One stroke width, one cap style, one grid. An icon set whose members disagree about any of
 * those reads as clip art collected from three places, which is the other way this goes
 * wrong.
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { readonly size?: number };

function Icon({ size = 14, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** A falling series. Used where the demo reports something moving the wrong way. */
export function IconTrendDown(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.8 4.4 6 8.6l2.6-2.6 5.6 5.6" />
      <path d="M14.2 8.4v3.2H11" />
    </Icon>
  );
}

/** A rising series. */
export function IconTrendUp(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.8 11.6 6 7.4l2.6 2.6 5.6-5.6" />
      <path d="M14.2 7.6V4.4H11" />
    </Icon>
  );
}

/** Generated rather than recorded: the mark on anything a model wrote. */
export function IconSparkle(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 1.8 9.5 6 13.8 7.5 9.5 9 8 13.2 6.5 9 2.2 7.5 6.5 6Z" />
    </Icon>
  );
}

/** A closed period. */
export function IconCalendar(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.2" y="3.4" width="11.6" height="10.4" rx="1.6" />
      <path d="M2.2 6.6h11.6M5.6 2.2v2.4M10.4 2.2v2.4" />
    </Icon>
  );
}

/** Where a figure can be gone and looked at. */
export function IconArrowOut(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.2 9.8 13 3M9.4 2.8H13.2v3.8" />
      <path d="M12 9.6v3a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 12.6V5.8a1.6 1.6 0 0 1 1.6-1.6h3" />
    </Icon>
  );
}

/** Nothing was found, or nothing could be looked up. */
export function IconInfo(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 7.2v4M8 5.1v.1" />
    </Icon>
  );
}
