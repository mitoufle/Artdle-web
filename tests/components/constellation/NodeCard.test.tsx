import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodeCard } from "@/components/constellation/NodeCard";

function defaultProps(overrides: Partial<Parameters<typeof NodeCard>[0]> = {}) {
  return {
    nodeId: "get_inspired",
    name: "Get Inspired",
    description: "each level increase inspiration gain by 5%",
    numericEffect: "5%",
    currentLevel: 0,
    maxLevel: 5,
    nextCost: 1,
    prereqMet: true,
    affordable: true,
    onAcquire: () => {},
    ...overrides,
  };
}

describe("<NodeCard /> (multi-level)", () => {
  it("renders node name as title", () => {
    render(<NodeCard {...defaultProps()} />);
    expect(screen.getByRole("heading", { name: /Get Inspired/i })).toBeInTheDocument();
  });

  it("renders the description body", () => {
    render(<NodeCard {...defaultProps()} />);
    expect(screen.getByText(/each level increase/i)).toBeInTheDocument();
  });

  it("renders the numericEffect line", () => {
    render(<NodeCard {...defaultProps({ numericEffect: "+10%/lvl" })} />);
    expect(screen.getByText(/\+10%\/lvl/)).toBeInTheDocument();
  });

  it("button reads 'Acquire · N fame' when level=0", () => {
    render(<NodeCard {...defaultProps({ currentLevel: 0, nextCost: 5 })} />);
    expect(screen.getByRole("button", { name: /acquire.*5/i })).toBeInTheDocument();
  });

  it("button reads 'Upgrade · N fame' when 0 < level < max", () => {
    render(<NodeCard {...defaultProps({ currentLevel: 2, nextCost: 10 })} />);
    expect(screen.getByRole("button", { name: /upgrade.*10/i })).toBeInTheDocument();
  });

  it("button reads 'Maxed' and is disabled when level == max", () => {
    render(<NodeCard {...defaultProps({ currentLevel: 5, nextCost: null })} />);
    expect(screen.getByRole("button", { name: /maxed/i })).toBeDisabled();
  });

  it("button is disabled when affordable=false", () => {
    render(<NodeCard {...defaultProps({ affordable: false })} />);
    expect(screen.getByRole("button", { name: /acquire/i })).toBeDisabled();
  });

  it("button is disabled when prereqMet=false", () => {
    render(<NodeCard {...defaultProps({ prereqMet: false })} />);
    expect(screen.getByRole("button", { name: /acquire/i })).toBeDisabled();
  });

  it("clicking the button calls onAcquire", () => {
    const onAcquire = vi.fn();
    render(<NodeCard {...defaultProps({ onAcquire })} />);
    fireEvent.click(screen.getByRole("button", { name: /acquire/i }));
    expect(onAcquire).toHaveBeenCalledOnce();
  });

  it("multi-level: shows 'Level 2 / 5' meta when level=2 maxLevel=5", () => {
    render(<NodeCard {...defaultProps({ currentLevel: 2, maxLevel: 5 })} />);
    expect(screen.getByText(/Level 2 \/ 5/i)).toBeInTheDocument();
  });
});
