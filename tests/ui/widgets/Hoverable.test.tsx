import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

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

  it("resolves callback title at hover time", () => {
    render(
      <Hoverable title={() => "LiveTitle"} body="B">
        <span data-testid="target">X</span>
      </Hoverable>,
    );
    fireEvent.mouseEnter(screen.getByTestId("target").parentElement!);
    expect(useGameStore.getState().hoverTitle).toBe("LiveTitle");
  });

  it("resolves callback body at hover time using getState()", () => {
    useGameStore.setState({ gold: big(42) });
    render(
      <Hoverable
        title="T"
        body={() => `Gold: ${useGameStore.getState().gold.toString()}`}
      >
        <span data-testid="target">X</span>
      </Hoverable>,
    );
    fireEvent.mouseEnter(screen.getByTestId("target").parentElement!);
    expect(useGameStore.getState().hoverBody).toBe("Gold: 42");
  });

  it("re-resolves callback on each mouseEnter so post-state-change reads see new value", () => {
    useGameStore.setState({ gold: big(10) });
    render(
      <Hoverable
        title="T"
        body={() => `Gold: ${useGameStore.getState().gold.toString()}`}
      >
        <span data-testid="target">X</span>
      </Hoverable>,
    );
    const wrapper = screen.getByTestId("target").parentElement!;
    fireEvent.mouseEnter(wrapper);
    expect(useGameStore.getState().hoverBody).toBe("Gold: 10");
    fireEvent.mouseLeave(wrapper);
    useGameStore.setState({ gold: big(99) });
    fireEvent.mouseEnter(wrapper);
    expect(useGameStore.getState().hoverBody).toBe("Gold: 99");
  });
});
