import gateLoopVideo from "@/assets/images/ascend gate/gate_animated.mp4";
import gateOpeningVideo from "@/assets/images/ascend gate/gate_opening_animated.mp4";
import paintingScreenAnim from "@/assets/images/painting_screen_anim.mp4";
import { getTierSketchPool } from "@/components/painting/canvasArt";

/**
 * Append a `<link rel="prefetch">` to <head> so the browser fetches the asset
 * during idle time only — never competes with foreground navigation fetches.
 * `preload` (high priority) was previously used here but on slow connections
 * the ~8 MB of preload requests starved route-switch image/video fetches.
 * `prefetch` is the right semantics for "might need soon, not need now".
 *
 * Idempotent: a second call for the same URL is skipped via the
 * `data-preload` marker.
 */
function prefetch(url: string): void {
  if (typeof document === "undefined") return;
  if (document.head.querySelector(`link[data-preload="${url}"]`)) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = url;
  link.setAttribute("data-preload", url);
  document.head.appendChild(link);
}

/**
 * Hint the browser to warm its cache with the heaviest route-switch assets
 * during idle time, so the first navigation to /ascension or /painting
 * doesn't pay a multi-MB fetch on mount. Uses low-priority prefetch — does
 * NOT block or compete with the user's current navigation.
 *
 * - Gate videos (~6 MB total): /ascension's biggest cost.
 * - Workshop painting video (~0.45 MB): /painting's ambient backdrop.
 * - Canvas sketch pool for the current tier (~1–3 MB): first canvas paint
 *   after a route switch otherwise pops in cell-by-cell.
 */
export function preloadHeavyAssets(canvasTier = 1): void {
  prefetch(gateLoopVideo);
  prefetch(gateOpeningVideo);
  prefetch(paintingScreenAnim);
  for (const url of getTierSketchPool(canvasTier)) prefetch(url);
}
