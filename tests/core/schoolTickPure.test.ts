import { describe, expect, it } from "vitest";
import { schoolTickPure } from "@/core/schoolTickPure";
import { useGameStore } from "@/store";

describe("schoolTickPure", () => {
  it("no-op when no active research", () => {
    const draft = { ...useGameStore.getState(), activeResearch: null } as any;
    schoolTickPure(draft, 60);
    expect(draft.activeResearch).toBe(null);
  });

  it("decrements remainingSeconds", () => {
    const draft = {
      ...useGameStore.getState(),
      activeResearch: { id: "r1", remainingSeconds: 120 },
    } as any;
    schoolTickPure(draft, 30);
    expect(draft.activeResearch.remainingSeconds).toBe(90);
  });

  it("completes research and bumps stats when remaining hits 0", () => {
    const base = useGameStore.getState();
    const draft = {
      ...base,
      activeResearch: { id: "r1", remainingSeconds: 5 },
      completedResearches: {},
      statsLifetime: { ...base.statsLifetime, schoolResearchesCompleted: 0 },
      statsRun: { ...base.statsRun, schoolResearchesCompleted: 0 },
    } as any;
    schoolTickPure(draft, 5);
    expect(draft.activeResearch).toBe(null);
    expect(draft.completedResearches.r1).toBe(true);
    expect(draft.statsLifetime.schoolResearchesCompleted).toBe(1);
    expect(draft.statsRun.schoolResearchesCompleted).toBe(1);
  });
});
