import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScalingMathPanel } from "@/components/shell/ScalingMathPanel";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("ScalingMathPanel", () => {
  beforeEach(() => {
    useGameStore.setState({
      workshopLevel: 1,
      canvasTier: 1,
      purchasedNodes: {},
      paintMastery: big(0),
      partLevels: { spark: 0, bud: 0, leaf: 0, branch: 0 },
      equipped: {},
    });
  });

  it("renders a SCALING heading and a Fame on Ascend section", () => {
    render(<ScalingMathPanel />);
    expect(screen.getByText(/SCALING/i)).toBeInTheDocument();
    expect(screen.getByTestId("scaling-fame")).toBeInTheDocument();
  });

  it("Fame on Ascend section includes the milestone table", () => {
    render(<ScalingMathPanel />);
    const section = screen.getByTestId("scaling-fame");
    expect(section.textContent).toMatch(/10k.*1/);
    expect(section.textContent).toMatch(/1M.*102/);
    expect(section.textContent).toMatch(/1B.*10,000/);
  });

  it("Craft Cost section reflects the current workshop level", () => {
    useGameStore.setState({ workshopLevel: 10 });
    render(<ScalingMathPanel />);
    const section = screen.getByTestId("scaling-craft-cost");
    expect(section.textContent).toMatch(/Lv 10/);
  });

  it("Tier Upgrade Cost section reflects the current canvas tier", () => {
    useGameStore.setState({ canvasTier: 5 });
    render(<ScalingMathPanel />);
    const section = screen.getByTestId("scaling-tier-cost");
    expect(section.textContent).toMatch(/tier 5/i);
  });
});
