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
        totalLevelsInStage={5}
        unlockThreshold={12}
      />,
    );
    const chips = screen.getAllByTestId(/stage-chip-/);
    expect(chips).toHaveLength(2);
    expect(screen.getByTestId("stage-chip-1")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("stage-chip-2")).not.toHaveAttribute("data-active", "true");
  });


  it("renders the progress label '{N} / {threshold} levels in stage'", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        totalLevelsInStage={5}
        unlockThreshold={12}
      />,
    );
    expect(screen.getByText(/5 \/ 12 levels in stage/i)).toBeInTheDocument();
  });

  it("does NOT render a Grow button (advancement is automatic)", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        totalLevelsInStage={12}
        unlockThreshold={12}
      />,
    );
    expect(screen.queryByRole("button", { name: /Grow/i })).not.toBeInTheDocument();
  });

});
