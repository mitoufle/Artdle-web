import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfoPanel } from "@/components/shell/InfoPanel";
import { useGameStore } from "@/store";

describe("<InfoPanel /> (new shell)", () => {
  beforeEach(() => {
    useGameStore.getState().clearHoverInfo();
  });

  it("renders nothing visible when no hover state", () => {
    render(<InfoPanel />);
    // Empty placeholder div; no title or body.
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("renders title + body when hover is pushed", () => {
    useGameStore.getState().pushHoverInfo("Roots", "Lv 4 · +0.6 inspi/s", "Cost 480g");
    render(<InfoPanel />);
    expect(screen.getByText("Roots")).toBeInTheDocument();
    expect(screen.getByText("Lv 4 · +0.6 inspi/s")).toBeInTheDocument();
    expect(screen.getByText("Cost 480g")).toBeInTheDocument();
  });

  it("clears when clearHoverInfo is called", () => {
    useGameStore.getState().pushHoverInfo("Foo", "Bar", "");
    const { rerender } = render(<InfoPanel />);
    expect(screen.getByText("Foo")).toBeInTheDocument();
    useGameStore.getState().clearHoverInfo();
    rerender(<InfoPanel />);
    expect(screen.queryByText("Foo")).not.toBeInTheDocument();
  });
});
