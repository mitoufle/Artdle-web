import type { JSX } from "react";
import { useState, useRef } from "react";
import type { DesignNode, DesignCluster } from "./types";
import { computeClusterLayout } from "@/core/clusterLayout";
import { VIEWBOX } from "@/components/constellation/nodeLayout";
import styles from "./DesignerCanvas.module.css";

const DRAG_THRESHOLD_PX = 5;
const NODE_R_MINOR = 12;
const NODE_R_MAJOR = 18;
const ZOOM_FACTOR = 1.2;
const MIN_VIEW_W = 100;
const MAX_VIEW_W = 4000;

interface Props {
  nodes: ReadonlyArray<DesignNode>;
  clusters: ReadonlyArray<DesignCluster>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
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

/** Frame the whole cluster sky, identical to the in-game constellation extent. */
const INITIAL_VIEWBOX: ViewBox = {
  x: 0,
  y: 0,
  w: VIEWBOX.width,
  h: VIEWBOX.height,
};

export function DesignerCanvas({ nodes, clusters, selectedId, onSelect, onMove }: Props): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<NodeDragState | null>(null);
  const [pan, setPan] = useState<PanState | null>(null);
  const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VIEWBOX);
  const justDragged = useRef(false);
  // Same layout the game uses, so designer positions match the constellation route.
  const positions = computeClusterLayout(nodes, clusters);

  function pointFor(id: string): { x: number; y: number } {
    return positions[id] ?? { x: 0, y: 0 };
  }

  /** Convert client (screen) pixels to SVG-space coordinates, honoring pan + zoom. */
  function clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const fracX = (clientX - rect.left) / rect.width;
    const fracY = (clientY - rect.top) / rect.height;
    return {
      x: viewBox.x + fracX * viewBox.w,
      y: viewBox.y + fracY * viewBox.h,
    };
  }

  function handleWheel(e: React.WheelEvent) {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const fracX = (e.clientX - rect.left) / rect.width;
    const fracY = (e.clientY - rect.top) / rect.height;
    const cursorSvg = {
      x: viewBox.x + fracX * viewBox.w,
      y: viewBox.y + fracY * viewBox.h,
    };
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
    const svgPoint = clientToSvg(e.clientX, e.clientY);
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

  function handleNodeClick(node: DesignNode) {
    if (justDragged.current) return;
    onSelect(node.id);
  }

  function handleResetView() {
    setViewBox(INITIAL_VIEWBOX);
  }

  const cursorStyle = pan !== null ? "grabbing" : "grab";

  return (
    <div className={styles.canvas}>
      <button
        type="button"
        className={styles.resetViewBtn}
        onClick={handleResetView}
        title="Reset pan + zoom"
      >
        ⟲ Reset view
      </button>
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
          x={-VIEWBOX.width * 5}
          y={-VIEWBOX.height * 5}
          width={VIEWBOX.width * 11}
          height={VIEWBOX.height * 11}
          fill="var(--bg-0)"
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handleBackgroundPointerMove}
          onPointerUp={handleBackgroundPointerUp}
        />

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
                onClick={() => handleNodeClick(node)}
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
