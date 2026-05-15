import type { DesignFile } from "./types";

export interface SaveResult {
  ok: boolean;
  error?: string;
}

/** Strip effect `id` fields so they don't pollute the committed JSON. */
function stripEffectIds(design: DesignFile): unknown {
  return design.map((tier) => ({
    ...tier,
    researches: tier.researches.map((r) => ({
      ...r,
      effects: r.effects.map(({ kind, value }) => ({ kind, value })),
    })),
  }));
}

export async function saveToFile(design: DesignFile): Promise<SaveResult> {
  try {
    const response = await fetch("/api/school-design", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(stripEffectIds(design)),
    });
    const json = (await response.json()) as SaveResult;
    return json;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
