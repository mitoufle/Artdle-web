import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CanvasUpgradesStrip } from "@/components/painting/CanvasUpgradesStrip";

describe("<CanvasUpgradesStrip />", () => {
  it("renders the strip container with role 'group'", () => {
    render(
      <CanvasUpgradesStrip>
        <div data-testid="child">child</div>
      </CanvasUpgradesStrip>,
    );
    expect(screen.getByRole("group", { name: /canvas upgrades/i })).toBeInTheDocument();
  });

  it("renders children inside the strip", () => {
    render(
      <CanvasUpgradesStrip>
        <div data-testid="tier-tile">Tile</div>
      </CanvasUpgradesStrip>,
    );
    expect(screen.getByTestId("tier-tile")).toBeInTheDocument();
  });

  it("uses a 5-column grid layout (CSS), confirmed via class on container", () => {
    const { container } = render(<CanvasUpgradesStrip />);
    const strip = container.firstChild as HTMLElement;
    expect(strip).toHaveAttribute("data-cells", "5");
  });
});
