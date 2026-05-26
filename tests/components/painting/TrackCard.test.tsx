import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrackCard } from "@/components/painting/TrackCard";
import { useGameStore } from "@/store";

describe("<TrackCard>", () => {
  it("renders track name + level + cost label when unlocked", () => {
    render(
      <TrackCard
        trackId="sell_price"
        affixKind="+sell_price%"
        label="Sell Price"
        level={3}
        effectLine="+30% gold per sale"
        costLabel="150g"
        canAfford={true}
        locked={false}
        onUpgrade={() => {}}
      />,
    );
    expect(screen.getByText(/Sell Price/i)).toBeInTheDocument();
    expect(screen.getByText(/Level 3/i)).toBeInTheDocument();
    expect(screen.getByText(/\+30% gold per sale/i)).toBeInTheDocument();
    expect(screen.getByText(/150g/)).toBeInTheDocument();
  });

  it("renders 'Locked' state when locked=true (no upgrade button or disabled)", () => {
    render(
      <TrackCard
        trackId="crit"
        affixKind="+crit_chunks"
        label="Crit"
        level={0}
        effectLine="—"
        costLabel="—"
        canAfford={false}
        locked={true}
        onUpgrade={() => {}}
      />,
    );
    expect(screen.getByText(/Crit/i)).toBeInTheDocument();
    expect(screen.getByText(/Locked/i)).toBeInTheDocument();
    const btn = screen.queryByRole("button");
    expect(btn === null || (btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables the upgrade button when !canAfford", () => {
    render(
      <TrackCard
        trackId="speed"
        affixKind="+speed%"
        label="Speed"
        level={1}
        effectLine="+5% speed"
        costLabel="150g"
        canAfford={false}
        locked={false}
        onUpgrade={() => {}}
      />,
    );
    const btn = screen.getByTestId("track-card-upgrade-speed") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("calls onUpgrade when the upgrade button is clicked (unlocked + affordable)", () => {
    const fn = vi.fn();
    render(
      <TrackCard
        trackId="speed"
        affixKind="+speed%"
        label="Speed"
        level={1}
        effectLine="+5% speed"
        costLabel="100g"
        canAfford={true}
        locked={false}
        onUpgrade={fn}
      />,
    );
    fireEvent.click(screen.getByTestId("track-card-upgrade-speed"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("TrackCard — MAX label at maxLevel", () => {
  it("renders 'MAX' and disables the button when level >= maxLevel", () => {
    const onUpgrade = vi.fn();
    render(
      <TrackCard
        trackId="crit"
        label="Crit"
        iconOverride="✦"
        colorOverride="#e85c5c"
        level={50}
        maxLevel={50}
        effectLine="+1% crit chance/level"
        costLabel="—"
        canAfford={true}
        locked={false}
        onUpgrade={onUpgrade}
      />,
    );
    const button = screen.getByTestId("track-card-upgrade-crit");
    expect(button).toBeDisabled();
    expect(button.textContent).toMatch(/MAX/i);
  });

  it("renders the cost label when level < maxLevel", () => {
    render(
      <TrackCard
        trackId="crit"
        label="Crit"
        iconOverride="✦"
        colorOverride="#e85c5c"
        level={10}
        maxLevel={50}
        effectLine="+1% crit chance/level"
        costLabel="500"
        canAfford={true}
        locked={false}
        onUpgrade={() => {}}
      />,
    );
    const button = screen.getByTestId("track-card-upgrade-crit");
    expect(button).not.toBeDisabled();
    expect(button.textContent).not.toMatch(/MAX/i);
  });
});

describe("TrackCard — iconOverride (for crit-chance card without an AffixKind)", () => {
  it("uses iconOverride and colorOverride when provided (no affixKind)", () => {
    const { container } = render(
      <TrackCard
        trackId="crit"
        label="Crit Chance"
        iconOverride="✦"
        colorOverride="#e85c5c"
        level={5}
        effectLine="+1% chance/level"
        costLabel="500"
        canAfford={true}
        locked={false}
        onUpgrade={() => {}}
      />,
    );
    expect(container.textContent).toContain("✦");
  });

  it("falls back to AFFIX_SYMBOL lookup when affixKind is provided", () => {
    const { container } = render(
      <TrackCard
        trackId="sell_price"
        label="Sell Price"
        affixKind="+sell_price%"
        level={3}
        effectLine="+10% gold/level"
        costLabel="100"
        canAfford={true}
        locked={false}
        onUpgrade={() => {}}
      />,
    );
    expect(container.textContent).toContain("$");  // AFFIX_SYMBOL["+sell_price%"]
  });
});

describe("<TrackCard> — hover info", () => {
  beforeEach(() => {
    useGameStore.setState({ hoverTitle: "", hoverBody: "", hoverFooter: "" });
  });

  it("hover on upgrade button pushes title with track label", () => {
    render(
      <TrackCard
        trackId="sell_price"
        affixKind="+sell_price%"
        label="Sell Price"
        level={1}
        effectLine="+10% gold/level"
        costLabel="100g"
        canAfford={true}
        locked={false}
        onUpgrade={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("track-card-upgrade-sell_price"));
    expect(useGameStore.getState().hoverTitle).toMatch(/Sell Price.*Level 1/i);
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Current effect/);
    expect(container.textContent).toMatch(/100g/);
  });

  it("hover on locked card pushes title with 'Locked'", () => {
    render(
      <TrackCard
        trackId="crit"
        affixKind="+crit_chunks"
        label="Crit"
        level={0}
        effectLine="—"
        costLabel="—"
        canAfford={false}
        locked={true}
        onUpgrade={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("track-card-upgrade-crit"));
    expect(useGameStore.getState().hoverTitle).toMatch(/Crit.*Locked/i);
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Unlocks via/i);
  });
});
