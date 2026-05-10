import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrackCard } from "@/components/painting/TrackCard";

describe("<TrackCard>", () => {
  it("renders track name + level + cost label when unlocked", () => {
    render(
      <TrackCard
        trackId="sell_price"
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
    const btn = screen.queryByRole("button", { name: /Upgrade/i });
    expect(btn === null || (btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables the upgrade button when !canAfford", () => {
    render(
      <TrackCard
        trackId="speed"
        label="Speed"
        level={1}
        effectLine="+5% speed"
        costLabel="150g"
        canAfford={false}
        locked={false}
        onUpgrade={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: /Upgrade/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("calls onUpgrade when the upgrade button is clicked (unlocked + affordable)", () => {
    const fn = vi.fn();
    render(
      <TrackCard
        trackId="speed"
        label="Speed"
        level={1}
        effectLine="+5% speed"
        costLabel="100g"
        canAfford={true}
        locked={false}
        onUpgrade={fn}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Upgrade/i }));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
