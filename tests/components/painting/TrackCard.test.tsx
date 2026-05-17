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
        trackId="size"
        affixKind="+size%"
        label="Size"
        level={0}
        effectLine="—"
        costLabel="—"
        canAfford={false}
        locked={true}
        onUpgrade={() => {}}
      />,
    );
    expect(screen.getByText(/Size/i)).toBeInTheDocument();
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
        trackId="size"
        affixKind="+size%"
        label="Size"
        level={0}
        effectLine="—"
        costLabel="—"
        canAfford={false}
        locked={true}
        onUpgrade={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("track-card-upgrade-size"));
    expect(useGameStore.getState().hoverTitle).toMatch(/Size.*Locked/i);
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Unlocks via/i);
  });
});
