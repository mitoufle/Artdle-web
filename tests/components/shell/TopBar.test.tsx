import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TopBar } from "@/components/shell/TopBar";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopBar />
    </MemoryRouter>,
  );
}

describe("<TopBar />", () => {
  it("renders the ARTDLE brand wordmark", () => {
    renderAt("/tree");
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("RTDLE")).toBeInTheDocument();
  });

  it("renders all 4 nav items", () => {
    renderAt("/tree");
    expect(screen.getByRole("link", { name: /tree/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /painting/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ascension/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /constellation/i })).toBeInTheDocument();
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
