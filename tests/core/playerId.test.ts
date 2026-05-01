import { describe, it, expect } from "vitest";
import { newPlayerId, isPlayerId } from "@/core/playerId";

describe("newPlayerId", () => {
  it("returns a UUID v4 string", () => {
    const id = newPlayerId();
    expect(isPlayerId(id)).toBe(true);
  });

  it("returns a different value each call", () => {
    const a = newPlayerId();
    const b = newPlayerId();
    expect(a).not.toBe(b);
  });
});

describe("isPlayerId", () => {
  it("accepts valid UUID v4", () => {
    expect(isPlayerId("c70ba8c4-7be9-4f57-a87a-2f6b1a0a3c7e")).toBe(true);
  });

  it("rejects non-strings", () => {
    expect(isPlayerId(123)).toBe(false);
    expect(isPlayerId(null)).toBe(false);
    expect(isPlayerId(undefined)).toBe(false);
    expect(isPlayerId({})).toBe(false);
  });

  it("rejects malformed strings", () => {
    expect(isPlayerId("")).toBe(false);
    expect(isPlayerId("not-a-uuid")).toBe(false);
    expect(isPlayerId("c70ba8c4-7be9-1f57-a87a-2f6b1a0a3c7e")).toBe(false); // version 1, not 4
  });
});
