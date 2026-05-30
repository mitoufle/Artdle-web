import { VIEWBOX, CLUSTER_REGIONS } from "./nodeLayout";

export interface ViewportState {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/**
 * First-open zoom. The cluster sky spans the full VIEWBOX (~4× the old single
 * tree), so at zoom 1 the nodes render as tiny scattered dots. Frame the starter
 * (Inspiration) cluster instead so the player lands on a legible entry point and
 * pans out to discover the other constellations.
 */
const DEFAULT_ZOOM = 2.2;

function framedStart(): ViewportState {
  const start = CLUSTER_REGIONS.find((c) => c.id === "inspiration")?.region;
  const cx = start ? start.x + start.w / 2 : VIEWBOX.width / 2;
  const cy = start ? start.y + start.h / 2 : VIEWBOX.height / 2;
  const w = VIEWBOX.width / DEFAULT_ZOOM;
  const h = VIEWBOX.height / DEFAULT_ZOOM;
  return { zoom: DEFAULT_ZOOM, panX: cx - w / 2, panY: cy - h / 2 };
}

export const DEFAULT_VIEWPORT: ViewportState = Object.freeze(framedStart());
const PAN_BLEED = 1;

export function clampZoom(zoom: number): number {
  if (zoom < MIN_ZOOM) return MIN_ZOOM;
  if (zoom > MAX_ZOOM) return MAX_ZOOM;
  return zoom;
}

export function clampPan(
  panX: number,
  panY: number,
  zoom: number,
): { panX: number; panY: number } {
  const w = VIEWBOX.width / zoom;
  const h = VIEWBOX.height / zoom;
  const bleedX = VIEWBOX.width * PAN_BLEED;
  const bleedY = VIEWBOX.height * PAN_BLEED;
  const minPanX = -w / 2 - bleedX;
  const maxPanX = VIEWBOX.width - w / 2 + bleedX;
  const minPanY = -h / 2 - bleedY;
  const maxPanY = VIEWBOX.height - h / 2 + bleedY;
  return {
    panX: Math.min(Math.max(panX, minPanX), maxPanX),
    panY: Math.min(Math.max(panY, minPanY), maxPanY),
  };
}

/**
 * Zoom while keeping the SVG point (svgX, svgY) stationary under the cursor.
 * `factor` is the multiplicative change in zoom (e.g., 1.1 = zoom in 10%).
 */
export function zoomAt(
  state: ViewportState,
  svgX: number,
  svgY: number,
  factor: number,
): ViewportState {
  const newZoom = clampZoom(state.zoom * factor);
  if (newZoom === state.zoom) return state;
  const newPanX = svgX - (svgX - state.panX) * (state.zoom / newZoom);
  const newPanY = svgY - (svgY - state.panY) * (state.zoom / newZoom);
  const { panX, panY } = clampPan(newPanX, newPanY, newZoom);
  return { zoom: newZoom, panX, panY };
}

export function panBy(state: ViewportState, dxSvg: number, dySvg: number): ViewportState {
  const { panX, panY } = clampPan(state.panX + dxSvg, state.panY + dySvg, state.zoom);
  return { ...state, panX, panY };
}

/** Center the viewport on (svgX, svgY) at the current zoom. */
export function centerOn(
  state: ViewportState,
  svgX: number,
  svgY: number,
): ViewportState {
  const w = VIEWBOX.width / state.zoom;
  const h = VIEWBOX.height / state.zoom;
  const { panX, panY } = clampPan(svgX - w / 2, svgY - h / 2, state.zoom);
  return { ...state, panX, panY };
}
