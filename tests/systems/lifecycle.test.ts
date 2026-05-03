import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { installLifecycle, defaultLifecycleHooks } from "@/systems/lifecycle";
import { setErrorReporter, resetErrorReporter } from "@/systems/telemetry";
import { persistedAdapter } from "@/systems/persistence";
import * as tickLoop from "@/core/tickLoop";

describe("installLifecycle()", () => {
  let cleanup: () => void = () => {};
  let hiddenSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    cleanup = () => {};
  });

  afterEach(() => {
    cleanup();
    if (hiddenSpy) {
      hiddenSpy.mockRestore();
      hiddenSpy = null;
    }
  });

  function setHidden(value: boolean): void {
    hiddenSpy?.mockRestore();
    hiddenSpy = vi.spyOn(document, "hidden", "get").mockReturnValue(value);
  }

  it("fires onHide when visibilitychange and document.hidden is true", () => {
    const hooks = { onHide: vi.fn(), onShow: vi.fn(), onUnload: vi.fn() };
    cleanup = installLifecycle(hooks);
    setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(hooks.onHide).toHaveBeenCalledOnce();
    expect(hooks.onShow).not.toHaveBeenCalled();
  });

  it("fires onShow when visibilitychange and document.hidden is false", () => {
    const hooks = { onHide: vi.fn(), onShow: vi.fn(), onUnload: vi.fn() };
    cleanup = installLifecycle(hooks);
    setHidden(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(hooks.onShow).toHaveBeenCalledOnce();
    expect(hooks.onHide).not.toHaveBeenCalled();
  });

  it("fires onUnload on beforeunload", () => {
    const hooks = { onHide: vi.fn(), onShow: vi.fn(), onUnload: vi.fn() };
    cleanup = installLifecycle(hooks);
    window.dispatchEvent(new Event("beforeunload"));
    expect(hooks.onUnload).toHaveBeenCalledOnce();
  });

  it("cleanup() removes both listeners", () => {
    const hooks = { onHide: vi.fn(), onShow: vi.fn(), onUnload: vi.fn() };
    cleanup = installLifecycle(hooks);
    cleanup();
    cleanup = () => {};
    setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("beforeunload"));
    expect(hooks.onHide).not.toHaveBeenCalled();
    expect(hooks.onUnload).not.toHaveBeenCalled();
  });
});

describe("defaultLifecycleHooks", () => {
  let pauseSpy: ReturnType<typeof vi.spyOn>;
  let resumeSpy: ReturnType<typeof vi.spyOn>;
  let flushSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pauseSpy = vi.spyOn(tickLoop, "pauseTickLoop").mockImplementation(() => {});
    resumeSpy = vi.spyOn(tickLoop, "resumeTickLoop").mockImplementation(() => {});
    flushSpy = vi.spyOn(persistedAdapter, "flush").mockResolvedValue();
    resetErrorReporter();
  });

  afterEach(() => {
    pauseSpy.mockRestore();
    resumeSpy.mockRestore();
    flushSpy.mockRestore();
    resetErrorReporter();
  });

  it("onHide pauses tickLoop AND triggers persist flush", () => {
    defaultLifecycleHooks.onHide();
    expect(pauseSpy).toHaveBeenCalledOnce();
    expect(flushSpy).toHaveBeenCalledOnce();
  });

  it("onShow resumes tickLoop only (no flush)", () => {
    defaultLifecycleHooks.onShow();
    expect(resumeSpy).toHaveBeenCalledOnce();
    expect(flushSpy).not.toHaveBeenCalled();
  });

  it("onUnload triggers persist flush only (no pause)", () => {
    defaultLifecycleHooks.onUnload();
    expect(flushSpy).toHaveBeenCalledOnce();
    expect(pauseSpy).not.toHaveBeenCalled();
  });

  it("onHide flush rejection is routed through reportError", async () => {
    const errorSink = vi.fn();
    setErrorReporter(errorSink);
    flushSpy.mockRejectedValueOnce(new Error("hide-flush-boom"));

    defaultLifecycleHooks.onHide();
    await new Promise((r) => setTimeout(r, 0));

    expect(errorSink).toHaveBeenCalledOnce();
    const [err, ctx] = errorSink.mock.calls[0]!;
    expect((err as Error).message).toBe("hide-flush-boom");
    expect(ctx).toBe("persist.flush.visibilitychange");
  });

  it("onUnload flush rejection is routed through reportError", async () => {
    const errorSink = vi.fn();
    setErrorReporter(errorSink);
    flushSpy.mockRejectedValueOnce(new Error("unload-flush-boom"));

    defaultLifecycleHooks.onUnload();
    await new Promise((r) => setTimeout(r, 0));

    expect(errorSink).toHaveBeenCalledOnce();
    const [err, ctx] = errorSink.mock.calls[0]!;
    expect((err as Error).message).toBe("unload-flush-boom");
    expect(ctx).toBe("persist.flush.beforeunload");
  });
});
