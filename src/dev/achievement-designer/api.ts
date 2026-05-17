export async function saveToFile(data: unknown): Promise<{ ok: boolean }> {
  try {
    const res = await fetch("/__superpowers__/write-json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "src/config/achievementsDesign.json", data }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
