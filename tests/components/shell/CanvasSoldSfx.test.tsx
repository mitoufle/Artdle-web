import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { CanvasSoldSfx } from "@/components/shell/CanvasSoldSfx";

function setSold(n: number): void {
  useGameStore.setState((s) => ({ statsRun: { ...s.statsRun, canvasesSold: n } }));
}

describe("CanvasSoldSfx", () => {
  let play: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    play = vi
      .spyOn(window.HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined as never);
    setSold(0);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("plays the sound once when a canvas sells", () => {
    render(<CanvasSoldSfx />);
    act(() => setSold(1));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("does not play when the count is unchanged or drops (ascend reset)", () => {
    setSold(3);
    render(<CanvasSoldSfx />);
    act(() => setSold(3)); // unchanged
    act(() => setSold(0)); // reset on ascend
    expect(play).not.toHaveBeenCalled();
  });

  it("does not play when music is muted", () => {
    localStorage.setItem("artdle-music-muted", "true");
    render(<CanvasSoldSfx />);
    act(() => setSold(1));
    expect(play).not.toHaveBeenCalled();
  });
});
