import type { SkillNodeId } from "@/config/skillTreeNodes";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export const FAME_HUB: Point = { x: 300, y: 510 };

export const NODE_POSITIONS: Record<SkillNodeId, Point> = {
  goldsmith:      { x: 200, y: 400 },
  patient_eye:    { x: 400, y: 400 },
  second_slot:    { x: 470, y: 290 },
  faster_strokes: { x: 360, y: 180 },
  better_brush:   { x: 250, y:  80 },
};

export type EdgeFrom = SkillNodeId | "fame";

export const EDGES: ReadonlyArray<{ from: EdgeFrom; to: SkillNodeId }> = [
  { from: "fame",           to: "goldsmith" },
  { from: "goldsmith",      to: "patient_eye" },
  { from: "patient_eye",    to: "second_slot" },
  { from: "second_slot",    to: "faster_strokes" },
  { from: "faster_strokes", to: "better_brush" },
];

export const VIEWBOX = { width: 600, height: 600 };
