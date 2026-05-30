import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { WorkerAvatars } from "@/components/painting/WorkerAvatars";

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
});
