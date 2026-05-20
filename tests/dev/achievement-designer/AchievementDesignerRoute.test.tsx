import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock the JSON the designer reads as its baseline. Must be declared BEFORE
// importing the route. Three achievements across two categories:
// 2× canvas, 1× secret. Categories `workshop`, `ascension`, `school_office`
// have no entries and must not render headers.
vi.mock("@/config/achievementsDesign.json", () => ({
  default: [
    { id: "a", name: "A", description: "", icon: "", category: "canvas",
      condition: { stat: "x", op: ">=", value: 0 }, effects: [] },
    { id: "b", name: "B", description: "", icon: "", category: "secret",
      condition: { stat: "x", op: ">=", value: 0 }, effects: [] },
    { id: "c", name: "C", description: "", icon: "", category: "canvas",
      condition: { stat: "x", op: ">=", value: 0 }, effects: [] },
  ],
}));

import { AchievementDesignerRoute } from "@/dev/achievement-designer/AchievementDesignerRoute";

function renderRoute() {
  return render(
    <MemoryRouter>
      <AchievementDesignerRoute />
    </MemoryRouter>,
  );
}

describe("AchievementDesignerRoute — groups", () => {
  it("renders one header per non-empty category", () => {
    renderRoute();
    expect(screen.getByRole("button", { name: /canvas \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /secret \(1\)/i })).toBeInTheDocument();
  });

  it("does not render a header for empty categories", () => {
    renderRoute();
    expect(screen.queryByRole("button", { name: /workshop \(/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ascension \(/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /school_office \(/i })).not.toBeInTheDocument();
  });

  it("starts with all groups collapsed (aria-expanded=false)", () => {
    renderRoute();
    const canvas = screen.getByRole("button", { name: /canvas \(2\)/i });
    const secret = screen.getByRole("button", { name: /secret \(1\)/i });
    expect(canvas.getAttribute("aria-expanded")).toBe("false");
    expect(secret.getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking a header toggles aria-expanded", () => {
    renderRoute();
    const canvas = screen.getByRole("button", { name: /canvas \(2\)/i });
    fireEvent.click(canvas);
    expect(canvas.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(canvas);
    expect(canvas.getAttribute("aria-expanded")).toBe("false");
  });
});
