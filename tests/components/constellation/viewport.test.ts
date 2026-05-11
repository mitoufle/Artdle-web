import { describe, it, expect } from "vitest";
import {
  DEFAULT_VIEWPORT,
  MIN_ZOOM,
  MAX_ZOOM,
  clampZoom,
  clampPan,
  zoomAt,
  panBy,
  centerOn,
} from "@/components/constellation/viewport";
import { VIEWBOX } from "@/components/constellation/nodeLayout";

describe("viewport — clampZoom", () => {
  it("clamps below MIN_ZOOM", () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
  });
  it("clamps above MAX_ZOOM", () => {
    expect(clampZoom(99)).toBe(MAX_ZOOM);
  });
  it("passes through valid zoom", () => {
    expect(clampZoom(2)).toBe(2);
  });
});

describe("viewport — clampPan", () => {
  it("at zoom 1, pan is fixed at 0,0 (no room to pan)", () => {
    const { panX, panY } = clampPan(50, 50, 1);
    expect(panX).toBe(0);
    expect(panY).toBe(0);
  });

  it("at zoom 2, allowed pan range is [0, VIEWBOX.width/2] for x", () => {
    const { panX } = clampPan(VIEWBOX.width, 0, 2);
    expect(panX).toBe(VIEWBOX.width - VIEWBOX.width / 2);
  });

  it("clamps negative pan to 0", () => {
    const { panX, panY } = clampPan(-100, -100, 2);
    expect(panX).toBe(0);
    expect(panY).toBe(0);
  });
});

describe("viewport — zoomAt", () => {
  it("keeps cursor SVG point stationary across zoom-in", () => {
    const cursor = { x: 200, y: 150 };
    const after = zoomAt(DEFAULT_VIEWPORT, cursor.x, cursor.y, 2);
    // The cursor's mapping into viewBox should be the same point before/after.
    // Before zoom (default): cursor svg coords are themselves at (200, 150).
    // After zoom 2x centered on cursor: the cursor must map to the same SVG point.
    // The cursor's SVG coord = panX + (cursorScreenPct × w/zoom).
    // Since we pass svgX/svgY directly, the invariant is that this point
    // sits at the same fractional position in the new viewBox.
    const w = VIEWBOX.width / after.zoom;
    const h = VIEWBOX.height / after.zoom;
    const fracX = (cursor.x - after.panX) / w;
    const fracY = (cursor.y - after.panY) / h;
    // Same fractional position the cursor was at in the OLD viewBox.
    const oldFracX = cursor.x / VIEWBOX.width;
    const oldFracY = cursor.y / VIEWBOX.height;
    expect(fracX).toBeCloseTo(oldFracX, 4);
    expect(fracY).toBeCloseTo(oldFracY, 4);
  });

  it("does not change state when zoom hits the clamp", () => {
    const at = { ...DEFAULT_VIEWPORT, zoom: MAX_ZOOM };
    const after = zoomAt(at, 100, 100, 10);
    expect(after).toBe(at);
  });

  it("zooming out from a zoomed-in state moves toward zoom 1", () => {
    const at = { zoom: 2, panX: 100, panY: 100 };
    const after = zoomAt(at, 200, 150, 0.5);
    expect(after.zoom).toBeLessThan(at.zoom);
  });
});

describe("viewport — panBy", () => {
  it("adds dx/dy to pan, clamped", () => {
    const at = { zoom: 2, panX: 100, panY: 100 };
    const after = panBy(at, 50, 50);
    expect(after.panX).toBe(150);
    expect(after.panY).toBe(150);
  });

  it("clamps negative pan to 0", () => {
    const at = { zoom: 2, panX: 0, panY: 0 };
    const after = panBy(at, -100, -100);
    expect(after.panX).toBe(0);
    expect(after.panY).toBe(0);
  });
});

describe("viewport — centerOn", () => {
  it("centers viewport on the given SVG point", () => {
    const after = centerOn({ zoom: 2, panX: 0, panY: 0 }, 300, 200);
    const w = VIEWBOX.width / 2;
    const h = VIEWBOX.height / 2;
    expect(after.panX).toBeCloseTo(300 - w / 2, 4);
    expect(after.panY).toBeCloseTo(200 - h / 2, 4);
  });

  it("clamps when centering near edge", () => {
    const after = centerOn({ zoom: 2, panX: 0, panY: 0 }, 0, 0);
    expect(after.panX).toBe(0);
    expect(after.panY).toBe(0);
  });
});
