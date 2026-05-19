import type { DesignFile } from "./types";

export interface SaveResult {
  ok: boolean;
  error?: string;
}

function stripEphemeral(design: DesignFile): unknown {
  return design.map(({ conditionText: _drop, ...a }) => ({
    ...a,
    effects: a.effects.map(({ kind, value }) => ({ kind, value })),
  }));
}

export async function saveToFile(design: DesignFile): Promise<SaveResult> {
  try {
    const res = await fetch("/api/achievement-design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stripEphemeral(design)),
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
