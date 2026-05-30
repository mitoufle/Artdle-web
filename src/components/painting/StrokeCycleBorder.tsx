import type { JSX, CSSProperties } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { useGameStore } from "@/store";
import { PLAYER_ID } from "@/core/canvasTickPure";
import styles from "./StrokeCycleBorder.module.css";

interface Props {
  /** Player seconds-per-stroke (chunkInterval(speedMult)). Low-frequency. */
  interval: number;
}

const CORNER_RADIUS = 10;
const STROKE_INSET = 1; // keep the 2px stroke inside the box

/** Rounded-rect perimeter path starting at TOP-CENTER, going clockwise. Real px
 *  coords (measured), so the dash advances uniformly along the edge — no conic
 *  angle distortion and no viewBox stretch. */
function ringPath(w: number, h: number, r: number): string {
  const x0 = STROKE_INSET, y0 = STROKE_INSET, x1 = w - STROKE_INSET, y1 = h - STROKE_INSET;
  if (x1 - x0 <= 0 || y1 - y0 <= 0) return "";
  const rr = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  const cx = (x0 + x1) / 2;
  return [
    `M ${cx} ${y0}`,                          // start: top-center
    `H ${x1 - rr}`,                           // top edge → top-right corner
    `A ${rr} ${rr} 0 0 1 ${x1} ${y0 + rr}`,
    `V ${y1 - rr}`,                           // right edge
    `A ${rr} ${rr} 0 0 1 ${x1 - rr} ${y1}`,
    `H ${x0 + rr}`,                           // bottom edge
    `A ${rr} ${rr} 0 0 1 ${x0} ${y1 - rr}`,
    `V ${y0 + rr}`,                           // left edge
    `A ${rr} ${rr} 0 0 1 ${x0 + rr} ${y0}`,
    `Z`,                                      // close along the top-left half back to center
  ].join(" ");
}

/**
 * Golden border around the upgrade panel that grows UNIFORMLY clockwise from the
 * TOP-CENTER with the PLAYER's stroke cycle, then snaps back on each stroke.
 *
 * An SVG `<path>` (rounded rect, measured in px, starting at top-center) with
 * `pathLength={1}` + `stroke-dasharray={`${fill} 1`}`: the visible arc is exactly
 * `fill` of the perimeter and advances at constant edge-speed regardless of the
 * panel's aspect ratio. SELF-SUBSCRIBES to the player's `painterClocks` entry
 * (high-freq) so the panel + pills don't re-render every tick. Click-through.
 */
export function StrokeCycleBorder({ interval }: Props): JSX.Element {
  const clock = useGameStore((s) => s.painterClocks[PLAYER_ID] ?? 0);
  const fillPct = interval > 0 ? Math.max(0, Math.min(1, clock / interval)) : 0;

  const ref = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const d = ringPath(size.w, size.h, CORNER_RADIUS);
  return (
    <svg
      ref={ref}
      className={styles.svg}
      data-testid="stroke-cycle-border"
      aria-hidden="true"
      viewBox={`0 0 ${size.w} ${size.h}`}
    >
      <path className={styles.track} d={d} />
      <path
        className={styles.progress}
        d={d}
        pathLength={1}
        data-testid="stroke-cycle-fill"
        data-fill={fillPct}
        style={{ strokeDasharray: `${fillPct} 1` } as CSSProperties}
      />
    </svg>
  );
}
