import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SchoolDesignerRoute } from "@/dev/school-designer/SchoolDesignerRoute";

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={["/dev/school-designer"]}>
      <SchoolDesignerRoute />
    </MemoryRouter>,
  );
}

describe("<SchoolDesignerRoute />", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the top bar with title and save button", () => {
    renderWithRouter();
    expect(screen.getByText(/school designer/i)).toBeInTheDocument();
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
});
