import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { CanvasSoldSfx } from "@/components/shell/CanvasSoldSfx";

const started = { count: 0 };
let lastGain: { value: number } | null = null;

class FakeAudioContext {
  state = "running";
  destination = {} as AudioDestinationNode;
  resume = vi.fn();
  close = vi.fn();
  createGain() {
    lastGain = { value: 0 };
    return { gain: lastGain, connect: (n: unknown) => n } as unknown as GainNode;
  }
  createBufferSource() {
    return {
      buffer: null,
      connect: (n: unknown) => n,
      start: () => {
        started.count += 1;
      },
    } as unknown as AudioBufferSourceNode;
  }
  decodeAudioData() {
    return Promise.resolve({} as AudioBuffer);
  }
}

function setSold(n: number): void {
  useGameStore.setState((s) => ({ statsRun: { ...s.statsRun, canvasesSold: n } }));
}

// Flush the fetch → arrayBuffer → decodeAudioData microtask chain.
async function flushDecode(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("CanvasSoldSfx", () => {
  beforeEach(() => {
    localStorage.clear();
    started.count = 0;
    lastGain = null;
    vi.stubGlobal("AudioContext", FakeAudioContext as unknown as typeof AudioContext);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    );
    setSold(0);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("plays once when a canvas sells, amplified by the volume slider (× boost)", async () => {
    localStorage.setItem("artdle-music-volume", "0.2");
    render(<CanvasSoldSfx />);
    await flushDecode();
    act(() => setSold(1));
    expect(started.count).toBe(1);
    expect(lastGain?.value).toBeCloseTo(0.5); // 0.2 × 2.5 boost
  });

  it("does not play when the count is unchanged or drops (ascend reset)", async () => {
    setSold(3);
    render(<CanvasSoldSfx />);
    await flushDecode();
    act(() => setSold(3)); // unchanged
    act(() => setSold(0)); // reset on ascend
    expect(started.count).toBe(0);
  });

  it("is silenced by the mute button", async () => {
    localStorage.setItem("artdle-music-muted", "true");
    render(<CanvasSoldSfx />);
    await flushDecode();
    act(() => setSold(1));
    expect(started.count).toBe(0);
  });

  it("is silenced when the volume slider is at zero", async () => {
    localStorage.setItem("artdle-music-volume", "0");
    render(<CanvasSoldSfx />);
    await flushDecode();
    act(() => setSold(1));
    expect(started.count).toBe(0);
  });
});
