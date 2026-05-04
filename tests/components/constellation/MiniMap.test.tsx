import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MiniMap } from "@/components/constellation/MiniMap";

const ALL_LOCKED = {
  goldsmith: false,
  patient_eye: false,
  second_slot: false,
  faster_strokes: false,
  better_brush: false,
} as const;

describe("<MiniMap />", () => {
  it("renders an SVG", () => {
    const { container } = render(<MiniMap ownedById={ALL_LOCKED} selectedId={null} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders 5 mini-nodes by data-testid='mini-node-{id}'", () => {
    render(<MiniMap ownedById={ALL_LOCKED} selectedId={null} />);
    expect(screen.getByTestId("mini-node-goldsmith")).toBeInTheDocument();
    expect(screen.getByTestId("mini-node-better_brush")).toBeInTheDocument();
  });

  it("owned node has data-state='owned'", () => {
    const owned = { ...ALL_LOCKED, goldsmith: true } as const;
    render(<MiniMap ownedById={owned} selectedId={null} />);
    expect(screen.getByTestId("mini-node-goldsmith")).toHaveAttribute("data-state", "owned");
  });

  it("selected node has data-selected='true'", () => {
    render(<MiniMap ownedById={ALL_LOCKED} selectedId="patient_eye" />);
    expect(screen.getByTestId("mini-node-patient_eye")).toHaveAttribute("data-selected", "true");
  });

  it("renders a caption with owned/total counts", () => {
    const owned = { ...ALL_LOCKED, goldsmith: true, patient_eye: true } as const;
    render(<MiniMap ownedById={owned} selectedId={null} />);
    expect(screen.getByText(/2 \/ 5 owned/i)).toBeInTheDocument();
  });
});
