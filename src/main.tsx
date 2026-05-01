import { StrictMode, useEffect, useState } from "react";
import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import { useGameStore } from "@/store";
import { LoadingScreen } from "@/ui/widgets/LoadingScreen";
import { App } from "@/App";
import { startTickLoop, stopTickLoop } from "@/core/tickLoop";
import { persistedAdapter } from "@/systems/persistence";
import "./index.css";

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

  // Flush throttled persist on tab hide / unload. visibilitychange fires
  // before beforeunload in modern browsers; beforeunload is the belt-and-
  // braces fallback. Both call paths converge on persistedAdapter.flush().
  useEffect(() => {
    if (!hydrated) return;
    const onHide = (): void => {
      void persistedAdapter.flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, [hydrated]);

  if (!hydrated) return <LoadingScreen />;
  return <App />;
}

const root = document.getElementById("root");
if (!root) throw new Error("#root element not found in index.html");

createRoot(root).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
