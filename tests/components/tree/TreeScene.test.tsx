import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TreeScene } from "@/components/tree/TreeScene";

describe("<TreeScene />", () => {
  it("renders an SVG", () => {
    const { container } = render(<TreeScene stage={0} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("exposes the current stage via data-stage attribute", () => {
    const { container, rerender } = render(<TreeScene stage={0} />);
    expect(container.firstChild).toHaveAttribute("data-stage", "0");
    rerender(<TreeScene stage={1} />);
    expect(container.firstChild).toHaveAttribute("data-stage", "1");
    rerender(<TreeScene stage={2} />);
    expect(container.firstChild).toHaveAttribute("data-stage", "2");
  });

  it("renders a 1-based 'Tier N' badge for the current stage", () => {
    const { container, rerender } = render(<TreeScene stage={0} />);
    expect(container.querySelector('[data-testid="tier-badge"]')).toHaveTextContent("Tier 1");
    rerender(<TreeScene stage={4} />);
    expect(container.querySelector('[data-testid="tier-badge"]')).toHaveTextContent("Tier 5");
  });

  it("renders the inspiration motes group", () => {
    const { container } = render(<TreeScene stage={1} />);
    expect(container.querySelector('[data-testid="motes"]')).toBeInTheDocument();
  });

  it("renders the firefly group", () => {
    const { container } = render(<TreeScene stage={1} />);
    expect(container.querySelector('[data-testid="fireflies"]')).toBeInTheDocument();
  });

  it("renders a phase backdrop image whose src changes per stage and clamps past the last phase", () => {
    const { container, rerender } = render(<TreeScene stage={0} />);
    const initial = container.querySelector('[data-testid="phase-image"]') as HTMLImageElement | null;
    expect(initial).toBeInTheDocument();
    const stage0Src = initial?.getAttribute("src") ?? "";
    expect(stage0Src).toMatch(/phase1\./);

    rerender(<TreeScene stage={5} />);
    const stage5 = container.querySelector('[data-testid="phase-image"]') as HTMLImageElement | null;
    const stage5Src = stage5?.getAttribute("src") ?? "";
    expect(stage5Src).toMatch(/phase6\./);
    expect(stage5Src).not.toBe(stage0Src);

    // Stages past the last phase clamp to phase10 (no crash, no broken src).
    rerender(<TreeScene stage={42} />);
    const stageHigh = container.querySelector('[data-testid="phase-image"]') as HTMLImageElement | null;
    expect(stageHigh?.getAttribute("src")).toMatch(/phase10\./);
    expect(stageHigh?.getAttribute("src")).not.toBe(stage5Src);
  });
});
