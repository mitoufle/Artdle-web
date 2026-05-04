import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Cavern } from "@/components/ascension/Cavern";

describe("<Cavern />", () => {
  it("renders the cavern container", () => {
    const { container } = render(<Cavern />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders 5 crystals", () => {
    const { container } = render(<Cavern />);
    const crystals = container.querySelectorAll('[data-testid^="crystal-"]');
    expect(crystals).toHaveLength(5);
  });

  it("each crystal has data-testid='crystal-{N}'", () => {
    render(<Cavern />);
    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`crystal-${i}`)).toBeInTheDocument();
    }
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
