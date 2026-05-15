import { get, set, del } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

/**
 * Storage interface compatible with Zustand's `createJSONStorage`.
 * Future RemoteSyncAdapter (v3.x) implements the same shape: read from IDB, push to server.
 */
export type SaveAdapter = StateStorage;

export const idbAdapter: SaveAdapter = {
  getItem: async (name: string): Promise<string | null> => {
    const v = await get<string>(name);
    return v ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

/**
 * Wraps a SaveAdapter so that rapid `setItem` calls are coalesced into one
 * base write per `intervalMs` window. Exposes a `flush()` method for graceful
 * save-on-close (visibilitychange / beforeunload).
 *
 * Latest-wins: only the most recently passed value is written.
 *
 * Designed for single-key use (Zustand `persist` writes only `SAVE_KEY`).
 * Concurrent writes to DIFFERENT `name` values within one window all map to
 * the same `pending` slot — earlier names are lost. If a future consumer
 * needs multi-key throttling, replace `pending` with a `Map<string, string>`.
 *
 * `getItem` and `removeItem` are pass-through (not throttled).
 */
export interface ThrottledSaveAdapter extends SaveAdapter {
  flush: () => Promise<void>;
  discard: () => void;
}

export function throttledAdapter(
  base: SaveAdapter,
  intervalMs: number,
): ThrottledSaveAdapter {
  let pending: { name: string; value: string } | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const flush = async (): Promise<void> => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (pending === null) return;
    const p = pending;
    pending = null;
    await base.setItem(p.name, p.value);
  };

  const discard = (): void => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    pending = null;
  };

  return {
    getItem: base.getItem.bind(base),
    removeItem: base.removeItem.bind(base),
    setItem: async (name, value) => {
      pending = { name, value };
      if (timerId === null) {
        timerId = setTimeout(() => {
          // Fire-and-forget; consumers should call flush() to await completion.
          // Log rejections so background save failures are observable instead
          // of becoming UnhandledPromiseRejection events.
          void flush().catch((err: unknown) => {
            console.error("[throttledAdapter] background save failed:", err);
          });
        }, intervalMs);
      }
    },
    flush,
    discard,
  };
}

/**
 * The production storage adapter used by the Zustand persist middleware.
 * Throttled to ~1Hz to bound IDB write rate during tick-driven mutations
 * (Phase 2: ~60Hz state changes from canvas/tree ticks).
 *
 * Save loss bound on hard crash: ≤ 1 second of work. Graceful tab close
 * triggers `flush()` via main.tsx listeners → zero loss.
 */
export const persistedAdapter: ThrottledSaveAdapter = throttledAdapter(idbAdapter, 1000);
