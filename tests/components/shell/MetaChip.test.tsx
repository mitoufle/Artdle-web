import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetaChip } from "@/components/shell/MetaChip";

describe("<MetaChip />", () => {
  it("renders a version label", () => {
    render(<MetaChip />);
    expect(screen.getByText(/v2/i)).toBeInTheDocument();
  });
});
