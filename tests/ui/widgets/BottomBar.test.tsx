import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomBar } from "@/ui/widgets/BottomBar";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("<BottomBar />", () => {
  beforeEach(() => {
    useGameStore.setState({
      gold: big(1234),
      inspiration: big(56),
      fame: big(7),
    });
  });

  it("renders all three currency labels", () => {
    render(<BottomBar />);
    expect(screen.getByText("Gold:")).toBeInTheDocument();
    expect(screen.getByText("Inspi:")).toBeInTheDocument();
    expect(screen.getByText("Fame:")).toBeInTheDocument();
  });

  it("formats gold via formatBig (1234 -> '1.23K')", () => {
    render(<BottomBar />);
    expect(screen.getByTestId("currency-gold")).toHaveTextContent("1.23K");
  });

  it("renders inspiration as integer (56)", () => {
    render(<BottomBar />);
    expect(screen.getByTestId("currency-inspiration")).toHaveTextContent("56");
  });

  it("renders fame as integer (7)", () => {
    render(<BottomBar />);
    expect(screen.getByTestId("currency-fame")).toHaveTextContent("7");
  });
});
