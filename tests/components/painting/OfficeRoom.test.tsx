import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { OfficeRoom } from "@/components/painting/OfficeRoom";
import { big } from "@/core/bigNumber";

afterEach(cleanup);

describe("OfficeRoom", () => {
  it("shows the empty state when there are no workers", () => {
    useGameStore.setState({ roster: [], purchasedNodes: {} });
    render(<OfficeRoom />);
    expect(screen.getByText(/no painters yet/i)).toBeInTheDocument();
  });

  it("renders a stat card per worker showing level and the five stats", () => {
    const w = { ...createWorker(), level: 7 };
    useGameStore.setState({ roster: [w], purchasedNodes: { hire_manager: 1, entrepreneur: 1 } });
    render(<OfficeRoom />);
    expect(screen.getByText(/Level 7/i)).toBeInTheDocument();
    // five stat labels present — EXACT string match (not regex: "Crit" would also
    // match "Strokes/crit" under a regex and getByText throws on multiple matches).
    for (const label of ["Gold", "Speed", "Crit", "Strokes/crit", "Combo"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // a base worker's gold reads +0%, speed ×1.00
    expect(screen.getByText("+0%")).toBeInTheDocument();
    expect(screen.getByText("×1.00")).toBeInTheDocument();
  });

  it("renders the worker's name, avatar, and an XP readout", () => {
    const w = { ...createWorker(), name: "Vincent", level: 3, xp: big(1500) };
    useGameStore.setState({ roster: [w], purchasedNodes: { hire_manager: 1, entrepreneur: 1 } });
    render(<OfficeRoom />);
    expect(screen.getByText("Vincent")).toBeInTheDocument();
    expect(screen.getByTestId("worker-avatar-img")).toBeInTheDocument();
    expect(screen.getByTestId("worker-xp-readout")).toHaveTextContent("/");
    expect(screen.getByTestId("worker-xp-readout")).toHaveTextContent("10.83K");
  });
});
