import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InspiReadout } from "@/components/tree/InspiReadout";

describe("<InspiReadout />", () => {
  it("renders the rate with a leading +", () => {
    render(<InspiReadout rate="3.2" stageName="Sapling" />);
    expect(screen.getByText(/\+3\.2 inspi\/s/i)).toBeInTheDocument();
  });

  it("renders the stage subtext 'Stage · {name}'", () => {
    render(<InspiReadout rate="3.2" stageName="Sapling" />);
    expect(screen.getByText(/Stage · Sapling/i)).toBeInTheDocument();
  });

  it("works at 0 rate", () => {
    render(<InspiReadout rate="0" stageName="Seed" />);
    expect(screen.getByText(/\+0 inspi\/s/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage · Seed/i)).toBeInTheDocument();
  });
});
