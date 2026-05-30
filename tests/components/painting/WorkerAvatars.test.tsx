import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
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
});
