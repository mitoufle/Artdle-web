import type { JSX } from "react";
import { useState, useRef } from "react";
import type { DesignNode } from "./types";
import { computeAutoLayout, FAME_HUB_X, FAME_HUB_Y, CANVAS_WIDTH } from "./autoLayout";
import styles from "./DesignerCanvas.module.css";

const VIEWBOX_HEIGHT = 600;
const DRAG_THRESHOLD_PX = 5;
const NODE_R = 12;

interface Props {
  nodes: ReadonlyArray<DesignNode>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
}

interface DragState {
  nodeId: string;
  startClientX: number;
  startClientY: number;
  startNodeX: number;
  startNodeY: number;
  moved: boolean;
}

export function DesignerCanvas({ nodes, selectedId, onSelect, onMove }: Props): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const justDragged = useRef(false);
  const positions = computeAutoLayout(nodes);

  function pointFor(id: string | "fame"): { x: number; y: number } {
    if (id === "fame") return { x: FAME_HUB_X, y: FAME_HUB_Y };
    return positions[id] ?? { x: FAME_HUB_X, y: FAME_HUB_Y };
  }

  function clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = VIEWBOX_HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(e: React.PointerEvent, node: DesignNode) {
    const pos = positions[node.id] ?? { x: 0, y: 0 };
    setDrag({
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startNodeX: pos.x,
      startNodeY: pos.y,
      moved: false,
    });
    if (typeof (e.currentTarget as Element).setPointerCapture === "function") {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (drag === null) return;
    const dx = Math.abs(e.clientX - drag.startClientX);
    const dy = Math.abs(e.clientY - drag.startClientY);
    if (!drag.moved && dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;
    const svgPoint = clientToSvg(e.clientX, e.clientY);
    onMove(drag.nodeId, svgPoint);
    if (!drag.moved) setDrag({ ...drag, moved: true });
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (drag === null) return;
    if (drag.moved) {
      justDragged.current = true;
      // Reset on next tick so onClick (if any) sees true and skips, then resets.
      window.setTimeout(() => { justDragged.current = false; }, 0);
    }
    if (typeof (e.currentTarget as Element).releasePointerCapture === "function") {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // Some browsers throw if pointer wasn't captured.
      }
    }
    setDrag(null);
  }

  function handleNodeClick(node: DesignNode) {
    if (justDragged.current) return;
    onSelect(node.id);
  }

  return (
    <div className={styles.canvas}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${CANVAS_WIDTH} ${VIEWBOX_HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={CANVAS_WIDTH} height={VIEWBOX_HEIGHT} fill="var(--bg-0)" />

        <g>
          {nodes.map((node) => {
            const a = node.parentId === null ? pointFor("fame") : pointFor(node.parentId);
            const b = pointFor(node.id);
            const fromKey = node.parentId === null ? "fame" : node.parentId;
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
          })}
        </g>

        <g data-testid="fame-hub">
          <circle cx={FAME_HUB_X} cy={FAME_HUB_Y} r={20} fill="var(--fame)" />
          <text
            x={FAME_HUB_X}
            y={FAME_HUB_Y + 40}
            textAnchor="middle"
            fontFamily="serif"
            fontSize="12"
            fontWeight="700"
            fill="var(--fame)"
          >
            FAME
          </text>
        </g>

        <g onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
          {nodes.map((node) => {
            const pos = pointFor(node.id);
            const isSelected = selectedId === node.id;
            return (
              <g
                key={node.id}
                data-testid={`designer-node-${node.id}`}
                data-selected={isSelected ? "true" : undefined}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => handlePointerDown(e, node)}
                onClick={() => handleNodeClick(node)}
              >
                {isSelected && (
                  <circle cx={pos.x} cy={pos.y} r={NODE_R + 6} fill="rgba(155,108,214,0.3)" />
                )}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={NODE_R}
                  fill="var(--bg-1)"
                  stroke="var(--gold)"
                  strokeWidth={2}
                />
                <text
                  x={pos.x}
                  y={pos.y + NODE_R + 14}
                  textAnchor="middle"
                  fontFamily="var(--mono)"
                  fontSize="10"
                  fill="var(--ink-2)"
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
