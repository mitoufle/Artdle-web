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
