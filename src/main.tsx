import { StrictMode, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
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
 * Boot phases. The transitions are:
 *   rehydrating → silent_sim → playing(toast=null)            (elapsed ≤ 5s)
 *   rehydrating → silent_sim → playing(toast=result)          (5s < elapsed < 2h)
 *   rehydrating → silent_sim → loading_scene → recap → playing(toast=result)  (≥ 2h)
 *
 * `silent_sim` is the post-hydration decision phase: we check `lastSeen` and
 * either route straight to `playing` or kick off a `runCatchupSimulation` call.
 * For sub-2h catch-ups the UI stays on `LoadingScreen` during the sim; only
 * the long path swaps in a dedicated progress scene.
 */
type Phase =
  | { kind: "rehydrating" }
  | { kind: "silent_sim" }
  | { kind: "loading_scene"; elapsed: number; progress: number }
  | { kind: "recap"; result: CatchupResult }
  | { kind: "playing"; toast: CatchupResult | null };

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
  // subsequent `setPhase({ kind: "recap" })`.
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return (): void => {
      unmountedRef.current = true;
    };
  }, []);

  // Decide entry once we're in silent_sim (post-hydration). This effect runs
  // the catchup simulation if needed, then transitions to `playing` (short
  // absences) or `loading_scene → recap` (long absences). The simAlreadyStarted
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

      // ≤ 5s: tab refresh or near-instant reopen. No sim, no UI.
      if (elapsed <= SILENT_THRESHOLD_S) {
        if (!unmountedRef.current) setPhase({ kind: "playing", toast: null });
        return;
      }

      // 5s < elapsed < 2h: silent sim, then toast over the live game.
      if (elapsed < TOAST_THRESHOLD_S) {
        try {
          const result = await runCatchupSimulation(elapsed, () => {});
          if (!unmountedRef.current) setPhase({ kind: "playing", toast: result });
        } catch (err) {
          reportError(err as Error, "catchup.simulation");
          if (!unmountedRef.current) setPhase({ kind: "playing", toast: null });
        }
        return;
      }

      // ≥ 2h: dedicated loading scene with progress, then recap modal.
      if (!unmountedRef.current) {
        setPhase({ kind: "loading_scene", elapsed, progress: 0 });
      }
      try {
        const result = await runCatchupSimulation(elapsed, (p) => {
          if (unmountedRef.current) return;
          setPhase((cur) =>
            cur.kind === "loading_scene" ? { ...cur, progress: p } : cur,
          );
        });
        if (!unmountedRef.current) setPhase({ kind: "recap", result });
      } catch (err) {
        reportError(err as Error, "catchup.simulation");
        if (!unmountedRef.current) setPhase({ kind: "playing", toast: null });
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

  // Retroactive achievement evaluation on the no-catchup path (≤ 5s elapsed).
  // The catchup engine already calls `evaluateAchievements` at end-of-sim for
  // the other branches, so we only need to fire here when `toast === null`
  // means "we entered playing without running a sim". Deps intentionally
  // exclude `phase.toast`: dismissing the toast later transitions
  // playing(toast=result) → playing(toast=null), and we must not re-evaluate
  // achievements at that point.
  useEffect(() => {
    if (phase.kind === "playing" && phase.toast === null) {
      useGameStore.getState().evaluateAchievements();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind]);

  if (phase.kind === "rehydrating") return <LoadingScreen />;
  if (phase.kind === "silent_sim") return <LoadingScreen />;
  if (phase.kind === "loading_scene") {
    return <CatchupLoadingScene elapsedSeconds={phase.elapsed} progress={phase.progress} />;
  }
  if (phase.kind === "recap") {
    return (
      <CatchupRecapModal
        result={phase.result}
        onContinue={() => setPhase({ kind: "playing", toast: phase.result })}
      />
    );
  }
  // phase.kind === "playing"
  return (
    <BrowserRouter>
      <App />
      {phase.toast && (
        <CatchupToast
          result={phase.toast}
          onDismiss={() => setPhase({ kind: "playing", toast: null })}
        />
      )}
    </BrowserRouter>
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
