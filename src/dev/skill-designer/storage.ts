import type { DesignFile, DesignNode } from "./types";

export const STORAGE_KEY = "artdle:skill-design:draft";

interface LegacyDesignNode {
  id: string;
  name: string;
  description: string;
  numericEffect: string;
  parentId?: string | null;
  parentIds?: ReadonlyArray<string>;
  stacking?: "additive" | "multiplicative";
  kind?: "minor" | "major";
  maxLevel: number;
  costs: ReadonlyArray<number>;
  position: { x: number; y: number } | null;
}

/**
 * Migrate a node entry to the current schema. Handles two pre-existing shapes:
 *   - parentId: string | null  → parentIds: [parentId] or []
 *   - missing stacking         → defaults to "additive"
 */
function migrateNode(raw: LegacyDesignNode): DesignNode {
  const parentIds: ReadonlyArray<string> =
    raw.parentIds !== undefined
      ? raw.parentIds
      : raw.parentId === null || raw.parentId === undefined
        ? []
        : [raw.parentId];

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    numericEffect: raw.numericEffect,
    parentIds,
    stacking: raw.stacking ?? "additive",
    kind: raw.kind ?? "minor",
    maxLevel: raw.maxLevel,
    costs: raw.costs,
    position: raw.position,
  };
}

export function loadDraft(): DesignFile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.nodes)) {
      return {
        ...parsed,
        nodes: parsed.nodes.map(migrateNode),
      } as DesignFile;
    }
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
