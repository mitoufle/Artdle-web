import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { BASE_CHUNK_INTERVAL } from "@/core/balance";

describe("canvasTick (store) — multi-painter integration", () => {
  beforeEach(() => {
    useGameStore.setState({
      canvasProgress: 0, canvasTier: 1, comboChain: 0, critChunks: {},
      painterClocks: {}, lastSale: null,
      sellPriceLevel: 0, speedLevel: 0, critLevel: 0, comboLevel: 0,
      roster: [{ ...createWorker(), stats: { ...createWorker().stats, speed: 1 } }],
    });
  });

  it("accumulates worker strokesThisRun across successive ticks via the store", () => {
    const tick = useGameStore.getState().canvasTick;
    tick(BASE_CHUNK_INTERVAL);
    tick(BASE_CHUNK_INTERVAL);
    tick(BASE_CHUNK_INTERVAL);
    expect(useGameStore.getState().roster[0]!.strokesThisRun).toBeGreaterThanOrEqual(2);
  });

  it("carries the player clock across ticks (idle play keeps painting)", () => {
    const tick = useGameStore.getState().canvasTick;
    tick(BASE_CHUNK_INTERVAL / 2);
    tick(BASE_CHUNK_INTERVAL / 2);
    expect(useGameStore.getState().canvasProgress).toBeGreaterThanOrEqual(1);
  });
});
