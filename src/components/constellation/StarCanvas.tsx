import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import { getSkillNodeConfig } from "@/config/skillTreeNodes";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { formatBig } from "@/core/formatter";
import { EDGES, FAME_HUB, NODE_POSITIONS, VIEWBOX, type EdgeFrom } from "./nodeLayout";
import {
  DEFAULT_VIEWPORT,
  clampPan,
  zoomAt,
  type ViewportState,
} from "./viewport";
import styles from "./StarCanvas.module.css";

const DRAG_THRESHOLD_PX = 3;
const WHEEL_ZOOM_FACTOR = 1.15;

function screenToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    if (import.meta.env.DEV) {
      console.warn("screenToSvg: getScreenCTM() returned null (SVG may not be fully mounted); falling back to {0,0}");
    }
    return { x: 0, y: 0 };
  }
  const out = pt.matrixTransform(ctm.inverse());
  return { x: out.x, y: out.y };
}

function fameHubBody(): JSX.Element {
  const s = useGameStore.getState();
  const lifetimeBonus = s.pastRuns.reduce((acc, r) => acc + r.fame, 0);
  const lifetime = big(lifetimeBonus);
  return (
    <>
      <div>To spend: {formatBig(s.fame)}</div>
      <div>Lifetime earned: {formatBig(lifetime)}</div>
      <div>Ascends: {s.ascendCount}</div>
    </>
  );
}

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
  viewport: ViewportState;
  onViewportChange: (v: ViewportState) => void;
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

export function StarCanvas({ selectedId, onSelect, nodeStates, viewport, onViewportChange }: Props): JSX.Element {
  const pushHoverInfo = useGameStore((s) => s.pushHoverInfo);
  const clearHoverInfo = useGameStore((s) => s.clearHoverInfo);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragStart = useRef<{ screenX: number; screenY: number; viewport: ViewportState } | null>(null);
  const dragMoved = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const { x, y } = screenToSvg(el, e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
      onViewportChange(zoomAt(viewport, x, y, factor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewport, onViewportChange]);

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>): void => {
    if (e.button !== 0) return;
    dragStart.current = { screenX: e.clientX, screenY: e.clientY, viewport };
    dragMoved.current = false;
    setDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>): void => {
    const start = dragStart.current;
    const svg = svgRef.current;
    if (!start || !svg) return;
    const dxScreen = e.clientX - start.screenX;
    const dyScreen = e.clientY - start.screenY;
    if (Math.abs(dxScreen) > DRAG_THRESHOLD_PX || Math.abs(dyScreen) > DRAG_THRESHOLD_PX) {
      dragMoved.current = true;
    }
    const rect = svg.getBoundingClientRect();
    const svgPerPxX = (VIEWBOX.width / start.viewport.zoom) / rect.width;
    const svgPerPxY = (VIEWBOX.height / start.viewport.zoom) / rect.height;
    const { panX, panY } = clampPan(
      start.viewport.panX - dxScreen * svgPerPxX,
      start.viewport.panY - dyScreen * svgPerPxY,
      start.viewport.zoom,
    );
    onViewportChange({ ...start.viewport, panX, panY });
  };

  const endDrag = (): void => {
    dragStart.current = null;
    setDragging(false);
  };

  const onClickCapture = (e: React.MouseEvent<SVGSVGElement>): void => {
    if (dragMoved.current) {
      e.stopPropagation();
      dragMoved.current = false;
    }
  };

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>): void => {
    e.preventDefault();
    onViewportChange(DEFAULT_VIEWPORT);
  };

  return (
    <div className={styles.canvas}>
      <svg
        ref={svgRef}
        viewBox={`${viewport.panX} ${viewport.panY} ${VIEWBOX.width / viewport.zoom} ${VIEWBOX.height / viewport.zoom}`}
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
        data-dragging={dragging ? "true" : undefined}
        aria-label="Constellation skill tree"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onClickCapture={onClickCapture}
        onDoubleClick={onDoubleClick}
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

        <g
          data-testid="fame-hub"
          onMouseEnter={() => pushHoverInfo("FAME", fameHubBody(), "Permanent currency. Spent in the constellation.")}
          onMouseLeave={() => clearHoverInfo()}
        >
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
