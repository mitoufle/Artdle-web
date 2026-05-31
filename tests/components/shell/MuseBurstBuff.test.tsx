import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MuseBurstBuff } from "@/components/shell/MuseBurstBuff";
import { useGameStore } from "@/store";

describe("<MuseBurstBuff />", () => {
  beforeEach(() => {
    useGameStore.setState({ museBurstTimer: 0 });
  });

  it("renders nothing when the buff is inactive (timer 0)", () => {
    render(<MuseBurstBuff />);
    expect(screen.queryByTestId("muse-burst-buff")).toBeNull();
  });

  it("shows the ×7 multiplier, label, and rounded-up countdown while active", () => {
    useGameStore.setState({ museBurstTimer: 30 });
    render(<MuseBurstBuff />);
    const pill = screen.getByTestId("muse-burst-buff");
    expect(pill).toHaveTextContent("×7");
    expect(pill).toHaveTextContent(/muse burst/i);
    expect(pill).toHaveTextContent("30s");
  });

  it("rounds the remaining time up (0.4s -> 1s)", () => {
    useGameStore.setState({ museBurstTimer: 0.4 });
    render(<MuseBurstBuff />);
    expect(screen.getByTestId("muse-burst-buff")).toHaveTextContent("1s");
  });
});
