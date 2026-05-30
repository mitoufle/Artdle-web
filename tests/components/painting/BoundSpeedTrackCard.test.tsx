import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { PLAYER_ID } from "@/core/canvasTickPure";
import { BoundSpeedTrackCard } from "@/components/painting/BoundSpeedTrackCard";

afterEach(cleanup);

function renderCard(chunkInterval: number) {
  return render(
    <BoundSpeedTrackCard
      level={1}
      effectLine="+15% speed/level"
      chunkInterval={chunkInterval}
      costLabel="100"
      canAfford
      onUpgrade={() => {}}
    />,
  );
}

describe("BoundSpeedTrackCard — next-stroke cadence fill", () => {
  it("reflects the PLAYER's progress toward the next stroke (from painterClocks, not canvasProgress)", () => {
    // Phase B moved the player's sub-stroke timing into painterClocks['player'];
    // canvasProgress is now integer-valued, so this must NOT read it.
    useGameStore.setState({ painterClocks: { [PLAYER_ID]: 2.5 }, canvasProgress: 3 });
    const { getByTestId } = renderCard(5); // 2.5 / 5 = 50%
    expect(getByTestId("track-card-cycle-fill-speed").style.width).toBe("50%");
  });

  it("is 0% when there is no player clock yet (fresh / pre-tick)", () => {
    useGameStore.setState({ painterClocks: {}, canvasProgress: 7 });
    const { getByTestId } = renderCard(5);
    expect(getByTestId("track-card-cycle-fill-speed").style.width).toBe("0%");
  });

  it("clamps to 100% if the clock momentarily exceeds the interval", () => {
    useGameStore.setState({ painterClocks: { [PLAYER_ID]: 6 }, canvasProgress: 0 });
    const { getByTestId } = renderCard(5);
    expect(getByTestId("track-card-cycle-fill-speed").style.width).toBe("100%");
  });

  it("still shows the strokes/s rate readout", () => {
    useGameStore.setState({ painterClocks: { [PLAYER_ID]: 0 } });
    const { getByTestId } = renderCard(5); // 1/5 = 0.20
    expect(getByTestId("track-card-rate-speed").textContent).toContain("0.20 strokes/s");
  });
});
