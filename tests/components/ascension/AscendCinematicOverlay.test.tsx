import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { createBaseStats } from "@/core/workerModel";
import { AscendCinematicOverlay } from "@/components/ascension/AscendCinematicOverlay";

afterEach(cleanup);

function renderBlackout(onDismiss: () => void) {
  return render(
    <AscendCinematicOverlay phase="blackout" fameGain={100} quote="q" onDismiss={onDismiss} />,
  );
}

describe("AscendCinematicOverlay — two-stage click", () => {
  it("with no level-ups, the first click dismisses", () => {
    useGameStore.setState({ lastAscendRoll: null, roster: [] });
    const onDismiss = vi.fn();
    renderBlackout(onDismiss);
    fireEvent.click(screen.getByTestId("ascend-cinematic-overlay"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("with level-ups, the first click skips (no dismiss) and the second dismisses", () => {
    const w = { ...createWorker(), name: "Frida", avatar: 2 };
    const before = createBaseStats();
    const after = { ...before, goldPct: 0.03 };
    useGameStore.setState({
      roster: [w],
      lastAscendRoll: [{ id: w.id, levelBefore: 1, levelAfter: 2, statsBefore: before, statsAfter: after }],
    });
    const onDismiss = vi.fn();
    renderBlackout(onDismiss);
    const overlay = screen.getByTestId("ascend-cinematic-overlay");

    act(() => { fireEvent.click(overlay); }); // skip
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { fireEvent.click(overlay); }); // dismiss
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
