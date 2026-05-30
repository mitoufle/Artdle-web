import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MiniMap } from "@/components/constellation/MiniMap";
import { DEFAULT_VIEWPORT } from "@/components/constellation/viewport";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import { SKILL_NODES } from "@/config/skillTreeNodes";

// Build an all-locked map from the live SKILL_NODES list so it stays in sync.
const ALL_LOCKED: Record<SkillNodeId, boolean> = Object.fromEntries(
  SKILL_NODES.map((n) => [n.id, false]),
) as Record<SkillNodeId, boolean>;

describe("<MiniMap />", () => {
  it("renders an SVG", () => {
    const { container } = render(<MiniMap ownedById={ALL_LOCKED} selectedId={null} viewport={DEFAULT_VIEWPORT} onJump={() => {}} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders mini-nodes by data-testid='mini-node-{id}'", () => {
    render(<MiniMap ownedById={ALL_LOCKED} selectedId={null} viewport={DEFAULT_VIEWPORT} onJump={() => {}} />);
    expect(screen.getByTestId("mini-node-get_inspired")).toBeInTheDocument();
    expect(screen.getByTestId("mini-node-black_white")).toBeInTheDocument();
  });

  it("owned node has data-state='owned'", () => {
    const owned = { ...ALL_LOCKED, get_inspired: true };
    render(<MiniMap ownedById={owned} selectedId={null} viewport={DEFAULT_VIEWPORT} onJump={() => {}} />);
    expect(screen.getByTestId("mini-node-get_inspired")).toHaveAttribute("data-state", "owned");
  });

  it("selected node has data-selected='true'", () => {
    render(<MiniMap ownedById={ALL_LOCKED} selectedId="black_white" viewport={DEFAULT_VIEWPORT} onJump={() => {}} />);
    expect(screen.getByTestId("mini-node-black_white")).toHaveAttribute("data-selected", "true");
  });

  it("renders a caption with owned/total counts", () => {
    const owned = { ...ALL_LOCKED, get_inspired: true, black_white: true };
    render(<MiniMap ownedById={owned} selectedId={null} viewport={DEFAULT_VIEWPORT} onJump={() => {}} />);
    const total = SKILL_NODES.length;
    expect(screen.getByText(new RegExp(`2 / ${total} owned`, "i"))).toBeInTheDocument();
  });

  it("has no fame-hub circle (fill var(--fame) dot was removed)", () => {
    const { container } = render(
      <MiniMap ownedById={ALL_LOCKED} selectedId={null} viewport={DEFAULT_VIEWPORT} onJump={() => {}} />,
    );
    expect(container.querySelector('circle[fill="var(--fame)"]')).toBeNull();
  });
});
