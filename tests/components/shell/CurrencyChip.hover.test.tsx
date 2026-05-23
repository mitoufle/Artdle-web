import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CurrencyChip } from "@/components/shell/CurrencyChip";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("CurrencyChip hover wiring", () => {
  beforeEach(() => {
    useGameStore.setState({
      hoverTitle: "", hoverBody: "", hoverFooter: "",
      gold: big(0), lifetimeGold: big(0),
      inspiration: big(0), fame: big(0),
      ascendCount: 0, pastRuns: [],
      partLevels: { cotyledon: 0, tendril: 0, budtip: 0, vein: 0 },
      purchasedNodes: {}, equipped: {},
    });
  });

  it("Gold chip hover shows current + lifetime + tree/tier footer", () => {
    useGameStore.setState({ gold: big(123), lifetimeGold: big(999) });
    render(<CurrencyChip kind="gold" label="Gold" value="123" />);
    fireEvent.mouseEnter(screen.getByTestId("currency-chip-gold"));
    expect(useGameStore.getState().hoverTitle).toBe("Gold");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Current:.*123/);
    expect(container.textContent).toMatch(/Lifetime:.*999/);
    expect(String(useGameStore.getState().hoverFooter)).toMatch(/tree upgrades/);
  });

  it("Inspi chip hover shows current + per-second + ascend gate", () => {
    useGameStore.setState({ inspiration: big(50) });
    render(<CurrencyChip kind="inspi" label="Inspi" value="50" />);
    fireEvent.mouseEnter(screen.getByTestId("currency-chip-inspi"));
    expect(useGameStore.getState().hoverTitle).toBe("Inspiration");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Current:.*50/);
    expect(container.textContent).toMatch(/Per second:/);
    expect(container.textContent).toMatch(/Ascend gate.*10,000/);
  });

  it("Fame chip hover shows current + lifetime earned + ascend count", () => {
    useGameStore.setState({ fame: big(7), ascendCount: 3, pastRuns: [
      { fame: 2, ascendedAt: 1 }, { fame: 5, ascendedAt: 2 }, { fame: 1, ascendedAt: 3 },
    ] });
    render(<CurrencyChip kind="fame" label="Fame" value="7" />);
    fireEvent.mouseEnter(screen.getByTestId("currency-chip-fame"));
    expect(useGameStore.getState().hoverTitle).toBe("Fame");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Current:.*7/);
    expect(container.textContent).toMatch(/Lifetime earned:.*15/); // 7 + 2 + 5 + 1
    expect(container.textContent).toMatch(/Ascends:.*3/);
  });

});
