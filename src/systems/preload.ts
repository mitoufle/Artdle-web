import gateLoopVideo from "@/assets/images/ascend gate/gate_animated.mp4";
import gateOpeningVideo from "@/assets/images/ascend gate/gate_opening_animated.mp4";
import paintingScreenAnim from "@/assets/images/painting_screen_anim.mp4";
import { getTierSketchPool } from "@/components/painting/canvasArt";

/**
 * Append a `<link rel="preload">` to <head> so the browser begins fetching the
 * asset immediately, in parallel with the JS bundle and any route-driven
 * fetches. Idempotent: a second call for the same URL is skipped via the
 * `data-preload` marker.
 */
function preloadAs(url: string, as: "video" | "image"): void {
  if (typeof document === "undefined") return;
  if (document.head.querySelector(`link[data-preload="${url}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = as;
  link.href = url;
  link.setAttribute("data-preload", url);
  document.head.appendChild(link);
}

/**
 * Kick off browser-cache preloads for the heaviest route-switch assets so the
 * first navigation to /ascension or /painting doesn't pay a multi-MB fetch
 * during the route mount. Safe to call from Bootstrap mount; the browser
 * dedupes concurrent fetches if the route component happens to mount before
 * the preload completes.
 *
 * - Gate videos (~6 MB total): /ascension's biggest cost.
 * - Workshop painting video (~0.45 MB): /painting's ambient backdrop.
 * - Canvas sketch pool for the current tier (~1–3 MB): first canvas paint
 *   after a route switch otherwise pops in cell-by-cell.
 */
export function preloadHeavyAssets(canvasTier = 1): void {
  preloadAs(gateLoopVideo, "video");
  preloadAs(gateOpeningVideo, "video");
  preloadAs(paintingScreenAnim, "video");
  for (const url of getTierSketchPool(canvasTier)) preloadAs(url, "image");
}
