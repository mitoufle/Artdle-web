import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActionBar } from "@/dev/skill-designer/ActionBar";

describe("<ActionBar />", () => {
  it("renders three primary actions: Save / Export / Reset", () => {
    render(
      <ActionBar
        status="saved"
        issueCount={0}
        onSave={() => {}}
        onExport={() => {}}
        onReset={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /save to file/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("clicking Save calls onSave", () => {
    const onSave = vi.fn();
    render(<ActionBar status="saved" issueCount={0} onSave={onSave} onExport={() => {}} onReset={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /save to file/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("clicking Reset shows a confirm; only calls onReset if confirmed", () => {
    const onReset = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    render(<ActionBar status="saved" issueCount={0} onSave={() => {}} onExport={() => {}} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(onReset).not.toHaveBeenCalled();
    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(onReset).toHaveBeenCalledOnce();
    confirmSpy.mockRestore();
  });

  it("shows 'Unsaved changes' indicator when status='dirty'", () => {
    render(<ActionBar status="dirty" issueCount={0} onSave={() => {}} onExport={() => {}} onReset={() => {}} />);
    expect(screen.getByText(/unsaved/i)).toBeInTheDocument();
  });

  it("shows '✓ Saved' indicator when status='saved'", () => {
    render(<ActionBar status="saved" issueCount={0} onSave={() => {}} onExport={() => {}} onReset={() => {}} />);
    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  });

  it("shows N validation issues when issueCount > 0", () => {
    render(<ActionBar status="saved" issueCount={3} onSave={() => {}} onExport={() => {}} onReset={() => {}} />);
    expect(screen.getByText(/3.*issue/i)).toBeInTheDocument();
  });
});
