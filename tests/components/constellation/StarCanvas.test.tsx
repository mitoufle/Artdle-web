import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StarCanvas } from "@/components/constellation/StarCanvas";

const NODE_STATES = {
  goldsmith:      { owned: false, available: true,  affordable: true  },
  patient_eye:    { owned: false, available: false, affordable: false },
  second_slot:    { owned: false, available: false, affordable: false },
  faster_strokes: { owned: false, available: false, affordable: false },
  better_brush:   { owned: false, available: false, affordable: false },
} as const;

describe("<StarCanvas />", () => {
  it("renders an SVG", () => {
    const { container } = render(
      <StarCanvas selectedId={null} onSelect={() => {}} nodeStates={NODE_STATES} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the FAME hub", () => {
    render(
      <StarCanvas selectedId={null} onSelect={() => {}} nodeStates={NODE_STATES} />,
    );
    expect(screen.getByTestId("fame-hub")).toBeInTheDocument();
    expect(screen.getByText("FAME")).toBeInTheDocument();
  });

  it("renders all 5 nodes by id", () => {
    render(
      <StarCanvas selectedId={null} onSelect={() => {}} nodeStates={NODE_STATES} />,
    );
    expect(screen.getByTestId("node-goldsmith")).toBeInTheDocument();
    expect(screen.getByTestId("node-patient_eye")).toBeInTheDocument();
    expect(screen.getByTestId("node-second_slot")).toBeInTheDocument();
    expect(screen.getByTestId("node-faster_strokes")).toBeInTheDocument();
    expect(screen.getByTestId("node-better_brush")).toBeInTheDocument();
  });

  it("renders 5 edges by from→to id pair", () => {
    render(
      <StarCanvas selectedId={null} onSelect={() => {}} nodeStates={NODE_STATES} />,
    );
    expect(screen.getByTestId("edge-fame-goldsmith")).toBeInTheDocument();
    expect(screen.getByTestId("edge-goldsmith-patient_eye")).toBeInTheDocument();
    expect(screen.getByTestId("edge-patient_eye-second_slot")).toBeInTheDocument();
    expect(screen.getByTestId("edge-second_slot-faster_strokes")).toBeInTheDocument();
    expect(screen.getByTestId("edge-faster_strokes-better_brush")).toBeInTheDocument();
  });

  it("clicking a node calls onSelect with that id", () => {
    const onSelect = vi.fn();
    render(
      <StarCanvas selectedId={null} onSelect={onSelect} nodeStates={NODE_STATES} />,
    );
    fireEvent.click(screen.getByTestId("node-goldsmith"));
    expect(onSelect).toHaveBeenCalledWith("goldsmith");
  });

  it("selected node has data-selected='true'", () => {
    render(
      <StarCanvas selectedId="goldsmith" onSelect={() => {}} nodeStates={NODE_STATES} />,
    );
    expect(screen.getByTestId("node-goldsmith")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("node-patient_eye")).not.toHaveAttribute("data-selected", "true");
  });

  it("owned node has data-state='owned'; locked has data-state='locked'; available has data-state='available'", () => {
    const states = {
      goldsmith:      { owned: true,  available: false, affordable: false },
      patient_eye:    { owned: false, available: true,  affordable: true  },
      second_slot:    { owned: false, available: false, affordable: false },
      faster_strokes: { owned: false, available: false, affordable: false },
      better_brush:   { owned: false, available: false, affordable: false },
    } as const;
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={states} />);
    expect(screen.getByTestId("node-goldsmith")).toHaveAttribute("data-state", "owned");
    expect(screen.getByTestId("node-patient_eye")).toHaveAttribute("data-state", "available");
    expect(screen.getByTestId("node-second_slot")).toHaveAttribute("data-state", "locked");
  });
});
