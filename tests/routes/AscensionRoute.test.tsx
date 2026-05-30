import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AscensionRoute } from "@/routes/AscensionRoute";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { ASCEND_QUOTES } from "@/config/ascendQuotes";

function renderAscensionRouteWithRouter() {
  return render(
    <MemoryRouter initialEntries={["/ascension"]}>
      <Routes>
        <Route path="/ascension" element={<AscensionRoute />} />
        <Route path="/constellation" element={<div data-testid="constellation-stub">constellation</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderAscensionRoute() {
  return render(
    <MemoryRouter>
      <AscensionRoute />
    </MemoryRouter>,
  );
}

describe("AscensionRoute (v2 visual)", () => {
  beforeEach(() => {
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.getState().resetRunCurrencies();
    useGameStore.setState({
      ascendCount: 0,
      fame: big(0),
      pastRuns: [],
      purchasedNodes: {},
    });
  });

  it("renders the cavern video backdrop", () => {
    const { container } = renderAscensionRoute();
    expect(container.querySelector('[data-testid="cavern-video"]')).toBeInTheDocument();
  });

  it("renders the right-rail panels (threshold + fame preview + past runs)", () => {
    renderAscensionRoute();
    expect(screen.getByText(/Current inspiration/i)).toBeInTheDocument();
    expect(screen.getByText(/If you ascend now/i)).toBeInTheDocument();
    expect(screen.getByText(/Past ascensions/i)).toBeInTheDocument();
  });

  it("Step Through button is disabled below the 10k inspi gate", () => {
    useGameStore.setState({ inspiration: big(0) });
    renderAscensionRoute();
    expect(screen.getByRole("button", { name: /step through/i })).toBeDisabled();
  });

  it("Step Through button is disabled at 9,999 inspi (just below gate)", () => {
    useGameStore.setState({ inspiration: big(9_999) });
    renderAscensionRoute();
    expect(screen.getByRole("button", { name: /step through/i })).toBeDisabled();
  });

  it("Step Through button is enabled at 10,000 inspi (gate reached)", () => {
    useGameStore.setState({ inspiration: big(10_000) });
    renderAscensionRoute();
    expect(screen.getByRole("button", { name: /step through/i })).not.toBeDisabled();
  });

  it("clicking Step Through shows the confirmation modal", () => {
    useGameStore.setState({ inspiration: big(12_000) });
    renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("confirmation Cancel button closes the modal without ascending", () => {
    useGameStore.setState({ inspiration: big(12_000) });
    renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useGameStore.getState().ascendCount).toBe(0);
  });

  it("confirmation Ascend swaps to the opening video, then fires performAscend on ended", () => {
    useGameStore.setState({ inspiration: big(12_000) });
    const { container } = renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend/i }));
    // Modal closes and the cavern swaps to the gate-opening video. The ascend
    // hasn't happened yet — it fires when the video ends.
    expect(useGameStore.getState().ascendCount).toBe(0);
    const video = container.querySelector<HTMLVideoElement>('[data-testid="cavern-video"]');
    expect(video).not.toBeNull();
    expect(video?.getAttribute("data-phase")).toBe("opening");
    fireEvent.ended(video!);
    expect(useGameStore.getState().ascendCount).toBe(1);
  });

  it("ledger reflects past ascends after performing one", () => {
    useGameStore.setState({ inspiration: big(12_000) });
    const { container } = renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend/i }));
    const video = container.querySelector<HTMLVideoElement>('[data-testid="cavern-video"]');
    fireEvent.ended(video!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/No past ascends/i)).not.toBeInTheDocument();
  });
});

describe("AscensionRoute cinematic overlay", () => {
  beforeEach(() => {
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.getState().resetRunCurrencies();
    useGameStore.setState({
      ascendCount: 0,
      fame: big(0),
      pastRuns: [],
      purchasedNodes: {},
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("after confirming, the opening-phase overlay click-blocker is mounted", () => {
    useGameStore.setState({ inspiration: big(12_000) });
    renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend/i }));
    const overlay = screen.getByTestId("ascend-cinematic-overlay");
    expect(overlay.getAttribute("data-phase")).toBe("opening");
    // The opening overlay has no visible text (it's the invisible click blocker).
    expect(screen.queryByTestId("ascend-cinematic-gain")).not.toBeInTheDocument();
  });

  it("when the gate video ends, the blackout overlay shows '+N fame gained' and a quote", () => {
    useGameStore.setState({ inspiration: big(12_000) });
    const { container } = renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend/i }));
    const video = container.querySelector<HTMLVideoElement>('[data-testid="cavern-video"]');
    fireEvent.ended(video!);
    const overlay = screen.getByTestId("ascend-cinematic-overlay");
    expect(overlay.getAttribute("data-phase")).toBe("blackout");
    const gain = screen.getByTestId("ascend-cinematic-gain");
    expect(gain.textContent).toMatch(/^\+\d+(\.\d+)?[KMBTQ]?\s*fame gained$/);
    const quote = screen.getByTestId("ascend-cinematic-quote");
    expect(ASCEND_QUOTES).toContain(quote.textContent ?? "");
  });

  it("'click to continue' hint appears only after 4 seconds in the blackout phase", () => {
    useGameStore.setState({ inspiration: big(12_000) });
    const { container } = renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend/i }));
    const video = container.querySelector<HTMLVideoElement>('[data-testid="cavern-video"]');
    fireEvent.ended(video!);
    expect(screen.queryByTestId("ascend-cinematic-hint")).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3999); });
    expect(screen.queryByTestId("ascend-cinematic-hint")).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2); });
    expect(screen.getByTestId("ascend-cinematic-hint")).toBeInTheDocument();
  });

  it("clicking the blackout overlay dismisses it", () => {
    useGameStore.setState({ inspiration: big(12_000) });
    const { container } = renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend/i }));
    const video = container.querySelector<HTMLVideoElement>('[data-testid="cavern-video"]');
    fireEvent.ended(video!);
    const overlay = screen.getByTestId("ascend-cinematic-overlay");
    fireEvent.click(overlay);
    expect(screen.queryByTestId("ascend-cinematic-overlay")).not.toBeInTheDocument();
  });

  it("clicking the opening overlay does NOT dismiss it (gate must finish)", () => {
    useGameStore.setState({ inspiration: big(12_000) });
    renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend/i }));
    const overlay = screen.getByTestId("ascend-cinematic-overlay");
    fireEvent.click(overlay);
    expect(screen.getByTestId("ascend-cinematic-overlay").getAttribute("data-phase")).toBe("opening");
  });

  it("dismissing the blackout navigates to /constellation", () => {
    useGameStore.setState({ inspiration: big(12_000) });
    const { container } = renderAscensionRouteWithRouter();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend/i }));
    const video = container.querySelector<HTMLVideoElement>('[data-testid="cavern-video"]');
    fireEvent.ended(video!);
    fireEvent.click(screen.getByTestId("ascend-cinematic-overlay"));
    expect(screen.getByTestId("constellation-stub")).toBeInTheDocument();
  });

  it("dismissing the blackout clears lastAscendRoll (no stale reveal next ascend)", () => {
    useGameStore.setState({ inspiration: big(12_000) });
    const { container } = renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend/i }));
    const video = container.querySelector<HTMLVideoElement>('[data-testid="cavern-video"]');
    fireEvent.ended(video!);
    // Simulate a populated roll surviving into the blackout, then dismiss.
    act(() => {
      useGameStore.setState({
        lastAscendRoll: [{
          id: "w-test",
          levelBefore: 1,
          levelAfter: 2,
          statsBefore: { goldPct: 0, speed: 1, critChance: 0.01, strokesPerCrit: 1, comboChance: 0 },
          statsAfter: { goldPct: 0.03, speed: 1, critChance: 0.01, strokesPerCrit: 1, comboChance: 0 },
        }],
      });
    });
    fireEvent.click(screen.getByTestId("ascend-cinematic-overlay"));
    expect(useGameStore.getState().lastAscendRoll).toBeNull();
  });

  it("step-through is gated through both opening and blackout phases", () => {
    useGameStore.setState({ inspiration: big(12_000) });
    const { container } = renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend/i }));
    // Opening phase: CTA unmounted, gate-open video playing.
    expect(screen.queryByTestId("step-through-btn")).not.toBeInTheDocument();
    const video = container.querySelector<HTMLVideoElement>('[data-testid="cavern-video"]');
    fireEvent.ended(video!);
    // Blackout phase: cavern still holds the opening video's last frame, so CTA remains unmounted.
    expect(screen.queryByTestId("step-through-btn")).not.toBeInTheDocument();
    // Dismiss the cinematic. Cavern returns to idle; CTA reappears (disabled — inspiration is 0).
    fireEvent.click(screen.getByTestId("ascend-cinematic-overlay"));
    expect(screen.getByTestId("step-through-btn")).toBeDisabled();
  });
});
