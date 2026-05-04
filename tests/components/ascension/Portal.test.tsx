import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Portal } from "@/components/ascension/Portal";

describe("<Portal />", () => {
  it("renders the portal SVG", () => {
    const { container } = render(<Portal />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the keystone rune", () => {
    const { container } = render(<Portal />);
    expect(container.querySelector('[data-testid="portal-keystone"]')).toBeInTheDocument();
  });

  it("renders 6 flanking runes", () => {
    const { container } = render(<Portal />);
    const runes = container.querySelectorAll('[data-testid="portal-rune"]');
    expect(runes).toHaveLength(6);
  });

  it("renders the inner glow gradient circle", () => {
    const { container } = render(<Portal />);
    expect(container.querySelector('[data-testid="portal-glow"]')).toBeInTheDocument();
  });
});
