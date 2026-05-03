import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AscensionRoute } from "@/routes/AscensionRoute";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("<AscensionRoute />", () => {
  beforeEach(() => {
    // Fresh: ascendCount=0, palier=1000, no skill nodes, inspi=0.
    useGameStore.setState({
      ascendCount: 0,
      inspiration: big(0),
      gold: big(0),
      fame: big(0),
      purchasedNodes: {},
    });
  });

  it("disables the Ascend button when inspiration < palier", () => {
    useGameStore.setState({ inspiration: big(500) }); // < 1000
    render(<AscensionRoute />);
    expect(screen.getByRole("button", { name: /ascend/i })).toBeDisabled();
  });

  it("enables the Ascend button when inspiration >= palier", () => {
    useGameStore.setState({ inspiration: big(1000) }); // == 1000
    render(<AscensionRoute />);
    expect(screen.getByRole("button", { name: /ascend/i })).not.toBeDisabled();
  });

  it("clicking the enabled Ascend button performs the ascend", () => {
    useGameStore.setState({ inspiration: big(10000) });
    render(<AscensionRoute />);
    fireEvent.click(screen.getByRole("button", { name: /ascend/i }));
    const s = useGameStore.getState();
    expect(s.inspiration.toNumber()).toBe(0);
    expect(s.ascendCount).toBe(1);
    expect(s.fame.toNumber()).toBeGreaterThan(0);
  });
});
