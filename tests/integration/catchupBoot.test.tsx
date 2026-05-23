import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the music hook before importing anything that pulls in `<App />`.
// jsdom's HTMLMediaElement.play returns undefined (not a Promise), which
// makes useMusic throw on mount. Other tests that render shell components
// follow this same pattern (see tests/components/shell/TopBar.test.tsx).
vi.mock("@/ui/hooks/useMusic", () => ({
  useMusic: () => ({ volume: 0.2, muted: false, setVolume: vi.fn(), toggleMute: vi.fn() }),
}));

// Spy on the catchup engine so the 3h test can swap in a fast canned
// implementation (running the real engine for 3h in jsdom takes ~100s).
// The spy defaults to passing through to the actual implementation, so the
// 1h test still exercises the real sim.
const runCatchupSimulationMock = vi.hoisted(() => vi.fn());
vi.mock("@/systems/catchup", async () => {
  const actual = await vi.importActual<typeof import("@/systems/catchup")>(
    "@/systems/catchup",
  );
  // Default behaviour: call into the real engine. Tests can override via
  // `runCatchupSimulationMock.mockImplementation(...)`.
  runCatchupSimulationMock.mockImplementation((elapsed, onProgress) =>
    actual.runCatchupSimulation(elapsed, onProgress),
  );
  return {
    ...actual,
    runCatchupSimulation: runCatchupSimulationMock,
  };
});

import { Bootstrap, MIN_LOADING_SCENE_MS } from "@/main";
import { useGameStore } from "@/store";
import { ZERO, big } from "@/core/bigNumber";
import type { CatchupResult } from "@/systems/catchup";

// Seed store with a known lastSeen relative to "now". Other state is reset
// in beforeEach so the catchup engine has a sane (and minimally producing)
// starting point.
function seedStoreWithLastSeen(lastSeenMs: number): void {
  useGameStore.setState({ lastSeen: lastSeenMs });
}

describe("Bootstrap catch-up branching", () => {
  beforeEach(() => {
    // Reset to a known minimal but valid state so tests don't share residue
    // from previous suites (catchup tests above mutate gold/inspi/stats).
    useGameStore.setState({
      currentStage: 0,
      partLevels: { cotyledon: 5 },
      inspiration: ZERO,
      gold: ZERO,
      canvasProgress: 0,
      paintMastery: ZERO,
      completedAchievements: {},
    });
    // Reset call records; the default pass-through implementation set up in
    // the mock factory above is preserved by mockClear.
    runCatchupSimulationMock.mockClear();
  });

  it("with elapsed ≤ 5s: mounts straight into playing (no catchup UI)", async () => {
    seedStoreWithLastSeen(Date.now() - 2000);
    render(<Bootstrap />);
    // Let the post-hydration effect chain settle.
    await act(async () => {
      await Promise.resolve();
    });
    // No catchup-flavoured UI should appear.
    expect(screen.queryByText(/Welcome back/i)).toBeNull();
    expect(screen.queryByText(/Catching up/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /continue/i })).toBeNull();
    // Sim was not invoked.
    expect(runCatchupSimulationMock).not.toHaveBeenCalled();
  });

  it("with elapsed = 1h (real sim): silent sim → toast appears", async () => {
    seedStoreWithLastSeen(Date.now() - 3600_000);
    render(<Bootstrap />);
    // Real engine: 1h with delta=1s = 3600 steps, tractable in jsdom.
    await waitFor(
      () => expect(screen.getByText(/Welcome back/)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(runCatchupSimulationMock).toHaveBeenCalledOnce();
  });

  it("with elapsed = 3h (mocked sim): loading scene → recap modal → continue dismisses scene", async () => {
    // Stub the sim to resolve quickly with a deterministic result.
    const fakeResult: CatchupResult = {
      elapsedSeconds: 3 * 3600,
      goldGained: big(12345),
      inspiGained: big(67890),
      canvasesSold: 7,
      itemsCrafted: 2,
      paintMasteryGained: big(0),
      achievementsUnlocked: [],
    };
    runCatchupSimulationMock.mockImplementation(
      async (_elapsed: number, onProgress: (p: number) => void) => {
        // Emit a progress tick so the loading scene reflects the
        // intermediate state, then resolve.
        onProgress(0.5);
        await Promise.resolve();
        return fakeResult;
      },
    );

    seedStoreWithLastSeen(Date.now() - 3 * 3600_000);
    render(<Bootstrap />);

    // Loading scene appears asynchronously (after the silent_sim phase
    // computes elapsed). Use findByText to wait for it.
    await screen.findByText(/Catching up/);

    // Recap modal Continue button appears after the (mocked) sim resolves.
    await waitFor(
      () => expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument(),
      { timeout: 5000 },
    );

    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    // After continue, neither loading scene nor recap modal should be visible.
    await waitFor(() => expect(screen.queryByText(/Catching up/)).toBeNull());
    expect(screen.queryByRole("button", { name: /continue/i })).toBeNull();
  });

  it("holds the loading scene for at least MIN_LOADING_SCENE_MS even when sim resolves instantly", async () => {
    const fakeResult: CatchupResult = {
      elapsedSeconds: 3 * 3600,
      goldGained: big(0),
      inspiGained: big(0),
      canvasesSold: 0,
      itemsCrafted: 0,
      paintMasteryGained: big(0),
      achievementsUnlocked: [],
    };
    runCatchupSimulationMock.mockImplementation(async () => fakeResult);

    seedStoreWithLastSeen(Date.now() - 3 * 3600_000);
    const startTime = Date.now();
    render(<Bootstrap />);

    await screen.findByText(/Catching up/);
    await waitFor(
      () => expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument(),
      { timeout: MIN_LOADING_SCENE_MS + 2000 },
    );
    const elapsed = Date.now() - startTime;
    // Allow 100ms slack for jsdom scheduling jitter.
    expect(elapsed).toBeGreaterThanOrEqual(MIN_LOADING_SCENE_MS - 100);
  });
});

describe("Bootstrap in-session tab-return catch-up", () => {
  let hiddenSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    useGameStore.setState({
      currentStage: 0,
      partLevels: { cotyledon: 5 },
      inspiration: ZERO,
      gold: ZERO,
      canvasProgress: 0,
      paintMastery: ZERO,
      completedAchievements: {},
    });
    runCatchupSimulationMock.mockClear();
  });

  function setHidden(value: boolean): void {
    hiddenSpy?.mockRestore();
    hiddenSpy = vi.spyOn(document, "hidden", "get").mockReturnValue(value);
  }

  afterEach(() => {
    if (hiddenSpy) {
      hiddenSpy.mockRestore();
      hiddenSpy = null;
    }
  });

  it("returning to a tab hidden for 10min: silent sim → toast appears", async () => {
    // Stub the sim so the test doesn't depend on the real engine timing.
    const fakeResult: CatchupResult = {
      elapsedSeconds: 600,
      goldGained: big(123),
      inspiGained: big(45),
      canvasesSold: 1,
      itemsCrafted: 0,
      paintMasteryGained: big(0),
      achievementsUnlocked: [],
    };
    runCatchupSimulationMock.mockImplementation(async () => fakeResult);

    // Boot with elapsed ≤ 5s so Bootstrap mounts straight into `playing`
    // and installs the lifecycle listener.
    seedStoreWithLastSeen(Date.now() - 1000);
    render(<Bootstrap />);
    await act(async () => {
      await Promise.resolve();
    });
    // No catch-up sim should have fired during boot.
    expect(runCatchupSimulationMock).not.toHaveBeenCalled();

    // Simulate "tab was hidden 10 minutes ago" by rewinding lastSeen, then
    // dispatch a visibilitychange that returns the tab to visible.
    useGameStore.setState({ lastSeen: Date.now() - 600_000 });
    setHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    // The in-session sim ran for the missed window…
    await waitFor(() => expect(runCatchupSimulationMock).toHaveBeenCalledOnce());
    const [elapsedArg] = runCatchupSimulationMock.mock.calls[0]!;
    expect(elapsedArg).toBeGreaterThan(595);
    expect(elapsedArg).toBeLessThan(605);

    // …and the toast appeared over the live game.
    await waitFor(() =>
      expect(screen.getByText(/Welcome back/)).toBeInTheDocument(),
    );
  });

  it("returning to a tab hidden for 3s: no sim, no toast", async () => {
    seedStoreWithLastSeen(Date.now() - 1000);
    render(<Bootstrap />);
    await act(async () => {
      await Promise.resolve();
    });
    runCatchupSimulationMock.mockClear();

    useGameStore.setState({ lastSeen: Date.now() - 3000 });
    setHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    // Below the 5s silent threshold: no sim, no toast.
    await new Promise((r) => setTimeout(r, 50));
    expect(runCatchupSimulationMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Welcome back/)).toBeNull();
  });
});
