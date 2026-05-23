import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurrencyChip } from "@/components/shell/CurrencyChip";

describe("<CurrencyChip />", () => {
  it("renders label and value", () => {
    render(<CurrencyChip kind="gold" label="Gold" value="1.23K" />);
    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(screen.getByText("1.23K")).toBeInTheDocument();
  });

  it("renders per-second rate when provided", () => {
    render(<CurrencyChip kind="inspi" label="Inspi" value="847" rate="+3.2/s" />);
    expect(screen.getByText("+3.2/s")).toBeInTheDocument();
  });

  it("does not render rate when omitted (e.g., fame)", () => {
    render(<CurrencyChip kind="fame" label="Fame" value="12" />);
    expect(screen.queryByText(/\/s$/)).not.toBeInTheDocument();
  });

  it("applies dimmed attribute when dimmed=true", () => {
    render(<CurrencyChip kind="gold" label="Gold" value="0" dimmed />);
    expect(screen.getByTestId("currency-chip-gold")).toHaveAttribute("data-dimmed", "true");
  });

  it("does NOT apply dimmed attribute when dimmed=false", () => {
    render(<CurrencyChip kind="gold" label="Gold" value="0" />);
    expect(screen.getByTestId("currency-chip-gold")).not.toHaveAttribute("data-dimmed", "true");
  });

  it("supports the three currencies (gold, inspi, fame) without crashing", () => {
    const kinds = ["gold", "inspi", "fame"] as const;
    for (const kind of kinds) {
      const { unmount } = render(<CurrencyChip kind={kind} label="X" value="0" />);
      expect(screen.getByTestId(`currency-chip-${kind}`)).toBeInTheDocument();
      unmount();
    }
  });
});
