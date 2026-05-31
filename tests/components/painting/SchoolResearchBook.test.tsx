import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SchoolResearchBook } from "@/components/painting/SchoolResearchBook";
import { useGameStore } from "@/store";

beforeEach(() => {
  useGameStore.setState({ purchasedNodes: {}, activeResearch: null });
});

describe("<SchoolResearchBook />", () => {
  it("renders nothing until the School is unlocked", () => {
    render(<SchoolResearchBook />);
    expect(screen.queryByTestId("school-research-book")).toBeNull();
  });

  it("when unlocked with no research assigned, shows the idle (breathing) prompt", () => {
    // unlock_school grants the school_access capability.
    useGameStore.setState({ purchasedNodes: { unlock_school: 1 }, activeResearch: null });
    render(<SchoolResearchBook />);
    const book = screen.getByTestId("school-research-book");
    expect(book).toHaveAttribute("data-idle", "true");
    expect(book).toHaveTextContent(/assign a research/i);
  });

  it("displays the assigned research name", () => {
    useGameStore.setState({
      purchasedNodes: { unlock_school: 1 },
      activeResearch: { id: "brushwork_basics", remainingSeconds: 100 },
    });
    render(<SchoolResearchBook />);
    const book = screen.getByTestId("school-research-book");
    expect(book).not.toHaveAttribute("data-idle");
    expect(book).toHaveTextContent("Brushwork Basics");
  });

  it("shows a progress bar reflecting elapsed research time", () => {
    // brushwork_basics duration = 7200s. Half remaining → ~50% filled.
    useGameStore.setState({
      purchasedNodes: { unlock_school: 1 },
      completedResearches: {},
      activeResearch: { id: "brushwork_basics", remainingSeconds: 3600 },
    });
    render(<SchoolResearchBook />);
    const fill = screen.getByTestId("school-research-progress").firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("50%");
  });

  it("has no progress bar while idle", () => {
    useGameStore.setState({ purchasedNodes: { unlock_school: 1 }, activeResearch: null });
    render(<SchoolResearchBook />);
    expect(screen.queryByTestId("school-research-progress")).toBeNull();
  });
});
