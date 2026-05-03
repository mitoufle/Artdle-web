import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloatingGoldText } from "@/ui/widgets/FloatingGoldText";
import { big } from "@/core/bigNumber";

describe("<FloatingGoldText />", () => {
  it("renders the formatted amount with a leading '+' and trailing 'g'", () => {
    render(<FloatingGoldText amount={big(15)} onComplete={vi.fn()} />);
    expect(screen.getByTestId("floating-gold-text")).toHaveTextContent("+15g");
  });

  it("formats large amounts via formatBig (1500 -> '+1.50Kg')", () => {
    render(<FloatingGoldText amount={big(1500)} onComplete={vi.fn()} />);
    expect(screen.getByTestId("floating-gold-text")).toHaveTextContent("+1.50Kg");
  });

  it("renders inside a positioned container without throwing", () => {
    expect(() =>
      render(<FloatingGoldText amount={big(1)} onComplete={vi.fn()} />),
    ).not.toThrow();
    expect(screen.getByTestId("floating-gold-text")).toBeInTheDocument();
  });
});
