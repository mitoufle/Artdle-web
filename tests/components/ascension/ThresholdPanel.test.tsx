import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThresholdPanel } from "@/components/ascension/ThresholdPanel";

describe("<ThresholdPanel />", () => {
  it("renders current inspiration as a big mono number", () => {
    render(
      <ThresholdPanel currentInspi="847,000" thresholdInspi="1.20M" progressPct={0.7} />,
    );
    expect(screen.getByText("847,000")).toBeInTheDocument();
  });

  it("renders the threshold caption '{N}% to threshold'", () => {
    render(
      <ThresholdPanel currentInspi="847K" thresholdInspi="1.2M" progressPct={0.7} />,
    );
    expect(screen.getByText(/70% to threshold/i)).toBeInTheDocument();
  });

  it("progress bar reflects progressPct via inline width", () => {
    const { container } = render(
      <ThresholdPanel currentInspi="50" thresholdInspi="100" progressPct={0.5} />,
    );
    const fill = container.querySelector('[data-testid="threshold-fill"]') as HTMLElement;
    expect(fill?.style.width).toBe("50%");
  });
});
