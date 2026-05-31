import type { JSX } from "react";

interface Props {
  /** Sizing/positioning class (e.g. the nav badge). Sizes the SVG via width/height. */
  className?: string | undefined;
  /** Explicit pixel size when not driven by a class. */
  size?: number | undefined;
}

/**
 * Shared pixel-art padlock — the single lock visual used for every "locked"
 * affordance (nav items, equipment slots, …). Gold body, dark shackle/keyhole,
 * crisp edges. Size it with `className` (width/height) or the `size` prop.
 */
export function PixelLock({ className, size }: Props): JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 10 10"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {/* shackle */}
      <rect x="3" y="1" width="4" height="1" fill="#2a2228" />
      <rect x="3" y="2" width="1" height="2" fill="#2a2228" />
      <rect x="6" y="2" width="1" height="2" fill="#2a2228" />
      {/* body */}
      <rect x="2" y="4" width="6" height="5" fill="#c98a2e" />
      <rect x="2" y="4" width="6" height="1" fill="#f0c66a" />
      <rect x="2" y="8" width="6" height="1" fill="#8a5a20" />
      {/* keyhole */}
      <rect x="4" y="5" width="2" height="2" fill="#2a2228" />
      <rect x="4" y="7" width="2" height="1" fill="#2a2228" />
    </svg>
  );
}
