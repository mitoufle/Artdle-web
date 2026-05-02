import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { useGameStore } from "@/store";

describe("<Hoverable />", () => {
  beforeEach(() => {
    useGameStore.getState().clearHoverInfo();
  });

  it("pushes title and body on mouseEnter", () => {
    render(
      <Hoverable title="T" body="B">
        <span data-testid="target">X</span>
      </Hoverable>,
    );
    fireEvent.mouseEnter(screen.getByTestId("target").parentElement!);
    const s = useGameStore.getState();
    expect(s.hoverTitle).toBe("T");
    expect(s.hoverBody).toBe("B");
    expect(s.hoverFooter).toBe("");
  });

  it("pushes footer when provided", () => {
    render(
      <Hoverable title="T" body="B" footer="F">
        <span data-testid="target">X</span>
      </Hoverable>,
    );
    fireEvent.mouseEnter(screen.getByTestId("target").parentElement!);
    expect(useGameStore.getState().hoverFooter).toBe("F");
  });

  it("clears all hover fields on mouseLeave", () => {
    render(
      <Hoverable title="T" body="B" footer="F">
        <span data-testid="target">X</span>
      </Hoverable>,
    );
    const wrapper = screen.getByTestId("target").parentElement!;
    fireEvent.mouseEnter(wrapper);
    fireEvent.mouseLeave(wrapper);
    const s = useGameStore.getState();
    expect(s.hoverTitle).toBe("");
    expect(s.hoverBody).toBe("");
    expect(s.hoverFooter).toBe("");
  });
});
