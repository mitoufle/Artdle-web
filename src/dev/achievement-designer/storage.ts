import type { DesignFile, DesignAchievement, DesignEffect, DesignCondition } from "./types";

export const STORAGE_KEY = "artdle:achievement-design:draft";

export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function migrateEffect(e: unknown): DesignEffect {
  const ef = e as Record<string, unknown>;
  return {
    id: typeof ef.id === "string" && ef.id ? ef.id : uuid(),
    kind: typeof ef.kind === "string" ? ef.kind : "",
    value: typeof ef.value === "number" ? ef.value : 0,
  };
}

function migrateCondition(c: unknown): DesignCondition {
  const cond = c as Record<string, unknown>;
  return {
    stat: typeof cond.stat === "string" ? cond.stat : "lifetime.canvasesSold",
    op: ([">=", ">", "==", "<=", "<"] as const).includes(cond.op as ">=" | ">" | "==" | "<=" | "<")
      ? (cond.op as DesignCondition["op"])
      : ">=",
    value: typeof cond.value === "number" ? cond.value : 1,
  };
}

function migrateAchievement(a: unknown): DesignAchievement {
  const ach = a as Record<string, unknown>;
  return {
    id: typeof ach.id === "string" ? ach.id : uuid(),
    _stableKey: typeof ach._stableKey === "string" && ach._stableKey ? ach._stableKey : uuid(),
    name: typeof ach.name === "string" ? ach.name : "",
    description: typeof ach.description === "string" ? ach.description : "",
    icon: typeof ach.icon === "string" ? ach.icon : "⭐",
    category:
      typeof ach.category === "string" && ach.category.length > 0
        ? ach.category
        : "canvas",
    condition: migrateCondition(ach.condition ?? {}),
    ...(typeof ach.conditionText === "string" ? { conditionText: ach.conditionText } : {}),
    effects: Array.isArray(ach.effects) ? ach.effects.map(migrateEffect) : [],
  };
}

export function migrateDesign(raw: unknown): DesignFile {
  if (Array.isArray(raw)) return raw.map(migrateAchievement);
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
