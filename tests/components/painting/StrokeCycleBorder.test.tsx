import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { PLAYER_ID } from "@/core/canvasTickPure";
import { StrokeCycleBorder } from "@/components/painting/StrokeCycleBorder";

afterEach(cleanup);

describe("StrokeCycleBorder", () => {
  it("fills the perimeter to the player's clock / interval", () => {
    useGameStore.setState({ painterClocks: { [PLAYER_ID]: 2.5 } });
    const { getByTestId } = render(<StrokeCycleBorder interval={5} />);
    const fill = getByTestId("stroke-cycle-fill");
    expect(fill.getAttribute("data-fill")).toBe("0.5");
    expect(fill.style.strokeDasharray).toBe("0.5 1"); // fill fraction of the perimeter
  });

  it("clamps to a full perimeter when the clock exceeds the interval", () => {
    useGameStore.setState({ painterClocks: { [PLAYER_ID]: 9 } });
    const { getByTestId } = render(<StrokeCycleBorder interval={5} />);
    expect(getByTestId("stroke-cycle-fill").getAttribute("data-fill")).toBe("1");
  });

  it("is empty when interval is 0 (no divide-by-zero)", () => {
    useGameStore.setState({ painterClocks: { [PLAYER_ID]: 3 } });
    const { getByTestId } = render(<StrokeCycleBorder interval={0} />);
    expect(getByTestId("stroke-cycle-fill").getAttribute("data-fill")).toBe("0");
  });
});
