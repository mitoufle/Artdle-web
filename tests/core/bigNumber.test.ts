import { describe, it, expect } from "vitest";
import { big, ZERO, ONE, max, min, isBig } from "@/core/bigNumber";

describe("bigNumber", () => {
  it("constructs from a number", () => {
    expect(big(42).toNumber()).toBe(42);
  });

  it("constructs from a string", () => {
    expect(big("1e10").toNumber()).toBe(1e10);
  });

  it("ZERO equals 0", () => {
    expect(ZERO.toNumber()).toBe(0);
  });

  it("ONE equals 1", () => {
    expect(ONE.toNumber()).toBe(1);
  });

  it("max returns the larger value", () => {
    expect(max(big(3), big(7)).toNumber()).toBe(7);
    expect(max(big(7), big(3)).toNumber()).toBe(7);
  });

  it("min returns the smaller value", () => {
    expect(min(big(3), big(7)).toNumber()).toBe(3);
    expect(min(big(7), big(3)).toNumber()).toBe(3);
  });

  it("isBig recognises Decimal instances", () => {
    expect(isBig(big(1))).toBe(true);
    expect(isBig(1)).toBe(false);
    expect(isBig("1")).toBe(false);
    expect(isBig(null)).toBe(false);
  });

  it("handles values larger than Number.MAX_SAFE_INTEGER", () => {
    const huge = big("1e1000");
    expect(huge.gt(big("1e999"))).toBe(true);
  });

  it("never silently rounds to zero on extreme small inputs", () => {
    const tiny = big("1e-1000");
    expect(tiny.gt(ZERO)).toBe(true);
  });
});
