import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CatchupLoadingScene } from "@/components/catchup/CatchupLoadingScene";

describe("CatchupLoadingScene", () => {
  it("renders elapsed time and progress bar", () => {
    render(<CatchupLoadingScene elapsedSeconds={4 * 3600 + 23 * 60} progress={0.68} />);
    expect(screen.getByText(/4h 23min/)).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("68");
  });

  it("clamps progress to [0, 1]", () => {
    const { rerender } = render(<CatchupLoadingScene elapsedSeconds={3600} progress={-0.5} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    rerender(<CatchupLoadingScene elapsedSeconds={3600} progress={1.5} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });
});
