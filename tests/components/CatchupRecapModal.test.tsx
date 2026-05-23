import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CatchupRecapModal } from "@/components/catchup/CatchupRecapModal";
import { big } from "@/core/bigNumber";

describe("CatchupRecapModal", () => {
  it("renders all summary fields and calls onContinue", () => {
    const onContinue = vi.fn();
    render(
      <CatchupRecapModal
        result={{
          elapsedSeconds: 4 * 3600 + 23 * 60,
          goldGained: big(12400),
          inspiGained: big(8100),
          canvasesSold: 287,
          itemsCrafted: 3,
          achievementsUnlocked: ["Millionaire", "T3"],
        }}
        onContinue={onContinue}
      />
    );
    expect(screen.getByText(/4h 23min/)).toBeInTheDocument();
    expect(screen.getByText(/287/)).toBeInTheDocument();
    expect(screen.getByText(/Millionaire/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("omits the achievements section when none unlocked", () => {
    render(
      <CatchupRecapModal
        result={{
          elapsedSeconds: 60,
          goldGained: big(10),
          inspiGained: big(5),
          canvasesSold: 1,
          itemsCrafted: 0,
          achievementsUnlocked: [],
        }}
        onContinue={() => {}}
      />
    );
    expect(screen.queryByText(/unlocked/i)).toBeNull();
  });
});
