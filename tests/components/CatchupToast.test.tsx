import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CatchupToast } from "@/components/catchup/CatchupToast";
import { big } from "@/core/bigNumber";

describe("CatchupToast", () => {
  it("renders elapsed time + gold + inspi + canvases", () => {
    render(
      <CatchupToast
        result={{
          elapsedSeconds: 720, // 12 min
          goldGained: big(1230),
          inspiGained: big(450),
          canvasesSold: 14,
          itemsCrafted: 0,
          paintMasteryGained: big(0),
          achievementsUnlocked: [],
        }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/12 min/)).toBeInTheDocument();
    expect(screen.getByText(/14 canvases/i)).toBeInTheDocument();
  });

  it("calls onDismiss after 6 seconds", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <CatchupToast
        result={{
          elapsedSeconds: 60,
          goldGained: big(10),
          inspiGained: big(5),
          canvasesSold: 1,
          itemsCrafted: 0,
          paintMasteryGained: big(0),
          achievementsUnlocked: [],
        }}
        onDismiss={onDismiss}
      />,
    );
    vi.advanceTimersByTime(6000);
    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
