import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PastRunsLedger } from "@/components/ascension/PastRunsLedger";

describe("<PastRunsLedger />", () => {
  it("renders 'No past ascends' when runs array is empty", () => {
    render(<PastRunsLedger runs={[]} totalFame={0} />);
    expect(screen.getByText(/No past ascends/i)).toBeInTheDocument();
  });

  it("renders rows for each past run (most recent last)", () => {
    const runs = [
      { fame: 3, ascendedAt: 1 },
      { fame: 5, ascendedAt: 2 },
    ];
    const { container } = render(<PastRunsLedger runs={runs} totalFame={8} />);
    expect(container.textContent).toMatch(/Run\s*01/i);
    expect(container.textContent).toMatch(/Run\s*02/i);
  });

  it("renders the total-fame footer", () => {
    const runs = [{ fame: 12, ascendedAt: 1 }];
    const { container } = render(<PastRunsLedger runs={runs} totalFame={12} />);
    expect(container.textContent).toMatch(/Total/i);
    expect(container.textContent).toContain("12");
  });

  it("limits the rendered row count to 4 (most recent kept; older trimmed)", () => {
    const runs = [
      { fame: 1, ascendedAt: 1 },
      { fame: 2, ascendedAt: 2 },
      { fame: 3, ascendedAt: 3 },
      { fame: 4, ascendedAt: 4 },
      { fame: 5, ascendedAt: 5 },
      { fame: 6, ascendedAt: 6 },
    ];
    render(<PastRunsLedger runs={runs} totalFame={21} />);
    // The 4 most recent are runs index 2..5 (Run 03..06).
    expect(screen.queryByText(/Run 01/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Run 02/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Run 03/i)).toBeInTheDocument();
    expect(screen.getByText(/Run 06/i)).toBeInTheDocument();
  });
});
