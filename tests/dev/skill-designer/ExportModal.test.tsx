import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportModal } from "@/dev/skill-designer/ExportModal";
import type { DesignFile } from "@/dev/skill-designer/types";

const sample: DesignFile = {
  version: 1,
  title: "x",
  designedAt: "",
  nodes: [],
  clusters: [],
};

describe("<ExportModal />", () => {
  it("does not render when not open", () => {
    const { container } = render(<ExportModal open={false} design={sample} onClose={() => {}} />);
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });

  it("renders the JSON in a textarea when open", () => {
    render(<ExportModal open={true} design={sample} onClose={() => {}} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toContain('"version": 1');
  });

  it("clicking Close calls onClose", () => {
    const onClose = vi.fn();
    render(<ExportModal open={true} design={sample} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
