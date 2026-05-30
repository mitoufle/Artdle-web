import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { PLAYER_ID } from "@/core/canvasTickPure";
import { StrokeCycleBorder } from "@/components/painting/StrokeCycleBorder";

afterEach(cleanup);

describe("StrokeCycleBorder", () => {
  it("sets --fill to the player's clock / interval", () => {
    useGameStore.setState({ painterClocks: { [PLAYER_ID]: 2.5 } });
    const { getByTestId } = render(<StrokeCycleBorder interval={5} />);
    expect(getByTestId("stroke-cycle-border").style.getPropertyValue("--fill")).toBe("0.5");
  });

  it("clamps to 1 when the clock exceeds the interval", () => {
    useGameStore.setState({ painterClocks: { [PLAYER_ID]: 9 } });
    const { getByTestId } = render(<StrokeCycleBorder interval={5} />);
    expect(getByTestId("stroke-cycle-border").style.getPropertyValue("--fill")).toBe("1");
  });

  it("is 0 when interval is 0 (no divide-by-zero)", () => {
    useGameStore.setState({ painterClocks: { [PLAYER_ID]: 3 } });
    const { getByTestId } = render(<StrokeCycleBorder interval={0} />);
    expect(getByTestId("stroke-cycle-border").style.getPropertyValue("--fill")).toBe("0");
  });
});
