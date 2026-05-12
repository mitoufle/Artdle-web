import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StagePanel } from "@/components/tree/StagePanel";

describe("<StagePanel />", () => {
  it("renders all 6 stage chips with the current one marked active", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        totalLevelsInStage={5}
        unlockThreshold={12}
        canGrow={false}
        onGrow={() => {}}
      />,
    );
    const chips = screen.getAllByTestId(/stage-chip-/);
    expect(chips).toHaveLength(6);
    expect(screen.getByTestId("stage-chip-1")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("stage-chip-0")).not.toHaveAttribute("data-active", "true");
  });

  it("renders the title 'Stage A → Stage B' with current and next", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        totalLevelsInStage={5}
        unlockThreshold={12}
        canGrow={false}
        onGrow={() => {}}
      />,
    );
    expect(screen.getByText(/Bud.*Leaflet/i)).toBeInTheDocument();
  });

  it("renders the progress label '{N} / {threshold} levels in stage'", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        totalLevelsInStage={5}
        unlockThreshold={12}
        canGrow={false}
        onGrow={() => {}}
      />,
    );
    expect(screen.getByText(/5 \/ 12 levels in stage/i)).toBeInTheDocument();
  });

  it("grow button is disabled when canGrow=false", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        totalLevelsInStage={5}
        unlockThreshold={12}
        canGrow={false}
        onGrow={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Grow/i })).toBeDisabled();
  });

  it("grow button calls onGrow when canGrow=true and clicked", () => {
    const onGrow = vi.fn();
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        totalLevelsInStage={12}
        unlockThreshold={12}
        canGrow={true}
        onGrow={onGrow}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Grow/i }));
    expect(onGrow).toHaveBeenCalledOnce();
  });

  it("renders 'Grow into {next stage}' label", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        totalLevelsInStage={12}
        unlockThreshold={12}
        canGrow={true}
        onGrow={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Grow into Leaflet/i })).toBeInTheDocument();
  });

  it("renders 'Final stage' when nextStageName is undefined", () => {
    render(
      <StagePanel
        currentStageIndex={5}
        currentStageName="Verdant Shoot"
        nextStageName={undefined}
        totalLevelsInStage={50}
        unlockThreshold={0}
        canGrow={false}
        onGrow={() => {}}
      />,
    );
    expect(screen.getByText(/Final stage/i)).toBeInTheDocument();
  });
});
