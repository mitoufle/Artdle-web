import { describe, it, expect, beforeEach } from "vitest";
import { Profiler, type ProfilerOnRenderCallback } from "react";
import { render, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { PaintingRoute } from "@/routes/PaintingRoute";

/**
 * Regression test for the 2026-05-25 tab-navigation perf fix.
 *
 * `BoundCanvasStage` (in src/components/painting/) was introduced to own the
 * tick-frequency Zustand subscriptions (canvasProgress, comboChain,
 * critChunks, lastSale, canvasesSold) so they live in a small subtree
 * instead of at the top of PaintingRoute. Without this isolation,
 * PaintingRoute's body — the upgrades strip, 5 TrackCards, the active Room
 * component, the RoomRail — re-rendered ~30 times per second following the
 * tick loop's canvasProgress updates, which combined with the navigation
 * starvation problem (see HANDOVER) caused multi-second tab switches.
 *
 * This test asserts the structural property: when only `canvasProgress`
 * changes in the store, PaintingRoute's body renders 0-1 times (never 30+).
 * If someone re-introduces a high-frequency subscription at PaintingRoute's
 * top level — directly or via a new prop passed down — this test fails.
 */
describe("PaintingRoute subscription isolation (BoundCanvasStage regression guard)", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetSkillTree();
    useGameStore.setState({ roster: [] });
    // Give the player enough state to render the full UI (upgrade levels > 0
    // so the TrackCards have real cost previews; canvasProgress at 0 so we
    // start from a clean baseline before the simulated tick updates).
    useGameStore.setState({
      sellPriceLevel: 5,
      speedLevel: 5,
      canvasProgress: 0,
    });
  });

  it("does not re-render PaintingRoute body when only canvasProgress changes", () => {
    let renderCount = 0;
    const onRender: ProfilerOnRenderCallback = (id) => {
      if (id === "PaintingRouteBody") renderCount += 1;
    };

    render(
      <MemoryRouter>
        <Profiler id="PaintingRouteBody" onRender={onRender}>
          <PaintingRoute />
        </Profiler>
      </MemoryRouter>,
    );

    const baseline = renderCount;

    // Simulate the tick loop firing 30 canvasProgress updates back-to-back.
    // Before the BoundCanvasStage refactor this would cause ~30 re-renders
    // of PaintingRoute (one per setState). After the refactor, the
    // subscription lives in BoundCanvasStage's subtree; PaintingRoute's body
    // should NOT see any of these updates.
    act(() => {
      for (let i = 0; i < 30; i++) {
        useGameStore.setState({ canvasProgress: i * 0.1 });
      }
    });

    // Tolerate up to 3 extra Profiler callbacks: React StrictMode in dev/test
    // double-invokes renders for purity checks, so 1 actual commit = 2
    // onRender calls; add 1 more slot for React 19 batching variance. The
    // actual expected number of true PaintingRoute commits is 0. Pre-fix
    // behavior was ~30 actual commits = ~60 Profiler callbacks, so this
    // bound is loose enough for legit React behavior but still catches the
    // regression by an order of magnitude.
    expect(renderCount - baseline).toBeLessThanOrEqual(3);
  });

  it("does not re-render PaintingRoute body when only painterClocks changes", () => {
    // WorkerAvatars self-subscribes to `roster` + `painterClocks` and is
    // mounted as a leaf sibling of BoundCanvasStage inside the stageArea. Its
    // per-tick `painterClocks` updates must stay contained in that subtree —
    // they must NOT leak a subscription into PaintingRoute's body. This mirrors
    // the canvasProgress guard above for the multi-painter clock stream.
    const worker = createWorker();
    useGameStore.setState({ roster: [worker], painterClocks: {} });

    let renderCount = 0;
    const onRender: ProfilerOnRenderCallback = (id) => {
      if (id === "PaintingRouteBody") renderCount += 1;
    };

    render(
      <MemoryRouter>
        <Profiler id="PaintingRouteBody" onRender={onRender}>
          <PaintingRoute />
        </Profiler>
      </MemoryRouter>,
    );

    const baseline = renderCount;

    // Simulate the tick loop firing 30 painterClocks updates back-to-back (the
    // per-worker clocks advancing toward each next stroke). The avatar overlay
    // subscribes to these; PaintingRoute's body must not.
    act(() => {
      for (let i = 0; i < 30; i++) {
        useGameStore.setState({ painterClocks: { [worker.id]: i * 0.1 } });
      }
    });

    // Same tolerance as the canvasProgress case (StrictMode double-invoke +
    // React 19 batching slack). Pre-isolation this would be ~30 commits.
    expect(renderCount - baseline).toBeLessThanOrEqual(3);
  });

  it("still updates the visible progress display when canvasProgress changes", () => {
    const { container } = render(
      <MemoryRouter>
        <PaintingRoute />
      </MemoryRouter>,
    );

    // Sanity check: BoundCanvasStage (the subtree that DOES subscribe to
    // canvasProgress) still receives updates and shows the new value. This
    // guards against over-isolating — e.g. someone accidentally removing
    // BoundCanvasStage's subscription would make this assertion fail.
    //
    // Chunk-domain (2026-05-26 rework): canvasProgress is in chunks. Player-
    // facing word is "strokes". Bar label is DISCRETE floored completed
    // strokes ("5 / 10 strokes"); fill animates per-stroke, not continuously.
    // T1: chunkCount=10.
    expect(container.textContent).toContain("0 / 10 strokes");

    act(() => {
      useGameStore.setState({ canvasProgress: 3.5 });
    });

    // floor(3.5) = 3 completed strokes; fractional progress hidden from label.
    expect(container.textContent).toContain("3 / 10 strokes");
  });
});
