import { persistedAdapter } from "./persistence";
import { reportError } from "./telemetry";
import { pauseTickLoop, resumeTickLoop } from "@/core/tickLoop";

/**
 * Hooks injected into `installLifecycle`. The orchestrator stays agnostic;
 * production wiring lives in `defaultLifecycleHooks` below.
 */
export interface LifecycleHooks {
  /** Tab/page becoming hidden (visibilitychange + document.hidden=true). */
  onHide: () => void;
  /** Tab/page becoming visible (visibilitychange + document.hidden=false). */
  onShow: () => void;
  /** Page about to unload (beforeunload). */
  onUnload: () => void;
}

/**
 * Install the single visibilitychange + beforeunload listener pair.
 * Returns a cleanup function that removes both. Designed to be called once
 * after rehydration completes (see `src/main.tsx`).
 */
export function installLifecycle(hooks: LifecycleHooks): () => void {
  const onVisChange = (): void => {
    if (document.hidden) hooks.onHide();
    else hooks.onShow();
  };
  document.addEventListener("visibilitychange", onVisChange);
  window.addEventListener("beforeunload", hooks.onUnload);
  return (): void => {
    document.removeEventListener("visibilitychange", onVisChange);
    window.removeEventListener("beforeunload", hooks.onUnload);
  };
}

/**
 * Production hooks: pause+flush on hide, resume on show, flush on unload.
 * Flush rejections are routed through `reportError` so background save
 * failures are observable instead of becoming UnhandledPromiseRejections.
 */
export const defaultLifecycleHooks: LifecycleHooks = {
  onHide: (): void => {
    pauseTickLoop();
    void persistedAdapter.flush().catch((err: unknown) =>
      reportError(err as Error, "persist.flush.visibilitychange"),
    );
  },
  onShow: (): void => {
    resumeTickLoop();
  },
  onUnload: (): void => {
    void persistedAdapter.flush().catch((err: unknown) =>
      reportError(err as Error, "persist.flush.beforeunload"),
    );
  },
};
