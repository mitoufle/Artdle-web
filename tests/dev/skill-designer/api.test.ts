import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { saveToFile } from "@/dev/skill-designer/api";
import type { DesignFile } from "@/dev/skill-designer/types";

const sample: DesignFile = {
  version: 1,
  title: "x",
  designedAt: "",
  nodes: [],
  clusters: [],
};

describe("saveToFile", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("POSTs the design to /api/skill-design and returns the parsed body on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;
    const result = await saveToFile(sample);
    expect(result).toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/skill-design",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns ok=false with error on network failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const result = await saveToFile(sample);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("network down");
  });
});
