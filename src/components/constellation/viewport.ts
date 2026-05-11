import { VIEWBOX } from "./nodeLayout";

export interface ViewportState {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

export const DEFAULT_VIEWPORT: ViewportState = Object.freeze({
  zoom: 1,
  panX: 0,
  panY: 0,
});

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
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
