import type { DesignFile } from "./types";

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export async function saveToFile(design: DesignFile): Promise<SaveResult> {
  try {
    const response = await fetch("/api/school-design", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(design),
    });
    const json = (await response.json()) as SaveResult;
    return json;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
