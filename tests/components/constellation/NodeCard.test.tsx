import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodeCard } from "@/components/constellation/NodeCard";

describe("<NodeCard />", () => {
  it("renders node name as title", () => {
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={1}
        prereqMet={true}
        affordable={true}
        owned={false}
        description="+10% gold from canvas sales."
        onAcquire={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: /Goldsmith/i })).toBeInTheDocument();
  });

  it("renders the description body", () => {
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={1}
        prereqMet={true}
        affordable={true}
        owned={false}
        description="+10% gold from canvas sales."
        onAcquire={() => {}}
      />,
    );
    expect(screen.getByText(/\+10% gold from canvas sales/i)).toBeInTheDocument();
  });

  it("renders the cost meta line", () => {
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={3}
        prereqMet={true}
        affordable={true}
        owned={false}
        description="x"
        onAcquire={() => {}}
      />,
    );
    expect(screen.getByText(/3 fame · prereq met/i)).toBeInTheDocument();
  });

  it("Acquire button is enabled when prereqMet + affordable + not owned", () => {
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={1}
        prereqMet={true}
        affordable={true}
        owned={false}
        description="x"
        onAcquire={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /acquire/i })).not.toBeDisabled();
  });

  it("Acquire button is disabled when owned", () => {
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={1}
        prereqMet={true}
        affordable={true}
        owned={true}
        description="x"
        onAcquire={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /acquired|owned/i })).toBeDisabled();
  });

  it("Acquire button is disabled when cannot afford", () => {
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={100}
        prereqMet={true}
        affordable={false}
        owned={false}
        description="x"
        onAcquire={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /acquire/i })).toBeDisabled();
  });

  it("clicking Acquire calls onAcquire", () => {
    const onAcquire = vi.fn();
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={1}
        prereqMet={true}
        affordable={true}
        owned={false}
        description="x"
        onAcquire={onAcquire}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /acquire/i }));
    expect(onAcquire).toHaveBeenCalledOnce();
  });
});
