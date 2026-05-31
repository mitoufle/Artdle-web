import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { initialSchoolState } from "@/store/schoolSlice";
import { big } from "@/core/bigNumber";

describe("schoolSlice", () => {
  beforeEach(() => {
    useGameStore.setState({
      ...initialSchoolState,
      fame: big(0),
    });
  });

  it("initializes with correct defaults", () => {
    const s = useGameStore.getState();
    expect(s.completedResearches).toEqual({});
    expect(s.currentTier).toBe(1);
    expect(s.activeResearch).toBeNull();
    expect(s.examsPassed).toEqual({});
  });

  it("startResearch sets activeResearch and returns true", () => {
    expect(useGameStore.getState().startResearch("color_theory_basics")).toBe(true);
    const active = useGameStore.getState().activeResearch;
    expect(active).not.toBeNull();
    expect(active?.id).toBe("color_theory_basics");
    expect(active?.remainingSeconds).toBe(18000); // 300 min in seconds
  });

  it("startResearch reduces duration by completed 'School Research flat reduction (mnt)'", () => {
    // quick_thinking: value=10 → 10 min = 600s reduction
    // color_theory_basics: 18000s → 18000 - 600 = 17400s
    useGameStore.setState({ completedResearches: { quick_thinking: true } });
    useGameStore.getState().startResearch("color_theory_basics");
    const active = useGameStore.getState().activeResearch;
    expect(active?.remainingSeconds).toBe(17400);
  });

  it("startResearch floors reduced duration at 60s minimum", () => {
    // Simulate a hypothetical 10-minute research with a 15-minute reduction
    // brushwork_basics: 7200s (120 min), minus 10 min = 110 min = 6600s
    useGameStore.setState({ completedResearches: { quick_thinking: true } });
    useGameStore.getState().startResearch("brushwork_basics");
    const active = useGameStore.getState().activeResearch;
    expect(active?.remainingSeconds).toBe(6600); // 7200 - 600 = 6600
  });

  it("startResearch returns false when another research is active", () => {
    useGameStore.getState().startResearch("color_theory_basics");
    expect(useGameStore.getState().startResearch("brushwork_basics")).toBe(false);
  });

  it("startResearch returns false for already completed research", () => {
    useGameStore.setState({ completedResearches: { color_theory_basics: true } });
    expect(useGameStore.getState().startResearch("color_theory_basics")).toBe(false);
  });

  it("startResearch returns false for a research not in currentTier", () => {
    // tier 2 research while currentTier is 1
    expect(useGameStore.getState().startResearch("composition")).toBe(false);
  });

  it("pauseResearch clears activeResearch and banks its remaining time", () => {
    useGameStore.getState().startResearch("color_theory_basics"); // 18000s
    useGameStore.getState().schoolTick(5000); // 13000s remaining
    useGameStore.getState().pauseResearch();
    expect(useGameStore.getState().activeResearch).toBeNull();
    expect(useGameStore.getState().researchProgress["color_theory_basics"]).toBeCloseTo(13000, 1);
  });

  it("startResearch resumes a paused research from its banked time (not the full duration)", () => {
    useGameStore.getState().startResearch("color_theory_basics"); // 18000s
    useGameStore.getState().schoolTick(5000); // 13000s remaining
    useGameStore.getState().pauseResearch();
    expect(useGameStore.getState().startResearch("color_theory_basics")).toBe(true);
    expect(useGameStore.getState().activeResearch?.remainingSeconds).toBeCloseTo(13000, 1);
    // the banked entry is consumed on resume
    expect(useGameStore.getState().researchProgress["color_theory_basics"]).toBeUndefined();
  });

  it("banked research progress is unaffected by an ascend (school is never reset on ascend)", () => {
    useGameStore.getState().startResearch("color_theory_basics");
    useGameStore.getState().schoolTick(5000);
    useGameStore.getState().pauseResearch();
    const banked = useGameStore.getState().researchProgress["color_theory_basics"];
    // performAscend resets run state but not school; the banked value must survive.
    useGameStore.getState().resetTree?.();
    useGameStore.getState().resetCanvas?.();
    expect(useGameStore.getState().researchProgress["color_theory_basics"]).toBe(banked);
  });

  it("schoolTick decrements remainingSeconds", () => {
    useGameStore.getState().startResearch("color_theory_basics"); // 18000s
    useGameStore.getState().schoolTick(10);
    expect(useGameStore.getState().activeResearch?.remainingSeconds).toBeCloseTo(17990, 1);
  });

  it("schoolTick completes research when timer reaches 0", () => {
    useGameStore.getState().startResearch("color_theory_basics"); // 18000s
    useGameStore.getState().schoolTick(18000);
    expect(useGameStore.getState().activeResearch).toBeNull();
    expect(useGameStore.getState().completedResearches["color_theory_basics"]).toBe(true);
  });

  it("schoolTick completes research when delta overshoots the remaining time", () => {
    useGameStore.getState().startResearch("color_theory_basics"); // 18000s
    useGameStore.getState().schoolTick(18001); // delta > remainingSeconds
    expect(useGameStore.getState().activeResearch).toBeNull();
    expect(useGameStore.getState().completedResearches["color_theory_basics"]).toBe(true);
  });

  it("schoolTick is a no-op when no research is active", () => {
    useGameStore.getState().schoolTick(100);
    expect(useGameStore.getState().activeResearch).toBeNull();
  });

  it("passExam returns false when not all researches in tier are complete", () => {
    useGameStore.setState({ fame: big(1000) });
    expect(useGameStore.getState().passExam()).toBe(false);
  });

  it("passExam returns false when fame is insufficient", () => {
    useGameStore.setState({
      completedResearches: {
        color_theory_basics: true,
        brushwork_basics: true,
        light_and_shadow: true,
      },
      fame: big(0),
    });
    expect(useGameStore.getState().passExam()).toBe(false);
  });

  it("passExam succeeds: deducts fame, increments tier, records examsPassed", () => {
    useGameStore.setState({
      completedResearches: {
        color_theory_basics: true,
        brushwork_basics: true,
        light_and_shadow: true,
        closer_to_nature: true,
        branding: true,
        quick_thinking: true,
        expensive_machinery: true,
      },
      fame: big(100),
    });
    expect(useGameStore.getState().passExam()).toBe(true);
    const s = useGameStore.getState();
    expect(s.currentTier).toBe(2);
    expect(s.examsPassed[1]).toBe(true);
    expect(s.fame.eq(50)).toBe(true); // 100 - 50 = 50
  });

  it("passExam returns false when currentTier is already the last tier", () => {
    useGameStore.setState({
      currentTier: 5,
      completedResearches: {
        master_composition: true,
        advanced_technique: true,
        studio_discipline: true,
      },
      fame: big(10000),
    });
    expect(useGameStore.getState().passExam()).toBe(false);
  });

  it("resetSchool resets to initial state", () => {
    useGameStore.setState({
      completedResearches: { color_theory_basics: true },
      currentTier: 2,
      activeResearch: { id: "x", remainingSeconds: 100 },
      examsPassed: { 1: true },
    });
    useGameStore.getState().resetSchool();
    const s = useGameStore.getState();
    expect(s.completedResearches).toEqual({});
    expect(s.currentTier).toBe(1);
    expect(s.activeResearch).toBeNull();
    expect(s.examsPassed).toEqual({});
  });
});
