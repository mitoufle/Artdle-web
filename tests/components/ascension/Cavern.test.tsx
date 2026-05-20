import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Cavern } from "@/components/ascension/Cavern";

describe("<Cavern />", () => {
  it("renders the cavern container", () => {
    const { container } = render(<Cavern />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders the looping muted backdrop video", () => {
    const { container } = render(<Cavern />);
    const video = container.querySelector<HTMLVideoElement>('[data-testid="cavern-video"]');
    expect(video).not.toBeNull();
    expect(video?.loop).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.autoplay).toBe(true);
    expect(video?.getAttribute("src") ?? "").toMatch(/gate_animated/);
  });

  it("renders children inside the cavern", () => {
    render(
      <Cavern>
        <div data-testid="cavern-child">child</div>
      </Cavern>,
    );
    expect(screen.getByTestId("cavern-child")).toBeInTheDocument();
  });

  it("switches to the gate-opening video when phase is 'opening' and does not loop", () => {
    const { container } = render(<Cavern phase="opening" />);
    const video = container.querySelector<HTMLVideoElement>('[data-testid="cavern-video"]');
    expect(video).not.toBeNull();
    expect(video?.loop).toBe(false);
    expect(video?.getAttribute("src") ?? "").toMatch(/gate_opening_animated/);
    expect(video?.getAttribute("data-phase")).toBe("opening");
  });

  it("fires onOpeningEnded when the opening video reaches its end", () => {
    const onEnded = vi.fn();
    const { container } = render(<Cavern phase="opening" onOpeningEnded={onEnded} />);
    const video = container.querySelector<HTMLVideoElement>('[data-testid="cavern-video"]');
    fireEvent.ended(video!);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("does not call onOpeningEnded when the loop video ends (idle phase)", () => {
    const onEnded = vi.fn();
    const { container } = render(<Cavern phase="idle" onOpeningEnded={onEnded} />);
    const video = container.querySelector<HTMLVideoElement>('[data-testid="cavern-video"]');
    fireEvent.ended(video!);
    expect(onEnded).not.toHaveBeenCalled();
  });
});
