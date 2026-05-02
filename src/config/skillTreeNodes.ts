export type SkillNodeId =
  | "goldsmith"
  | "patient_eye"
  | "second_slot"
  | "faster_strokes"
  | "better_brush";

export interface SkillNodeConfig {
  readonly id: SkillNodeId;
  readonly name: string;
  /** Fame cost. JS number (small in v1, max sum is 144). */
  readonly cost: number;
  /** Strict-linear prereq: must be purchased before this one. null only for the chain root. */
  readonly prereq: SkillNodeId | null;
}

/**
 * Phase 3 skill tree: 5 nodes in a strict-linear chain.
 * Costs and effects per PORT_PLAN.md §1.4. Effects are wired in:
 *   - core/multipliers.ts: goldsmith (+10% gold), patient_eye (+15% inspi), better_brush (roll-time +1 magnitude)
 *   - workshopSlice.ts: second_slot (1→2 equip slots via getCurrentSlotCount)
 *   - systems/ascend.ts: faster_strokes (-10% palier via getEffectivePalier)
 */
export const SKILL_NODES: ReadonlyArray<SkillNodeConfig> = [
  { id: "goldsmith",      name: "Goldsmith",      cost: 1,   prereq: null },
  { id: "patient_eye",    name: "Patient Eye",    cost: 3,   prereq: "goldsmith" },
  { id: "second_slot",    name: "Second Slot",    cost: 10,  prereq: "patient_eye" },
  { id: "faster_strokes", name: "Faster Strokes", cost: 30,  prereq: "second_slot" },
  { id: "better_brush",   name: "Better Brush",   cost: 100, prereq: "faster_strokes" },
];
