import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StagePanel } from "@/components/tree/StagePanel";

describe("<StagePanel />", () => {
  it("renders 2 chips (current + next) with the current one marked active", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        inspiPerSec={5}
        unlockInspiPerSec={12}
      />,
    );
    const chips = screen.getAllByTestId(/stage-chip-/);
    expect(chips).toHaveLength(2);
    expect(screen.getByTestId("stage-chip-1")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("stage-chip-2")).not.toHaveAttribute("data-active", "true");
  });


  it("renders the progress label '{N} / {threshold} inspi/sec' with big-number formatting", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        inspiPerSec={5}
        unlockInspiPerSec={12}
      />,
    );
    expect(screen.getByText(/5 \/ 12 inspi\/sec/i)).toBeInTheDocument();
  });

  it("formats large thresholds with K/M/B suffixes", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        inspiPerSec={1500}
        unlockInspiPerSec={2_500_000}
      />,
    );
    expect(screen.getByText(/1\.50K \/ 2\.50M inspi\/sec/i)).toBeInTheDocument();
  });

  it("does NOT render a Grow button (advancement is automatic)", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        inspiPerSec={12}
        unlockInspiPerSec={12}
      />,
    );
    expect(screen.queryByRole("button", { name: /Grow/i })).not.toBeInTheDocument();
  });

});
