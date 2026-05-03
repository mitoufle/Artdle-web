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

  it("renders the inspiration motes group", () => {
    const { container } = render(<TreeScene stage={1} />);
    expect(container.querySelector('[data-testid="motes"]')).toBeInTheDocument();
  });

  it("renders the firefly group", () => {
    const { container } = render(<TreeScene stage={1} />);
    expect(container.querySelector('[data-testid="fireflies"]')).toBeInTheDocument();
  });

  it("renders the tree group with stage-specific data-tree-stage", () => {
    const { container, rerender } = render(<TreeScene stage={0} />);
    expect(container.querySelector('[data-testid="tree"]')).toHaveAttribute("data-tree-stage", "seed");
    rerender(<TreeScene stage={1} />);
    expect(container.querySelector('[data-testid="tree"]')).toHaveAttribute("data-tree-stage", "sapling");
    rerender(<TreeScene stage={2} />);
    expect(container.querySelector('[data-testid="tree"]')).toHaveAttribute("data-tree-stage", "tree");
  });
});
