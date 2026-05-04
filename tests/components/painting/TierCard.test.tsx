import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TierCard } from "@/components/painting/TierCard";

describe("<TierCard />", () => {
  it("renders 'Canvas Tier' label", () => {
    render(
      <TierCard tier={1} cost="100" canAfford={true} isMax={false} onUpgrade={() => {}} />,
    );
    expect(screen.getByText(/Canvas Tier/i)).toBeInTheDocument();
  });

  it("renders current → next tier as roman numerals", () => {
    render(
      <TierCard tier={2} cost="278" canAfford={true} isMax={false} onUpgrade={() => {}} />,
    );
    expect(screen.getByText("II")).toBeInTheDocument();
    expect(screen.getByText("III")).toBeInTheDocument();
  });

  it("renders 'Upgrade · {cost}g' button label", () => {
    render(
      <TierCard tier={1} cost="100" canAfford={true} isMax={false} onUpgrade={() => {}} />,
    );
    expect(screen.getByRole("button")).toHaveTextContent(/Upgrade.*100/);
  });

  it("button is disabled when canAfford=false", () => {
    render(
      <TierCard tier={1} cost="100" canAfford={false} isMax={false} onUpgrade={() => {}} />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onUpgrade when button clicked and affordable", () => {
    const onUpgrade = vi.fn();
    render(
      <TierCard tier={1} cost="100" canAfford={true} isMax={false} onUpgrade={onUpgrade} />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onUpgrade).toHaveBeenCalledOnce();
  });

  it("at MAX tier, shows 'Tier MAX' label and button is disabled", () => {
    render(
      <TierCard tier={10} cost="0" canAfford={false} isMax={true} onUpgrade={() => {}} />,
    );
    expect(screen.getAllByText(/Tier MAX/i)).toHaveLength(2); // in numerals + button
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
