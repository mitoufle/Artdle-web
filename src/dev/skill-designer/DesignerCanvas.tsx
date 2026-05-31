import type { JSX } from "react";
import { useState, useRef } from "react";
import type { DesignNode, DesignCluster } from "./types";
import { computeClusterLayout, constellationViewbox } from "@/core/clusterLayout";
import { snapToGrid } from "./gridSnap";
import styles from "./DesignerCanvas.module.css";

const DRAG_THRESHOLD_PX = 5;
const NODE_R_MINOR = 12;
const NODE_R_MAJOR = 18;
const ZOOM_FACTOR = 1.2;
const MIN_VIEW_W = 100;
const MAX_VIEW_W = 4000;
const DEFAULT_GRID_SIZE = 50;
const MIN_GRID_SIZE = 5;
const MAX_GRID_SIZE = 500;

interface Props {
  nodes: ReadonlyArray<DesignNode>;
  clusters: ReadonlyArray<DesignCluster>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
  /** Ctrl+click a node while another is active → toggle a parent link to it. */
  onToggleLink: (clickedId: string) => void;
}

interface NodeDragState {
  nodeId: string;
  startClientX: number;
  startClientY: number;
  moved: boolean;
}

interface PanState {
  startClientX: number;
  startClientY: number;
  startViewX: number;
  startViewY: number;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function DesignerCanvas({ nodes, clusters, selectedId, onSelect, onMove, onToggleLink }: Props): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<NodeDragState | null>(null);
  const [pan, setPan] = useState<PanState | null>(null);
  const justDragged = useRef(false);
  // Grid is a view-only preference (not part of the design file). When on, the
  // canvas draws a reference grid and dragged nodes snap to its intersections.
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  // Same layout the game uses, so designer positions match the constellation route.
  const positions = computeClusterLayout(nodes, clusters);
  // Frame THIS designer's clusters (including newly-authored ones), not the game's
  // fixed seven — so a fresh cluster's region stays within Reset-view reach.
  const full = constellationViewbox(positions, clusters);
  const fullViewbox: ViewBox = { x: 0, y: 0, w: full.width, h: full.height };
  const [viewBox, setViewBox] = useState<ViewBox>(fullViewbox);

  function pointFor(id: string): { x: number; y: number } {
    return positions[id] ?? { x: 0, y: 0 };
  }

  /**
   * Convert client (screen) pixels to SVG user-space coordinates via the
   * browser's own screen CTM. This honors pan, zoom, AND the SVG's default
   * `preserveAspectRatio="xMidYMid meet"` letterboxing — a manual rect-fraction
   * mapping silently breaks the moment the pane aspect ratio differs from the
   * viewBox, making dragged nodes drift away from the cursor. Mirrors the proven
   * `screenToSvg` in components/constellation/StarCanvas.tsx.
   */
  function clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const out = pt.matrixTransform(ctm.inverse());
    return { x: out.x, y: out.y };
  }

  function handleWheel(e: React.WheelEvent) {
    if (!svgRef.current) return;
    // Anchor the zoom on the cursor's true SVG position (CTM-based, see clientToSvg).
    const cursorSvg = clientToSvg(e.clientX, e.clientY);
    const factor = e.deltaY > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    const newW = Math.max(MIN_VIEW_W, Math.min(MAX_VIEW_W, viewBox.w * factor));
    const newH = (newW / viewBox.w) * viewBox.h;
    const newX = cursorSvg.x - (cursorSvg.x - viewBox.x) * (newW / viewBox.w);
    const newY = cursorSvg.y - (cursorSvg.y - viewBox.y) * (newH / viewBox.h);
    setViewBox({ x: newX, y: newY, w: newW, h: newH });
  }

  function handleBackgroundPointerDown(e: React.PointerEvent) {
    setPan({
      startClientX: e.clientX,
      startClientY: e.clientY,
      startViewX: viewBox.x,
      startViewY: viewBox.y,
    });
    if (typeof (e.currentTarget as Element).setPointerCapture === "function") {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
  }

  function handleBackgroundPointerMove(e: React.PointerEvent) {
    if (pan === null) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dxScreen = e.clientX - pan.startClientX;
    const dyScreen = e.clientY - pan.startClientY;
    const dxSvg = (dxScreen / rect.width) * viewBox.w;
    const dySvg = (dyScreen / rect.height) * viewBox.h;
    setViewBox({
      ...viewBox,
      x: pan.startViewX - dxSvg,
      y: pan.startViewY - dySvg,
    });
  }

  function handleBackgroundPointerUp(e: React.PointerEvent) {
    if (pan === null) return;
    if (typeof (e.currentTarget as Element).releasePointerCapture === "function") {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    setPan(null);
  }

  function handleNodePointerDown(e: React.PointerEvent, node: DesignNode) {
    e.stopPropagation(); // don't start a pan when clicking a node
    setDrag({
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    });
    if (typeof (e.currentTarget as Element).setPointerCapture === "function") {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
  }

  function handleNodePointerMove(e: React.PointerEvent) {
    if (drag === null) return;
    const dx = Math.abs(e.clientX - drag.startClientX);
    const dy = Math.abs(e.clientY - drag.startClientY);
    if (!drag.moved && dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;
    const raw = clientToSvg(e.clientX, e.clientY);
    const svgPoint = gridEnabled
      ? { x: snapToGrid(raw.x, gridSize), y: snapToGrid(raw.y, gridSize) }
      : raw;
    onMove(drag.nodeId, svgPoint);
    if (!drag.moved) setDrag({ ...drag, moved: true });
  }

  function handleNodePointerUp(e: React.PointerEvent) {
    if (drag === null) return;
    if (drag.moved) {
      justDragged.current = true;
      window.setTimeout(() => {
        justDragged.current = false;
      }, 0);
    }
    if (typeof (e.currentTarget as Element).releasePointerCapture === "function") {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    setDrag(null);
  }

  function handleNodeClick(e: React.MouseEvent, node: DesignNode) {
    if (justDragged.current) return;
    // Ctrl+click another node while one is active → toggle a parent link
    // instead of changing the selection.
    if (e.ctrlKey && selectedId !== null && selectedId !== node.id) {
      onToggleLink(node.id);
      return;
    }
    onSelect(node.id);
  }

  function handleResetView() {
    setViewBox(fullViewbox);
  }

  const cursorStyle = pan !== null ? "grabbing" : "grab";

  return (
    <div className={styles.canvas}>
      {selectedId !== null && (
        <div className={styles.linkHint}>Ctrl+click another node to toggle a parent link</div>
      )}
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.ctrlBtn}
          onClick={handleResetView}
          title="Reset pan + zoom"
        >
          ⟲ Reset view
        </button>
        <button
          type="button"
          className={`${styles.ctrlBtn} ${gridEnabled ? styles.ctrlBtnActive : ""}`}
          onClick={() => setGridEnabled((g) => !g)}
          aria-pressed={gridEnabled}
          title="Toggle grid + snap-to-grid"
        >
          # Grid {gridEnabled ? "on" : "off"}
        </button>
        {gridEnabled && (
          <label className={styles.gridSizeRow}>
            Size
            <input
              className={styles.gridSizeInput}
              type="number"
              min={MIN_GRID_SIZE}
              max={MAX_GRID_SIZE}
              step={5}
              value={gridSize}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) {
                  setGridSize(Math.max(MIN_GRID_SIZE, Math.min(MAX_GRID_SIZE, v)));
                }
              }}
            />
          </label>
        )}
      </div>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        xmlns="http://www.w3.org/2000/svg"
        onWheel={handleWheel}
        style={{ cursor: cursorStyle }}
      >
        {/* Background — also catches pan events. Sized big enough that pan never reaches an edge. */}
        <rect
          x={-full.width * 5}
          y={-full.height * 5}
          width={full.width * 11}
          height={full.height * 11}
          fill="var(--bg-0)"
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handleBackgroundPointerMove}
          onPointerUp={handleBackgroundPointerUp}
        />

        {/* Reference grid. pointer-events:none so pan still hits the background below. */}
        {gridEnabled && (
          <>
            <defs>
              <pattern
                id="designer-grid"
                width={gridSize}
                height={gridSize}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                  fill="none"
                  stroke="var(--ink-line)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  opacity={0.3}
                />
              </pattern>
            </defs>
            <rect
              x={-full.width * 5}
              y={-full.height * 5}
              width={full.width * 11}
              height={full.height * 11}
              fill="url(#designer-grid)"
              pointerEvents="none"
            />
          </>
        )}

        <g>
          {nodes.flatMap((node) => {
            const b = pointFor(node.id);
            return node.parentIds.map((fromKey) => {
              const a = pointFor(fromKey);
              return (
                <line
                  key={`${fromKey}-${node.id}`}
                  data-testid={`designer-edge-${fromKey}-${node.id}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--ink-line)"
                  strokeWidth={1.5}
                  opacity={0.6}
                />
              );
            });
          })}
        </g>

        <g onPointerMove={handleNodePointerMove} onPointerUp={handleNodePointerUp}>
          {nodes.map((node) => {
            const pos = pointFor(node.id);
            const isSelected = selectedId === node.id;
            const isMajor = node.kind === "major";
            const r = isMajor ? NODE_R_MAJOR : NODE_R_MINOR;
            const fill = isMajor ? "var(--gold)" : "var(--bg-1)";
            const strokeWidth = isMajor ? 3 : 2;
            return (
              <g
                key={node.id}
                data-testid={`designer-node-${node.id}`}
                data-selected={isSelected ? "true" : undefined}
                data-kind={node.kind}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
                onClick={(e) => handleNodeClick(e, node)}
              >
                {isMajor && (
                  <circle cx={pos.x} cy={pos.y} r={r + 8} fill="rgba(255,216,106,0.20)" />
                )}
                {isSelected && (
                  <circle cx={pos.x} cy={pos.y} r={r + 6} fill="rgba(155,108,214,0.3)" />
                )}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r}
                  fill={fill}
                  stroke="var(--gold)"
                  strokeWidth={strokeWidth}
                />
                <text
                  x={pos.x}
                  y={pos.y + r + 14}
                  textAnchor="middle"
                  fontFamily="var(--mono)"
                  fontSize={isMajor ? 11 : 10}
                  fontWeight={isMajor ? 700 : 400}
                  fill={isMajor ? "var(--ink-1)" : "var(--ink-2)"}
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
