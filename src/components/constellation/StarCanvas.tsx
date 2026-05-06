import type { JSX } from "react";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import { getSkillNodeConfig } from "@/config/skillTreeNodes";
import { EDGES, FAME_HUB, NODE_POSITIONS, VIEWBOX, type EdgeFrom } from "./nodeLayout";
import styles from "./StarCanvas.module.css";

export interface NodeState {
  level: number;
  maxLevel: number;
  /** True iff every parent has level >= 1 (or this node is a root). */
  available: boolean;
  /** True iff player can afford the next-level cost. */
  affordable: boolean;
}

interface Props {
  selectedId: SkillNodeId | null;
  onSelect: (id: SkillNodeId) => void;
  nodeStates: Record<SkillNodeId, NodeState>;
}

const TWINKLES: ReadonlyArray<{ x: number; y: number; r: number; dur: string }> = [
  { x: 80,  y: 100, r: 1.5, dur: "2.5s" },
  { x: 540, y: 80,  r: 2,   dur: "3s"   },
  { x: 120, y: 240, r: 1,   dur: "3.5s" },
  { x: 460, y: 360, r: 1.5, dur: "2.8s" },
  { x: 520, y: 480, r: 2,   dur: "4s"   },
  { x: 80,  y: 470, r: 1,   dur: "3.2s" },
  { x: 280, y: 30,  r: 1.5, dur: "3.7s" },
];

function nodeStateName(state: NodeState): "owned" | "maxed" | "available" | "locked" {
  if (state.level >= state.maxLevel && state.maxLevel > 0) return "maxed";
  if (state.level > 0) return "owned";
  if (state.available) return "available";
  return "locked";
}

function pointFor(id: EdgeFrom): { x: number; y: number } {
  if (id === "fame") return FAME_HUB;
  return NODE_POSITIONS[id] ?? FAME_HUB;
}

export function StarCanvas({ selectedId, onSelect, nodeStates }: Props): JSX.Element {
  return (
    <div className={styles.canvas}>
      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
        aria-label="Constellation skill tree"
      >
        <defs>
          <pattern id="cs-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
          <radialGradient id="cs-warm" cx="0.5" cy="1" r="0.6">
            <stop offset="0"   stopColor="rgba(255,216,106,0.06)" />
            <stop offset="0.4" stopColor="rgba(255,216,106,0.02)" />
            <stop offset="1"   stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="var(--bg-0)" />
        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="url(#cs-warm)" />
        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="url(#cs-grid)" />

        <g>
          {TWINKLES.map((t, idx) => (
            <circle key={idx} cx={t.x} cy={t.y} r={t.r} fill="#9b6cd6">
              <animate
                attributeName="opacity"
                values="0.2;0.9;0.2"
                dur={t.dur}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>

        <g>
          {EDGES.map(({ from, to }) => {
            const a = pointFor(from);
            const b = pointFor(to);
            const fromOwned = from === "fame" ? true : (nodeStates[from]?.level ?? 0) > 0;
            return (
              <line
                key={`${from}-${to}`}
                data-testid={`edge-${from}-${to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={fromOwned ? "var(--gold)" : "var(--ink-line)"}
                strokeWidth={fromOwned ? 2 : 1.5}
                strokeDasharray={fromOwned ? undefined : "6 4"}
                opacity={fromOwned ? 0.85 : 0.55}
              />
            );
          })}
        </g>

        <g data-testid="fame-hub">
          <circle cx={FAME_HUB.x} cy={FAME_HUB.y} r="32" fill="rgba(255,216,106,0.12)" />
          <circle cx={FAME_HUB.x} cy={FAME_HUB.y} r="20" fill="var(--fame)" />
          <text
            x={FAME_HUB.x}
            y={FAME_HUB.y + 50}
            textAnchor="middle"
            fontFamily="serif"
            fontSize="14"
            fontWeight="700"
            letterSpacing="0.18em"
            fill="var(--fame)"
            style={{ filter: "drop-shadow(0 0 6px rgba(255,216,106,0.6))" }}
          >
            FAME
          </text>
        </g>

        <g>
          {(Object.keys(NODE_POSITIONS) as SkillNodeId[]).map((id) => {
            const pos = NODE_POSITIONS[id];
            if (!pos) return null;
            const state = nodeStates[id];
            if (!state) return null;
            const stateName = nodeStateName(state);
            const isSelected = selectedId === id;
            const isMajor = getSkillNodeConfig(id)?.kind === "major";
            const baseR = isMajor ? 16 : 11;
            const r = isSelected ? baseR + 3 : baseR;

            return (
              <g
                key={id}
                data-testid={`node-${id}`}
                data-state={stateName}
                data-selected={isSelected ? "true" : undefined}
                data-kind={isMajor ? "major" : "minor"}
                style={{ cursor: "pointer" }}
                onClick={() => onSelect(id)}
              >
                {isMajor && (
                  <circle cx={pos.x} cy={pos.y} r={r + 10} fill="rgba(255,216,106,0.18)" />
                )}
                {(stateName === "owned" || stateName === "maxed" || isSelected) && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r + 8}
                    fill={isSelected ? "rgba(155,108,214,0.25)" : "rgba(255,216,106,0.18)"}
                  />
                )}
                {stateName === "maxed" ? (
                  <circle cx={pos.x} cy={pos.y} r={r} fill="var(--gold)" stroke="var(--gold-d)" strokeWidth="2" />
                ) : stateName === "owned" ? (
                  <circle cx={pos.x} cy={pos.y} r={r} fill="var(--gold)" stroke="var(--gold-d)" strokeWidth="1.5" />
                ) : stateName === "available" ? (
                  <>
                    <circle cx={pos.x} cy={pos.y} r={r} fill="var(--bg-1)" stroke="var(--gold)" strokeWidth="2" />
                    {isSelected && (
                      <circle cx={pos.x} cy={pos.y} r={r * 0.45} fill="var(--inspi)" />
                    )}
                  </>
                ) : (
                  <circle cx={pos.x} cy={pos.y} r={r * 0.7} fill="var(--bg-2)" stroke="var(--ink-line)" strokeWidth="1" />
                )}
                {state.maxLevel > 1 && state.level > 0 && (
                  <text
                    x={pos.x}
                    y={pos.y - r - 6}
                    textAnchor="middle"
                    fontFamily="var(--mono)"
                    fontSize="10"
                    fontWeight="700"
                    fill="var(--gold)"
                  >
                    {state.level}/{state.maxLevel}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
