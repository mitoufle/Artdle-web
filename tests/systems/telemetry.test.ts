import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  reportError,
  setErrorReporter,
  resetErrorReporter,
} from "@/systems/telemetry";

describe("telemetry", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    resetErrorReporter();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    resetErrorReporter();
  });

  it("default reporter calls console.error with [context] prefix", () => {
    const err = new Error("boom");
    reportError(err, "test.context");
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toBe("[test.context]");
    expect(consoleErrorSpy.mock.calls[0]?.[1]).toBe(err);
  });

  it("setErrorReporter swaps the default sink", () => {
    const customSink = vi.fn();
    setErrorReporter(customSink);
    const err = new Error("boom");
    reportError(err, "swapped");
    expect(customSink).toHaveBeenCalledOnce();
    expect(customSink).toHaveBeenCalledWith(err, "swapped");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("resetErrorReporter restores the default sink", () => {
    setErrorReporter(vi.fn());
    resetErrorReporter();
    const err = new Error("after reset");
    reportError(err, "ctx");
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toBe("[ctx]");
    expect(consoleErrorSpy.mock.calls[0]?.[1]).toBe(err);
  });

  it("multiple reportError calls all reach the configured sink", () => {
    const customSink = vi.fn();
    setErrorReporter(customSink);
    reportError(new Error("a"), "ctx.a");
    reportError(new Error("b"), "ctx.b");
    reportError(new Error("c"), "ctx.c");
    expect(customSink).toHaveBeenCalledTimes(3);
  });
});
