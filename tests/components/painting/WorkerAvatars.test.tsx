import { describe, it, expect, afterEach } from "vitest";
import { render, screen, within, cleanup, act } from "@testing-library/react";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { WorkerAvatars } from "@/components/painting/WorkerAvatars";
import { big } from "@/core/bigNumber";
import { workerXpToNext } from "@/core/balance";

afterEach(cleanup);

describe("WorkerAvatars", () => {
  it("renders nothing when the roster is empty", () => {
    useGameStore.setState({ roster: [], painterClocks: {} });
    const { container } = render(<WorkerAvatars />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one avatar per worker", () => {
    const a = createWorker();
    const b = createWorker();
    useGameStore.setState({ roster: [a, b], painterClocks: {} });
    const { getAllByTestId } = render(<WorkerAvatars />);
    expect(getAllByTestId("worker-avatar")).toHaveLength(2);
  });

  it("the avatar layer is click-through (pointer-events: none)", () => {
    const a = createWorker();
    useGameStore.setState({ roster: [a], painterClocks: {} });
    const { getByTestId } = render(<WorkerAvatars />);
    const layer = getByTestId("worker-avatar-layer");
    expect(layer.style.pointerEvents).toBe("none"); // inline guarantee (jsdom can't resolve CSS-module rules)
  });

  it("paints each worker's own avatar as the portrait background", () => {
    const a = { ...createWorker(), avatar: 2 };
    const b = { ...createWorker(), avatar: 4 };
    useGameStore.setState({ roster: [a, b], painterClocks: {} });
    render(<WorkerAvatars />);
    const portraits = screen.getAllByTestId("worker-portrait");
    expect(portraits).toHaveLength(2);
    expect(portraits[0]!.style.backgroundImage).toMatch(/worker_2/);
    expect(portraits[1]!.style.backgroundImage).toMatch(/worker_4/);
  });

  it("splits avatars 2 & 3 to the left column and 1 & 4 to the right", () => {
    const w1 = { ...createWorker(), avatar: 1 };
    const w2 = { ...createWorker(), avatar: 2 };
    const w3 = { ...createWorker(), avatar: 3 };
    const w4 = { ...createWorker(), avatar: 4 };
    useGameStore.setState({ roster: [w1, w2, w3, w4], painterClocks: {} });
    render(<WorkerAvatars />);
    const left = within(screen.getByTestId("worker-column-left")).getAllByTestId("worker-portrait");
    const right = within(screen.getByTestId("worker-column-right")).getAllByTestId("worker-portrait");
    expect(left.map((p) => p.style.backgroundImage).join()).toMatch(/worker_2/);
    expect(left.map((p) => p.style.backgroundImage).join()).toMatch(/worker_3/);
    expect(right.map((p) => p.style.backgroundImage).join()).toMatch(/worker_1/);
    expect(right.map((p) => p.style.backgroundImage).join()).toMatch(/worker_4/);
  });

  it("drives the XP bar from xp / workerXpToNext(level)", () => {
    const lvl = 1;
    const half = workerXpToNext(lvl).div(2); // 500 at level 1 (cost 1000)
    const w = { ...createWorker(), avatar: 1, level: lvl, xp: half };
    useGameStore.setState({ roster: [w], painterClocks: {} });
    render(<WorkerAvatars />);
    expect(screen.getByTestId("worker-xp-fill").style.width).toBe("50%");
  });

  it("increments the stroke-proc counter when a worker's clock drops", async () => {
    const w = { ...createWorker(), avatar: 1 };
    useGameStore.setState({ roster: [w], painterClocks: { [w.id]: 4 } });
    render(<WorkerAvatars />);
    expect(screen.getByTestId("worker-ringwrap").getAttribute("data-proc")).toBe("0");
    // clock drops (worker just strokes) → proc fires once
    await act(async () => { useGameStore.setState({ painterClocks: { [w.id]: 0.1 } }); });
    expect(screen.getByTestId("worker-ringwrap").getAttribute("data-proc")).toBe("1");
    // clock keeps climbing → no new proc
    await act(async () => { useGameStore.setState({ painterClocks: { [w.id]: 0.2 } }); });
    expect(screen.getByTestId("worker-ringwrap").getAttribute("data-proc")).toBe("1");
  });
});
