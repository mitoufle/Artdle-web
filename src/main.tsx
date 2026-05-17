import { StrictMode, useEffect, useState } from "react";
import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { useGameStore } from "@/store";
import { LoadingScreen } from "@/ui/widgets/LoadingScreen";
import { App } from "@/App";
import { startTickLoop, stopTickLoop } from "@/core/tickLoop";
import { installLifecycle, defaultLifecycleHooks } from "@/systems/lifecycle";
import { big } from "@/core/bigNumber";
import "./styles/globals.css";
import "./index.css";

// Dev-only: expose store + helpers on window for DevTools console smoke tests.
// Stripped from production builds via the import.meta.env.DEV check.
if (import.meta.env.DEV) {
  (window as unknown as { useGameStore: typeof useGameStore; big: typeof big }).useGameStore =
    useGameStore;
  (window as unknown as { useGameStore: typeof useGameStore; big: typeof big }).big = big;
}

function Bootstrap(): JSX.Element {
  const [hydrated, setHydrated] = useState<boolean>(useGameStore.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) return;
    const unsub = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [hydrated]);

  // Start the RAF tick loop after hydration. tickLoop.startTickLoop guards
  // against double-start (StrictMode dev mounts effects twice).
  useEffect(() => {
    if (!hydrated) return;
    startTickLoop((delta) => useGameStore.getState().tickAll(delta));
    return () => stopTickLoop();
  }, [hydrated]);

  // Single lifecycle install: visibilitychange (pause+flush / resume) +
  // beforeunload (flush). Both routes go through `reportError` on flush
  // rejection. See `src/systems/lifecycle.ts`.
  useEffect(() => {
    if (!hydrated) return;
    return installLifecycle(defaultLifecycleHooks);
  }, [hydrated]);

  // Retroactive achievement evaluation on rehydration.
  // Fires once when the save is loaded, completing any achievements whose
  // conditions are already met.
  useEffect(() => {
    if (!hydrated) return;
    useGameStore.getState().evaluateAchievements();
  }, [hydrated]);

  if (!hydrated) return <LoadingScreen />;
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root element not found in index.html");

createRoot(root).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
