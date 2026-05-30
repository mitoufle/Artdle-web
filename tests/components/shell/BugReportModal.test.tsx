import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BugReportModal } from "@/components/shell/BugReportModal";

vi.mock("@/store", () => ({
  useGameStore: {
    getState: () => ({
      playerId: "test-player",
      gold: { toString: () => "100" },
      inspiration: { toString: () => "0" },
      fame: { toString: () => "5" },
    }),
  },
  SAVE_VERSION: 28,
}));

describe("<BugReportModal />", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, url: "https://github.com/x/y/issues/1" }),
      })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("renders nothing when closed", () => {
    const { container } = render(<BugReportModal open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("disables submit until a description is typed", () => {
    render(<BugReportModal open onClose={() => {}} />);
    const submit = screen.getByRole("button", { name: /submit/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "broken" } });
    expect(submit).not.toBeDisabled();
  });

  it("POSTs the report and shows success", async () => {
    render(<BugReportModal open onClose={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "broken" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/report-bug",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call).toBeDefined();
    const opts = call?.[1] as { body?: unknown } | undefined;
    expect(String(opts?.body)).toContain("broken");
    await screen.findByText(/issues\/1/);
  });

  it("shows an error state and keeps the text when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ ok: false, error: "nope" }) })),
    );
    render(<BugReportModal open onClose={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "broken" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await screen.findByText(/couldn.t submit|error/i);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("broken");
  });
});
