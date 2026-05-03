import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BottomBar } from "@/components/shell/BottomBar";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomBar />
    </MemoryRouter>,
  );
}

describe("<BottomBar /> — currency rendering", () => {
  beforeEach(() => {
    useGameStore.setState({
      gold: big(1234),
      inspiration: big(56),
      fame: big(7),
    });
    useGameStore.getState()._setPaintMastery(big(42));
  });

  it("renders all 4 currency chips", () => {
    renderAt("/tree");
    expect(screen.getByTestId("currency-chip-gold")).toBeInTheDocument();
    expect(screen.getByTestId("currency-chip-inspi")).toBeInTheDocument();
    expect(screen.getByTestId("currency-chip-fame")).toBeInTheDocument();
    expect(screen.getByTestId("currency-chip-pm")).toBeInTheDocument();
  });

  it("formats gold via formatBig (1234 -> '1.23K')", () => {
    renderAt("/tree");
    expect(screen.getByTestId("currency-chip-gold")).toHaveTextContent("1.23K");
  });
});

describe("<BottomBar /> — dim-when-irrelevant per route", () => {
  beforeEach(() => {
    useGameStore.setState({ gold: big(0), inspiration: big(0), fame: big(0) });
    useGameStore.getState()._setPaintMastery(big(0));
  });

  it("on /tree: gold + inspi prominent; fame + pm dim", () => {
    renderAt("/tree");
    expect(screen.getByTestId("currency-chip-gold")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-inspi")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-fame")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-pm")).toHaveAttribute("data-dimmed", "true");
  });

  it("on /painting: gold + pm prominent; inspi + fame dim", () => {
    renderAt("/painting");
    expect(screen.getByTestId("currency-chip-gold")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-pm")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-inspi")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-fame")).toHaveAttribute("data-dimmed", "true");
  });

  it("on /ascension: inspi + fame prominent; gold + pm dim", () => {
    renderAt("/ascension");
    expect(screen.getByTestId("currency-chip-inspi")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-fame")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-gold")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-pm")).toHaveAttribute("data-dimmed", "true");
  });

  it("on /constellation: fame prominent; others dim", () => {
    renderAt("/constellation");
    expect(screen.getByTestId("currency-chip-fame")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-gold")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-inspi")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-pm")).toHaveAttribute("data-dimmed", "true");
  });
});
