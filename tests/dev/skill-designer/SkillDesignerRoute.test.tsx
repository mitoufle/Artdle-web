import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillDesignerRoute } from "@/dev/skill-designer/SkillDesignerRoute";

describe("<SkillDesignerRoute />", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the action bar", () => {
    render(<SkillDesignerRoute />);
    expect(screen.getByRole("button", { name: /save to file/i })).toBeInTheDocument();
  });

  it("renders all 3 panes (list, canvas, form placeholder)", () => {
    render(<SkillDesignerRoute />);
    expect(screen.getByRole("button", { name: /add node/i })).toBeInTheDocument();
    expect(screen.getByTestId("fame-hub")).toBeInTheDocument();
    expect(screen.getByText(/select a node/i)).toBeInTheDocument();
  });

  it("clicking Add Node creates a node and shows it in the list", () => {
    render(<SkillDesignerRoute />);
    fireEvent.click(screen.getByRole("button", { name: /add node/i }));
    expect(screen.getAllByText(/New Node/i).length).toBeGreaterThan(0);
  });

  it("after adding a node, clicking it in the list selects it (form fields appear)", () => {
    render(<SkillDesignerRoute />);
    fireEvent.click(screen.getByRole("button", { name: /add node/i }));
    fireEvent.click(screen.getAllByText(/New Node/i)[0]!);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it("clicking Export opens the modal showing the JSON", () => {
    render(<SkillDesignerRoute />);
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
