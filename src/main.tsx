import { StrictMode, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useGameStore } from "@/store";
import { LoadingScreen } from "@/ui/widgets/LoadingScreen";
import { App } from "@/App";
import { startTickLoop, stopTickLoop } from "@/core/tickLoop";
import { installLifecycle, defaultLifecycleHooks } from "@/systems/lifecycle";
import { persistedAdapter } from "@/systems/persistence";
import { big } from "@/core/bigNumber";
import { runCatchupSimulation, type CatchupResult } from "@/systems/catchup";
import { reportError } from "@/systems/telemetry";
import { CatchupToast } from "@/components/catchup/CatchupToast";
import { CatchupLoadingScene } from "@/components/catchup/CatchupLoadingScene";
import { CatchupRecapModal } from "@/components/catchup/CatchupRecapModal";
import "./styles/globals.css";
import "./index.css";

// Reload always lands on /tree. Every page load goes through a splash (logo +
// optional progress bar); when it fades away the player should see the same
// scene every time — the inspiration tree — regardless of which sub-route
// they were on before. Dev designer routes are exempt so /dev/* reloads
// preserve the working URL.
if (
  typeof window !== "undefined" &&
  !window.location.pathname.startsWith("/dev/") &&
  window.location.pathname !== "/tree"
) {
  window.history.replaceState({}, "", "/tree");
}

// Dev-only: expose store + helpers on window for DevTools console smoke tests.
// Stripped from production builds via the import.meta.env.DEV check.
if (import.meta.env.DEV) {
  (window as unknown as { useGameStore: typeof useGameStore; big: typeof big }).useGameStore =
    useGameStore;
  (window as unknown as { useGameStore: typeof useGameStore; big: typeof big }).big = big;

  // DEV-only test helper for manual catch-up playtesting. Sets lastSeen to
  // `hoursAgo` hours in the past, suppresses the next lifecycle lastSeen write
  // (so beforeunload doesn't overwrite back to now), flushes IDB, then reloads.
  // Without this helper, `setState({lastSeen: PAST}) + location.reload()` is
  // racy because onUnload writes Date.now() before unload.
  (window as unknown as { testCatchup: (hoursAgo: number) => Promise<void> }).testCatchup =
    async (hoursAgo: number): Promise<void> => {
      const past = Date.now() - hoursAgo * 3600 * 1000;
      useGameStore.setState({ lastSeen: past });
      sessionStorage.setItem("__skipNextLastSeenWrite", "1");
      await persistedAdapter.flush();
      location.reload();
    };
}

/** Elapsed ≤ this many seconds → skip catch-up entirely. */
const SILENT_THRESHOLD_S = 5;
/** Elapsed < this many seconds → run sim silently and show a toast. ≥ → loading scene + recap. */
const TOAST_THRESHOLD_S = 2 * 3600;
/**
 * Minimum hold for the catch-up loading scene before transitioning out (to
 * recap or fail-open). Adaptive-delta sims finish in ~50ms for typical
 * absences; without this hold the scene would flash by faster than the user
 * can read. Exported for the matching integration test.
 */
export const MIN_LOADING_SCENE_MS = 3000;
/** Crossfade duration when the splash hands off to the live game. */
const CROSSFADE_MS = 500;

/**
 * Boot phases. The recap modal is now an overlay on top of the playing phase
 * rather than its own black-backdrop screen, so the user sees the recap on
 * top of the game (tree route) instead of a void. Transitions:
 *   rehydrating → silent_sim → playing(recap=null, toast=null)             (elapsed ≤ 5s)
 *   rehydrating → silent_sim → playing(recap=null, toast=result)           (5s < elapsed < 2h)
 *   rehydrating → silent_sim → loading_scene → playing(recap=result, toast=null)  (≥ 2h)
 *
 * `silent_sim` is the post-hydration decision phase: we check `lastSeen` and
 * either route straight to `playing` or kick off a `runCatchupSimulation` call.
 * For sub-2h catch-ups the UI stays on the logo splash during the sim; only
 * the long path swaps in a dedicated progress scene.
 */
type Phase =
  | { kind: "rehydrating" }
  | { kind: "silent_sim" }
  | { kind: "loading_scene"; elapsed: number; progress: number }
  | { kind: "playing"; recap: CatchupResult | null; toast: CatchupResult | null };

export function Bootstrap(): JSX.Element {
  const [phase, setPhase] = useState<Phase>(() =>
    useGameStore.persist.hasHydrated() ? { kind: "silent_sim" } : { kind: "rehydrating" },
  );

  // Wait for hydration to finish, then enter the sim-decision phase.
  useEffect(() => {
    if (phase.kind !== "rehydrating") return;
    const unsub = useGameStore.persist.onFinishHydration(() => {
      setPhase({ kind: "silent_sim" });
    });
    return unsub;
  }, [phase.kind]);

  // Ref-based cancellation: signals "Bootstrap is unmounting" (true on unmount,
  // reset to false on remount in StrictMode). We use a ref rather than an
  // effect-local closure variable because the catchup orchestration triggers
  // its own phase transitions (silent_sim → loading_scene) that re-fire the
  // deciding effect; an effect-local `cancelled` would get set to true by the
  // cleanup of the very effect that's still mid-simulation, killing the
  // subsequent `setPhase({ kind: "playing", ... })`.
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return (): void => {
      unmountedRef.current = true;
    };
  }, []);

  // Decide entry once we're in silent_sim (post-hydration). This effect runs
  // the catchup simulation if needed, then transitions to `playing` (short
  // absences) or via `loading_scene` (long absences). The simAlreadyStarted
  // flag guards against StrictMode's effect double-invoke in dev — we only
  // want to fire the sim once per silent_sim transition.
  const simAlreadyStarted = useRef(false);
  useEffect(() => {
    if (phase.kind !== "silent_sim") return;
    if (simAlreadyStarted.current) return;
    simAlreadyStarted.current = true;
    (async () => {
      const lastSeen = useGameStore.getState().lastSeen;
      const elapsed = Math.max(0, (Date.now() - lastSeen) / 1000);

      // ≤ 5s: tab refresh or near-instant reopen. No sim, no overlay.
      if (elapsed <= SILENT_THRESHOLD_S) {
        if (!unmountedRef.current) setPhase({ kind: "playing", recap: null, toast: null });
        return;
      }

      // 5s < elapsed < 2h: silent sim, then toast over the live game.
      if (elapsed < TOAST_THRESHOLD_S) {
        try {
          const result = await runCatchupSimulation(elapsed, () => {});
          if (!unmountedRef.current)
            setPhase({ kind: "playing", recap: null, toast: result });
        } catch (err) {
          reportError(err as Error, "catchup.simulation");
          if (!unmountedRef.current)
            setPhase({ kind: "playing", recap: null, toast: null });
        }
        return;
      }

      // ≥ 2h: dedicated loading scene with progress, then recap modal overlaid
      // on the live game.
      if (!unmountedRef.current) {
        setPhase({ kind: "loading_scene", elapsed, progress: 0 });
      }
      const loadingStartedAt = Date.now();
      const holdMinDuration = async (): Promise<void> => {
        const remaining = MIN_LOADING_SCENE_MS - (Date.now() - loadingStartedAt);
        if (remaining > 0) {
          await new Promise((res) => setTimeout(res, remaining));
        }
      };
      try {
        const result = await runCatchupSimulation(elapsed, (p) => {
          if (unmountedRef.current) return;
          setPhase((cur) =>
            cur.kind === "loading_scene" ? { ...cur, progress: p } : cur,
          );
        });
        await holdMinDuration();
        if (!unmountedRef.current)
          setPhase({ kind: "playing", recap: result, toast: null });
      } catch (err) {
        reportError(err as Error, "catchup.simulation");
        await holdMinDuration();
        if (!unmountedRef.current)
          setPhase({ kind: "playing", recap: null, toast: null });
      }
    })();
  }, [phase.kind]);

  // Start the RAF tick loop once we reach `playing`. tickLoop.startTickLoop
  // guards against double-start (StrictMode dev mounts effects twice).
  useEffect(() => {
    if (phase.kind !== "playing") return;
    startTickLoop((delta) => useGameStore.getState().tickAll(delta));
    return () => stopTickLoop();
  }, [phase.kind]);

  // Single lifecycle install: visibilitychange (pause+flush / resume) +
  // beforeunload (flush). Installed only once we reach `playing` so the
  // catchup flow itself isn't interrupted by tab events firing on
  // rehydration. See `src/systems/lifecycle.ts`.
  useEffect(() => {
    if (phase.kind !== "playing") return;
    return installLifecycle(defaultLifecycleHooks);
  }, [phase.kind]);

  // Retroactive achievement evaluation on the no-catchup path (entering
  // `playing` with neither a recap nor a toast). The catchup engine already
  // calls `evaluateAchievements` at end-of-sim for the other branches.
  // Deps intentionally exclude phase.recap/phase.toast: dismissing them later
  // does NOT change phase.kind, so this effect won't re-fire.
  useEffect(() => {
    if (
      phase.kind === "playing" &&
      phase.recap === null &&
      phase.toast === null
    ) {
      useGameStore.getState().evaluateAchievements();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind]);

  const isSplash =
    phase.kind === "rehydrating" ||
    phase.kind === "silent_sim" ||
    phase.kind === "loading_scene";

  return (
    <>
      {phase.kind === "playing" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: CROSSFADE_MS / 1000 }}
        >
          <BrowserRouter>
            <App />
            {phase.toast && (
              <CatchupToast
                result={phase.toast}
                onDismiss={() =>
                  setPhase({ kind: "playing", recap: phase.recap, toast: null })
                }
              />
            )}
            {phase.recap && (
              <CatchupRecapModal
                result={phase.recap}
                onContinue={() =>
                  setPhase({ kind: "playing", recap: null, toast: phase.toast })
                }
              />
            )}
          </BrowserRouter>
        </motion.div>
      )}
      <AnimatePresence>
        {isSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: CROSSFADE_MS / 1000 }}
            style={{ position: "fixed", inset: 0, zIndex: 9999 }}
          >
            {phase.kind === "loading_scene" ? (
              <CatchupLoadingScene
                elapsedSeconds={phase.elapsed}
                progress={phase.progress}
              />
            ) : (
              <LoadingScreen />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Side-effectful boot: only run when an actual #root element is present
// (production / dev server). Importing this module from a test (where there
// is no #root) is a no-op so `Bootstrap` can be exercised in isolation.
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Bootstrap />
    </StrictMode>,
  );
}
