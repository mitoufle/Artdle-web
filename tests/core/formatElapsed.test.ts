import { describe, expect, it } from "vitest";
import { formatElapsed } from "@/core/formatElapsed";

describe("formatElapsed", () => {
  it("formats sub-minute durations in seconds", () => {
    expect(formatElapsed(0)).toBe("0s");
    expect(formatElapsed(45)).toBe("45s");
    expect(formatElapsed(59)).toBe("59s");
  });

  it("formats sub-hour durations in whole minutes", () => {
    expect(formatElapsed(60)).toBe("1 min");
    expect(formatElapsed(90)).toBe("1 min");
    expect(formatElapsed(720)).toBe("12 min");
    expect(formatElapsed(3599)).toBe("59 min");
  });

  it("formats sub-day durations in h/min", () => {
    expect(formatElapsed(3600)).toBe("1h 0min");
    expect(formatElapsed(3661)).toBe("1h 1min");
    expect(formatElapsed(86399)).toBe("23h 59min");
  });

  it("formats multi-day durations in d/h", () => {
    expect(formatElapsed(86400)).toBe("1d 0h");
    expect(formatElapsed(90000)).toBe("1d 1h");
    expect(formatElapsed(172800)).toBe("2d 0h");
  });
});
