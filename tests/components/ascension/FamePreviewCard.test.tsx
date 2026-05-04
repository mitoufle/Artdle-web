import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FamePreviewCard } from "@/components/ascension/FamePreviewCard";

describe("<FamePreviewCard />", () => {
  it("renders 'If you ascend now' header", () => {
    render(<FamePreviewCard fameGain={12} />);
    expect(screen.getByText(/If you ascend now/i)).toBeInTheDocument();
  });

  it("renders the fame gain with a leading +", () => {
    render(<FamePreviewCard fameGain={12} />);
    expect(screen.getByText(/\+12/)).toBeInTheDocument();
  });

  it("renders the permanence caption", () => {
    render(<FamePreviewCard fameGain={5} />);
    expect(screen.getByText(/permanent/i)).toBeInTheDocument();
  });
});
