import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { StatsRoom } from "@/components/painting/StatsRoom";
import { useGameStore } from "@/store";

describe("StatsRoom — crit labels reflect chunk semantics", () => {
  beforeEach(() => {
    // Set up a state with some crit level so the Crit block renders (not hidden).
    useGameStore.setState({ critLevel: 5 });
  });

  it("uses 'chunk' wording for crit-related stats", () => {
    const { container } = render(<StatsRoom />);
    const text = container.textContent ?? "";
    // Labels must mention "chunk" somewhere on a crit row.
    expect(text).toMatch(/crit.*chunk/i);
  });

  it("does not use the old 'crit canvas' wording", () => {
    const { container } = render(<StatsRoom />);
    const text = container.textContent ?? "";
    expect(text.toLowerCase()).not.toMatch(/crit (canvas|canvases)/);
  });

  it("crit row uses ✦ star icon instead of a sell-price symbol", () => {
    const { container } = render(<StatsRoom />);
    expect(container.textContent).toContain("✦");
  });
});

describe("StatsRoom — crit chance breakdown surfaces every source", () => {
  beforeEach(() => {
    useGameStore.setState({
      critLevel: 5,
      purchasedNodes: {},
      equipped: {},
      roster: [],
    });
  });

  it("always shows the Base 1% line (it's the always-on floor)", () => {
    const { container } = render(<StatsRoom />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/Base/);
    // Base 1% + Canvas upgrade (critLevel=5 × CRIT_PER_LEVEL=1%) = 6%.
    expect(text).toMatch(/6\.0%/);
  });

  it("shows the Skill tree line only when a crit_chance node is purchased", () => {
    const { container, rerender } = render(<StatsRoom />);
    expect(container.textContent ?? "").not.toMatch(/Skill tree/);
    useGameStore.setState({ purchasedNodes: { consistency: 3 } });
    rerender(<StatsRoom />);
    expect(container.textContent ?? "").toMatch(/Skill tree/);
  });

  it("consistency contributes +1% per level to the crit total", () => {
    const { container } = render(<StatsRoom />);
    // Baseline: Base 1% + Canvas 5% = 6%.
    expect(container.textContent ?? "").toMatch(/6\.0%/);
    useGameStore.setState({ critLevel: 5, purchasedNodes: { consistency: 5 } });
    const { container: c2 } = render(<StatsRoom />);
    // Add +5% from consistency → 11%.
    expect(c2.textContent ?? "").toMatch(/11\.0%/);
  });
});

describe("StatsRoom — crit chunks block", () => {
  beforeEach(() => {
    useGameStore.setState({
      critLevel: 5,    // so the parent Crit chance block renders too
      purchasedNodes: {},
      equipped: {},
      roster: [],
    });
  });

  it("renders 'Crit chunks (per crit)' with a Base +1 line and ⚡ icon", () => {
    const { container } = render(<StatsRoom />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/Crit chunks/);
    expect(text).toContain("⚡");
    expect(text).toMatch(/Base/);
  });
});
