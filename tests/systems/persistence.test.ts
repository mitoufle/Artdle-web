import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { idbAdapter, throttledAdapter } from "@/systems/persistence";

describe("idbAdapter", () => {
  beforeEach(async () => {
    // fake-indexeddb resets per test file but not per test; clear known keys.
    await idbAdapter.removeItem("test-key");
    await idbAdapter.removeItem("artdle-save");
  });

  it("getItem returns null for an unset key", async () => {
    expect(await idbAdapter.getItem("nonexistent")).toBeNull();
  });

  it("setItem then getItem returns the same value", async () => {
    await idbAdapter.setItem("test-key", "hello");
    expect(await idbAdapter.getItem("test-key")).toBe("hello");
  });

  it("setItem overwrites existing value", async () => {
    await idbAdapter.setItem("test-key", "v1");
    await idbAdapter.setItem("test-key", "v2");
    expect(await idbAdapter.getItem("test-key")).toBe("v2");
  });

  it("removeItem deletes the key", async () => {
    await idbAdapter.setItem("test-key", "hello");
    await idbAdapter.removeItem("test-key");
    expect(await idbAdapter.getItem("test-key")).toBeNull();
  });

  it("round-trips JSON-serialised state", async () => {
    const state = { gold: 100, inspiration: 42, playerId: "abc" };
    await idbAdapter.setItem("artdle-save", JSON.stringify(state));
    const round = JSON.parse((await idbAdapter.getItem("artdle-save"))!);
    expect(round).toEqual(state);
  });
});

/**
 * In-memory SaveAdapter for throttledAdapter unit tests.
 *
 * Using idbAdapter as the base would conflict with vi.useFakeTimers():
 * fake-indexeddb delivers IDBRequest events via setTimeout(fn, 0), so once
 * fake timers are active, every IDB await hangs waiting for a delivery the
 * test controls. A synchronous in-memory map avoids this entirely, letting
 * fake timers govern only the throttle window itself.
 */
function makeMemAdapter(): {
  store: Map<string, string>;
  adapter: import("@/systems/persistence").SaveAdapter;
} {
  const store = new Map<string, string>();
  return {
    store,
    adapter: {
      getItem: async (name) => store.get(name) ?? null,
      setItem: async (name, value) => { store.set(name, value); },
      removeItem: async (name) => { store.delete(name); },
    },
  };
}

describe("throttledAdapter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces N rapid setItem calls within the window into ONE base write", async () => {
    const { store, adapter: base } = makeMemAdapter();
    const throttled = throttledAdapter(base, 100);

    await throttled.setItem("k", "v1");
    await throttled.setItem("k", "v2");
    await throttled.setItem("k", "v3");

    // Before the timer fires, the base hasn't been written.
    expect(store.get("k")).toBeUndefined();

    // Advance time past the window and flush resulting microtasks.
    await vi.advanceTimersByTimeAsync(100);

    expect(store.get("k")).toBe("v3");
  });

  it("the flushed value is the LATEST of the queued calls (latest-wins)", async () => {
    const { store, adapter: base } = makeMemAdapter();
    const throttled = throttledAdapter(base, 100);
    await throttled.setItem("k", "first");
    await throttled.setItem("k", "middle");
    await throttled.setItem("k", "latest");
    await vi.advanceTimersByTimeAsync(100);
    expect(store.get("k")).toBe("latest");
  });

  it("flush() writes pending immediately and clears pending state", async () => {
    const { store, adapter: base } = makeMemAdapter();
    const throttled = throttledAdapter(base, 1000);
    await throttled.setItem("k", "now");
    expect(store.get("k")).toBeUndefined();

    await throttled.flush();

    expect(store.get("k")).toBe("now");

    // Advancing past the original window must not write again.
    await vi.advanceTimersByTimeAsync(1000);
    // To prove non-re-fire: overwrite base directly, then confirm a stale
    // timer can't clobber it.
    store.set("k", "external");
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.get("k")).toBe("external");
  });

  it("flush() with no pending is a no-op (does not throw, does not write)", async () => {
    const { store, adapter: base } = makeMemAdapter();
    const throttled = throttledAdapter(base, 1000);
    await throttled.flush(); // no pending
    expect(store.size).toBe(0);
  });

  it("re-arming: after flush, a new setItem starts a fresh window", async () => {
    const { store, adapter: base } = makeMemAdapter();
    const throttled = throttledAdapter(base, 100);
    await throttled.setItem("k", "first");
    await throttled.flush();
    expect(store.get("k")).toBe("first");

    await throttled.setItem("k", "second");
    expect(store.get("k")).toBe("first"); // not yet
    await vi.advanceTimersByTimeAsync(100);
    expect(store.get("k")).toBe("second");
  });

  it("getItem and removeItem are pass-through (not throttled)", async () => {
    const { store, adapter: base } = makeMemAdapter();
    const throttled = throttledAdapter(base, 1000);
    store.set("k", "direct");
    expect(await throttled.getItem("k")).toBe("direct");
    await throttled.removeItem("k");
    expect(store.has("k")).toBe(false);
  });

  it("discard() cancels pending write so flush() is a no-op afterward", async () => {
    const { store, adapter: base } = makeMemAdapter();
    const throttled = throttledAdapter(base, 1000);
    await throttled.setItem("k", "queued");
    expect(store.has("k")).toBe(false); // not written yet

    throttled.discard();
    await throttled.flush(); // should be a no-op

    expect(store.has("k")).toBe(false);
    // timer must also be dead — advancing past window must not write
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.has("k")).toBe(false);
  });

  it("clearStorage + discard prevents beforeunload flush from restoring save", async () => {
    const { store, adapter: base } = makeMemAdapter();
    const throttled = throttledAdapter(base, 1000);
    // A tick queued a write
    await throttled.setItem("artdle-save", "old-state");
    // wipeAndReload: clearStorage deletes the key
    await throttled.removeItem("artdle-save");
    // wipeAndReload: discard cancels pending write before reload fires beforeunload
    throttled.discard();
    // beforeunload lifecycle hook calls flush
    await throttled.flush();
    expect(store.has("artdle-save")).toBe(false);
  });
});
