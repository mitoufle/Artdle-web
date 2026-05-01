import { describe, it, expect } from "vitest";
import { formatShort, formatBig } from "@/core/formatter";
import { big } from "@/core/bigNumber";

describe("formatShort", () => {
  it("formats integers below 1K as plain", () => {
    expect(formatShort(0)).toBe("0");
    expect(formatShort(1)).toBe("1");
    expect(formatShort(999)).toBe("999");
  });

  it("formats fractional values below 1K with 2 decimals", () => {
    expect(formatShort(0.5)).toBe("0.50");
    expect(formatShort(123.456)).toBe("123.46");
  });

  it("formats thousands with K", () => {
    expect(formatShort(1000)).toBe("1.00K");
    expect(formatShort(1234)).toBe("1.23K");
    expect(formatShort(999_999)).toBe("1000.00K"); // edge
  });

  it("formats millions with M", () => {
    expect(formatShort(1_000_000)).toBe("1.00M");
    expect(formatShort(12_345_678)).toBe("12.35M");
  });

  it("formats billions with B", () => {
    expect(formatShort(1e9)).toBe("1.00B");
  });

  it("formats trillions with T", () => {
    expect(formatShort(1e12)).toBe("1.00T");
  });

  it("formats quadrillions with Q", () => {
    expect(formatShort(1e15)).toBe("1.00Q");
  });

  it("preserves negative sign", () => {
    expect(formatShort(-1234)).toBe("-1.23K");
    expect(formatShort(-5)).toBe("-5");
  });

  it("returns ∞ for non-finite", () => {
    expect(formatShort(Infinity)).toBe("∞");
    expect(formatShort(NaN)).toBe("∞");
  });
});

describe("formatBig", () => {
  it("delegates to short form for normal magnitudes", () => {
    expect(formatBig(big(1234))).toBe("1.23K");
  });

  it("falls back to scientific for huge magnitudes", () => {
    expect(formatBig(big("1e30"))).toMatch(/e\+?30/);
  });
});
