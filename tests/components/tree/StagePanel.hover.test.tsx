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

  it("hover (non-final, mid-progress) shows 'Seed → Sapling' title and need-more body", () => {
    render(
      <StagePanel
        currentStageIndex={0} currentStageName="Seed" nextStageName="Sapling"
        totalLevelsInStage={3} unlockThreshold={10}
        canGrow={false} onGrow={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("stage-panel"));
    expect(useGameStore.getState().hoverTitle).toBe("Seed → Sapling");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Levels in stage: 3 \/ 10/);
    expect(container.textContent).toMatch(/Progress: 30%/);
    expect(container.textContent).toMatch(/Need 7 more levels/);
    expect(String(useGameStore.getState().hoverFooter)).toMatch(/Grow.*next stage/);
  });

  it("hover (non-final, threshold reached) shows 'Ready to grow!'", () => {
    render(
      <StagePanel
        currentStageIndex={0} currentStageName="Seed" nextStageName="Sapling"
        totalLevelsInStage={10} unlockThreshold={10}
        canGrow={true} onGrow={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("stage-panel"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Ready to grow!/);
  });

  it("hover (final stage) shows '· Final stage' title and final-state body, empty footer", () => {
    render(
      <StagePanel
        currentStageIndex={2} currentStageName="Tree" nextStageName={undefined}
        totalLevelsInStage={20} unlockThreshold={0}
        canGrow={false} onGrow={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("stage-panel"));
    expect(useGameStore.getState().hoverTitle).toBe("Tree · Final stage");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/final stage/i);
    expect(String(useGameStore.getState().hoverFooter)).toBe("");
  });
});
