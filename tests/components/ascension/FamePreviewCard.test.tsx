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

  it("previews worker level gains when > 0", () => {
    render(<FamePreviewCard fameGain={12} workerLevelGain={7} />);
    expect(screen.getByTestId("worker-level-preview")).toHaveTextContent("+7 worker levels");
  });

  it("singularizes a single worker level", () => {
    render(<FamePreviewCard fameGain={12} workerLevelGain={1} />);
    expect(screen.getByTestId("worker-level-preview")).toHaveTextContent("+1 worker level");
  });

  it("hides the worker-level line when 0 or omitted", () => {
    render(<FamePreviewCard fameGain={12} />);
    expect(screen.queryByTestId("worker-level-preview")).not.toBeInTheDocument();
  });
});
