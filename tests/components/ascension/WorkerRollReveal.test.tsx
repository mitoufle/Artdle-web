import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, cleanup, act } from "@testing-library/react";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { createBaseStats } from "@/core/workerModel";
import { WorkerRollReveal } from "@/components/ascension/WorkerRollReveal";

afterEach(cleanup);

describe("WorkerRollReveal", () => {
  it("renders nothing and completes when the roll is empty", () => {
    const onComplete = vi.fn();
    useGameStore.setState({ lastAscendRoll: null, roster: [] });
    const { container } = render(<WorkerRollReveal skip={false} onComplete={onComplete} />);
    expect(container.firstChild).toBeNull();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("shows a card with the roster name/avatar, level transition, and revealed stats (skip)", () => {
    const w = { ...createWorker(), name: "Frida", avatar: 3 };
    const before = { ...createBaseStats(), goldPct: 0.05 };
    const after = { ...before, goldPct: 0.08, strokesPerCrit: before.strokesPerCrit + 1 };
    useGameStore.setState({
      roster: [w],
      lastAscendRoll: [{ id: w.id, levelBefore: 4, levelAfter: 6, statsBefore: before, statsAfter: after }],
    });
    const onComplete = vi.fn();
    render(<WorkerRollReveal skip onComplete={onComplete} />);

    const card = screen.getByTestId("worker-roll-card");
    expect(within(card).getByText("Frida")).toBeInTheDocument();
    expect(within(card).getByText(/4.*6/)).toBeInTheDocument();
    expect(within(card).getByTestId("worker-portrait-roll").getAttribute("src")).toMatch(/worker_3/);

    const goldVal = screen.getByTestId("worker-roll-value-goldPct");
    expect(goldVal.textContent).toBe("+8%");
    expect(goldVal.getAttribute("data-up")).toBe("true");
    expect(within(screen.getByTestId("worker-roll-stat-goldPct")).getByText("+3%")).toBeInTheDocument();

    const comboVal = screen.getByTestId("worker-roll-value-comboChance");
    expect(comboVal.getAttribute("data-up")).toBe("false");

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("advances one stat per 400ms and completes after the last", () => {
    vi.useFakeTimers();
    const w = { ...createWorker(), name: "Vincent", avatar: 1 };
    const before = createBaseStats();
    const after = { ...before, goldPct: 0.03 };
    useGameStore.setState({
      roster: [w],
      lastAscendRoll: [{ id: w.id, levelBefore: 1, levelAfter: 2, statsBefore: before, statsAfter: after }],
    });
    const onComplete = vi.fn();
    render(<WorkerRollReveal skip={false} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(5 * 400 + 10); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
