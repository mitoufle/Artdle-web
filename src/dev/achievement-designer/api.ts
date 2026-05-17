import type { DesignFile } from "./types";

export interface SaveResult {
  ok: boolean;
  error?: string;
}

function stripEffectIds(design: DesignFile): unknown {
  return design.map((a) => ({
    ...a,
    effects: a.effects.map(({ kind, value }) => ({ kind, value })),
  }));
}

export async function saveToFile(design: DesignFile): Promise<SaveResult> {
  try {
    const res = await fetch("/__superpowers__/write-json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "src/config/achievementsDesign.json", data: stripEffectIds(design) }),
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
