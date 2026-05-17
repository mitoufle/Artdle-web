import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FamePreviewCard } from "@/components/ascension/FamePreviewCard";

describe("<FamePreviewCard />", () => {
  it("renders 'If you ascend now' header", () => {
    render(<FamePreviewCard fameGain={12} />);
    expect(screen.getByText(/If you ascend now/i)).toBeInTheDocument();
  });

  it("renders the fame gain value", () => {
    const { container } = render(<FamePreviewCard fameGain={12} />);
    expect(container.textContent).toContain("12");
  });

  it("renders the permanence caption", () => {
    render(<FamePreviewCard fameGain={5} />);
    expect(screen.getByText(/permanent/i)).toBeInTheDocument();
  });
});
