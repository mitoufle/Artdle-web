import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoomRail } from "@/components/painting/RoomRail";

describe("<RoomRail />", () => {
  it("renders 4 room tabs", () => {
    render(<RoomRail />);
    expect(screen.getByRole("tab", { name: /workshop/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /office/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /school/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /lab/i })).toBeInTheDocument();
  });

  it("Workshop tab is marked active (aria-selected='true')", () => {
    render(<RoomRail />);
    expect(screen.getByRole("tab", { name: /workshop/i })).toHaveAttribute("aria-selected", "true");
  });

  it("Office, School, Lab tabs are NOT active", () => {
    render(<RoomRail />);
    expect(screen.getByRole("tab", { name: /office/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /school/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /lab/i })).toHaveAttribute("aria-selected", "false");
  });

  it("Office, School, Lab tabs are disabled", () => {
    render(<RoomRail />);
    expect(screen.getByRole("tab", { name: /office/i })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /school/i })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /lab/i })).toBeDisabled();
  });

  it("Workshop tab is enabled", () => {
    render(<RoomRail />);
    expect(screen.getByRole("tab", { name: /workshop/i })).not.toBeDisabled();
  });
});
