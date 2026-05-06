import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThresholdPanel } from "@/components/ascension/ThresholdPanel";

describe("<ThresholdPanel />", () => {
  it("renders current inspiration as a big mono number", () => {
    render(<ThresholdPanel currentInspi="847,000" />);
    expect(screen.getByText("847,000")).toBeInTheDocument();
  });

  it("renders the 'Current inspiration' subhead", () => {
    render(<ThresholdPanel currentInspi="42" />);
    expect(screen.getByText(/current inspiration/i)).toBeInTheDocument();
  });
});
