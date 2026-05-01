import { describe, it, expect, beforeEach } from "vitest";
import { idbAdapter } from "@/systems/persistence";

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
