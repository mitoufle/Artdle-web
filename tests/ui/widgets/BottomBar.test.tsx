import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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

  it("renders all four currency labels (v1.1)", () => {
    render(<BottomBar />);
    expect(screen.getByText("Gold:")).toBeInTheDocument();
    expect(screen.getByText("Inspi:")).toBeInTheDocument();
    expect(screen.getByText("Fame:")).toBeInTheDocument();
    expect(screen.getByText("PM:")).toBeInTheDocument();
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

  it("renders paintMastery (8000) as '8.00K'", () => {
    useGameStore.setState({
      gold: big(0),
      inspiration: big(0),
      fame: big(0),
    });
    useGameStore.getState()._setPaintMastery(big(8_000));
    render(<BottomBar />);
    expect(screen.getByTestId("currency-paintMastery")).toHaveTextContent("8.00K");
  });
});

describe("<BottomBar /> — fame pulse on increment", () => {
  it("toggles data-pulsing on the fame value when fame increases", async () => {
    useGameStore.setState({ gold: big(0), inspiration: big(0), fame: big(10) });
    render(<BottomBar />);
    const fameValue = screen.getByTestId("currency-fame");
    expect(fameValue).not.toHaveAttribute("data-pulsing", "true");

    // Trigger the increase via the React effect path.
    act(() => {
      useGameStore.setState({ fame: big(15) });
    });

    // After the store update, the useEffect should have toggled data-pulsing=true
    // synchronously (set inside the effect body).
    expect(fameValue).toHaveAttribute("data-pulsing", "true");
  });

  it("does NOT pulse on initial render (no prior value to compare)", () => {
    useGameStore.setState({ gold: big(0), inspiration: big(0), fame: big(10) });
    render(<BottomBar />);
    const fameValue = screen.getByTestId("currency-fame");
    expect(fameValue).not.toHaveAttribute("data-pulsing", "true");
  });

  it("does NOT pulse when fame stays the same", () => {
    useGameStore.setState({ gold: big(0), inspiration: big(0), fame: big(10) });
    render(<BottomBar />);
    const fameValue = screen.getByTestId("currency-fame");

    act(() => {
      useGameStore.setState({ fame: big(10) }); // same value
    });

    expect(fameValue).not.toHaveAttribute("data-pulsing", "true");
  });

  it("toggles data-pulsing on PM when paintMastery increases", async () => {
    useGameStore.setState({ gold: big(0), inspiration: big(0), fame: big(0) });
    useGameStore.getState()._setPaintMastery(big(10));
    render(<BottomBar />);
    const pmValue = screen.getByTestId("currency-paintMastery");
    expect(pmValue).not.toHaveAttribute("data-pulsing", "true");

    act(() => {
      useGameStore.getState()._setPaintMastery(big(15));
    });

    expect(pmValue).toHaveAttribute("data-pulsing", "true");
  });
});
