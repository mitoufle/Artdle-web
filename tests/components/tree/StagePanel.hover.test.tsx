import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StagePanel } from "@/components/tree/StagePanel";
import { useGameStore } from "@/store";

describe("StagePanel hover wiring", () => {
  beforeEach(() => {
    useGameStore.setState({
      hoverTitle: "", hoverBody: "", hoverFooter: "",
    });
  });

  it("hover (non-final, mid-progress) shows 'Tiny Sprout → Bud' title and need-more body", () => {
    render(
      <StagePanel
        currentStageIndex={0} currentStageName="Tiny Sprout" nextStageName="Bud"
        totalLevelsInStage={2} unlockThreshold={5}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("stage-panel"));
    expect(useGameStore.getState().hoverTitle).toBe("Tiny Sprout → Bud");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Levels in stage: 2 \/ 5/);
    expect(container.textContent).toMatch(/Progress: 40%/);
    expect(container.textContent).toMatch(/Need 3 more levels/);
    expect(String(useGameStore.getState().hoverFooter)).toMatch(/automatically/i);
  });

  it("hover (non-final, threshold reached) shows 'Threshold reached — advancing!'", () => {
    render(
      <StagePanel
        currentStageIndex={0} currentStageName="Tiny Sprout" nextStageName="Bud"
        totalLevelsInStage={5} unlockThreshold={5}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("stage-panel"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Threshold reached/);
  });

  it("hover (final stage) shows '· Final stage' title and final-state body, empty footer", () => {
    render(
      <StagePanel
        currentStageIndex={5} currentStageName="Verdant Shoot" nextStageName={undefined}
        totalLevelsInStage={150} unlockThreshold={0}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("stage-panel"));
    expect(useGameStore.getState().hoverTitle).toBe("Verdant Shoot · Final stage");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/final stage/i);
    expect(String(useGameStore.getState().hoverFooter)).toBe("");
  });
});
