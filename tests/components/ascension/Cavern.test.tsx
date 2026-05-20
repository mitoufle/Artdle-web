import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
