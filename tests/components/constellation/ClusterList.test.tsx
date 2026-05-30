import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ClusterList } from "@/components/constellation/ClusterList";

describe("ClusterList", () => {
  const rows = [
    { id: "colors", name: "Colors", owned: 11, total: 11, complete: true },
    { id: "school", name: "School", owned: 0, total: 1, complete: false },
  ];

  it("renders a row per cluster with owned/total", () => {
    const { getByText } = render(<ClusterList rows={rows} />);
    expect(getByText("Colors")).toBeTruthy();
    expect(getByText("11 / 11")).toBeTruthy();
    expect(getByText("0 / 1")).toBeTruthy();
  });

  it("marks completed clusters", () => {
    const { getByTestId } = render(<ClusterList rows={rows} />);
    expect(getByTestId("cluster-row-colors").getAttribute("data-complete")).toBe("true");
    expect(getByTestId("cluster-row-school").getAttribute("data-complete")).toBe("false");
  });
});
