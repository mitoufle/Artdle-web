import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { createBaseStats } from "@/core/workerModel";
import { WorkerRollReveal } from "@/components/ascension/WorkerRollReveal";

afterEach(cleanup);

describe("WorkerRollReveal", () => {
  it("renders NOTHING (no DOM) when lastAscendRoll is null — office-less ascend", () => {
    useGameStore.setState({ lastAscendRoll: null });
    const { container } = render(<WorkerRollReveal />);
    expect(container.firstChild).toBeNull(); // zero DOM, no wrapper, no layout shift
  });

  it("renders NOTHING when the roll is an empty array", () => {
    useGameStore.setState({ lastAscendRoll: [] });
    const { container } = render(<WorkerRollReveal />);
    expect(container.firstChild).toBeNull();
  });

  it("shows a worker's level transition and the stat increments it rolled", () => {
    const before = createBaseStats(); // goldPct 0, speed 1, crit 0.01, spc 1, combo 0
    const after = { ...before, goldPct: 0.03, strokesPerCrit: 2 }; // +3% gold, +1 stroke/crit
    useGameStore.setState({
      lastAscendRoll: [{ id: createWorker().id, levelBefore: 4, levelAfter: 6, statsBefore: before, statsAfter: after }],
    });
    render(<WorkerRollReveal />);
    expect(screen.getByText(/4.*6/)).toBeInTheDocument();       // level transition
    expect(screen.getByText(/\+3% gold/)).toBeInTheDocument();
    expect(screen.getByText(/\+1 stroke\/crit/)).toBeInTheDocument();
    expect(screen.queryByText(/\+0% speed/)).not.toBeInTheDocument(); // unchanged stats omitted
  });
});
