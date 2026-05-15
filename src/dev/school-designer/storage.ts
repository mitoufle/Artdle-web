import type { DesignFile, DesignTier, DesignResearch, DesignResearchEffect } from "./types";

export const STORAGE_KEY = "artdle:school-design:draft";

export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function migrateEffect(e: unknown): DesignResearchEffect {
  const ef = e as Record<string, unknown>;
  return {
    id: typeof ef.id === "string" && ef.id ? ef.id : uuid(),
    kind: typeof ef.kind === "string" ? ef.kind : "",
    value: typeof ef.value === "number" ? ef.value : 0,
  };
}

function migrateResearch(r: unknown): DesignResearch {
  const res = r as Record<string, unknown>;
  return {
    id: typeof res.id === "string" ? res.id : "",
    name: typeof res.name === "string" ? res.name : "",
    durationSeconds: typeof res.durationSeconds === "number" ? res.durationSeconds : 300,
    effects: Array.isArray(res.effects) ? res.effects.map(migrateEffect) : [],
  };
}

function migrateTier(t: unknown): DesignTier {
  const tier = t as Record<string, unknown>;
  return {
    tier: typeof tier.tier === "number" ? tier.tier : 0,
    label: typeof tier.label === "string" ? tier.label : "",
    examCost: typeof tier.examCost === "number" ? tier.examCost : 0,
    researches: Array.isArray(tier.researches) ? tier.researches.map(migrateResearch) : [],
  };
}

/** Migrate a raw (possibly id-less) design array to a fully valid DesignFile. */
export function migrateDesign(raw: unknown): DesignFile {
  if (Array.isArray(raw)) return raw.map(migrateTier);
  return [];
}

export function loadDraft(): DesignFile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return migrateDesign(parsed);
    return null;
  } catch {
    return null;
  }
}

export function saveDraft(design: DesignFile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(design));
  } catch {
    // Quota exceeded — silently ignore.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
