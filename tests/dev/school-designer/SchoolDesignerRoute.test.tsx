import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SchoolDesignerRoute } from "@/dev/school-designer/SchoolDesignerRoute";
import { STORAGE_KEY } from "@/dev/school-designer/storage";

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={["/dev/school-designer"]}>
      <SchoolDesignerRoute />
    </MemoryRouter>,
  );
}

function injectDesignWithCustomKind() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([
      {
        tier: 1,
        label: "Test Tier",
        examCost: 0,
        researches: [
          {
            id: "r1",
            name: "Test Research",
            durationSeconds: 300,
            effects: [{ id: "e1", kind: "my_custom_kind", value: 0.5 }],
          },
        ],
      },
    ]),
  );
}

describe("<SchoolDesignerRoute />", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the top bar with title and save button", () => {
    renderWithRouter();
    // Title <span>, disambiguated from the DevTabBar's "School Designer" <a> tab.
    expect(screen.getByText(/school designer/i, { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save to file/i })).toBeInTheDocument();
  });

  it("renders 5 tiers from the baseline design on first load", () => {
    renderWithRouter();
    expect(screen.getByText("Tier 1")).toBeInTheDocument();
    expect(screen.getByText("Tier 5")).toBeInTheDocument();
  });

  it("renders research names from the JSON", () => {
    renderWithRouter();
    expect(screen.getByDisplayValue("Color Theory Basics")).toBeInTheDocument();
  });

  it("effect kind select shows all known effect kinds as options", () => {
    renderWithRouter();
    const select = screen.getAllByTestId("effect-kind-select")[0] as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain("canvas_gold_pct");
    expect(values).toContain("speed_pct");
    expect(values).toContain("worker_xp_pct");
  });

  it("effect kind select includes a 'custom…' option", () => {
    renderWithRouter();
    const select = screen.getAllByTestId("effect-kind-select")[0] as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain("__custom__");
  });

  it("custom text input is hidden when all effects have a known kind", () => {
    renderWithRouter();
    expect(screen.queryByTestId("effect-kind-custom-input")).not.toBeInTheDocument();
  });

  it("custom text input appears pre-populated when effect kind is not in the known list", () => {
    injectDesignWithCustomKind();
    renderWithRouter();
    const input = screen.getByTestId("effect-kind-custom-input") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("my_custom_kind");
  });

  it("selecting 'custom…' in the effect kind select reveals a text input", () => {
    renderWithRouter();
    const select = screen.getAllByTestId("effect-kind-select")[0];
    fireEvent.change(select, { target: { value: "__custom__" } });
    expect(screen.getByTestId("effect-kind-custom-input")).toBeInTheDocument();
  });
});
