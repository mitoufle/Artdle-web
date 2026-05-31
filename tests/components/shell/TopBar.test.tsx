import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TopBar } from "@/components/shell/TopBar";
import { useGameStore } from "@/store";

vi.mock("@/ui/hooks/useMusic", () => ({
  useMusic: () => ({ volume: 0.2, muted: false, setVolume: vi.fn(), toggleMute: vi.fn() }),
}));

beforeEach(() => {
  // The "all 5 nav items" and "active route" tests assume Ascension +
  // Constellation render as <NavLink>. Both are now sticky-unlock-gated
  // (2026-05-27), so seed the unlocks for tests that don't specifically
  // test the locked state.
  useGameStore.setState({ unlockedAscension: true, unlockedConstellation: true });
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopBar />
    </MemoryRouter>,
  );
}

describe("<TopBar />", () => {
  it("renders the Artdle brand logo", () => {
    renderAt("/tree");
    expect(screen.getByAltText("Artdle")).toBeInTheDocument();
  });

  it("clicking the brand logo unlocks the secret Random Clicker achievement", () => {
    useGameStore.setState((s) => ({
      completedAchievements: {},
      statsLifetime: { ...s.statsLifetime, logoClicks: 0 },
    }));
    renderAt("/tree");
    fireEvent.click(screen.getByAltText("Artdle"));
    expect(useGameStore.getState().completedAchievements.Random_clicker).toBe(true);
  });

  it("renders all 5 nav items", () => {
    renderAt("/tree");
    expect(screen.getByRole("link", { name: /tree/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /painting/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ascension/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /constellation/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /achievements/i })).toBeInTheDocument();
  });

  it("marks the active nav item per current route (aria-current)", () => {
    renderAt("/painting");
    expect(screen.getByRole("link", { name: /painting/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /tree/i })).not.toHaveAttribute("aria-current", "page");
  });

  it("active route has data-active attribute", () => {
    renderAt("/ascension");
    const activeLink = screen.getByRole("link", { name: /ascension/i });
    expect(activeLink).toHaveAttribute("data-active", "true");
  });
});
