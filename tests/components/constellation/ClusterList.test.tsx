import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClusterList } from "@/components/constellation/ClusterList";

describe("<ClusterList />", () => {
  it("renders the Starters cluster heading", () => {
    render(<ClusterList ownedCount={0} totalCount={5} />);
    expect(screen.getByText(/Starters/i)).toBeInTheDocument();
  });

  it("shows owned/total ratio", () => {
    render(<ClusterList ownedCount={2} totalCount={5} />);
    expect(screen.getByText(/2 \/ 5/i)).toBeInTheDocument();
  });
});
