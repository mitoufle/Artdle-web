import type { JSX } from "react";
import { useRef } from "react";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import { SKILL_NODES } from "@/config/skillTreeNodes";
import { FAME_HUB, NODE_POSITIONS, VIEWBOX } from "./nodeLayout";
import type { ViewportState } from "./viewport";
import styles from "./MiniMap.module.css";

interface Props {
  ownedById: Record<SkillNodeId, boolean>;
  selectedId: SkillNodeId | null;
  viewport: ViewportState;
  onJump: (svgX: number, svgY: number) => void;
}

export function MiniMap({ ownedById, selectedId, viewport, onJump }: Props): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const handleClick = (e: React.MouseEvent<SVGSVGElement>): void => {
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const out = pt.matrixTransform(ctm.inverse());
    onJump(out.x, out.y);
  };
  const viewW = VIEWBOX.width / viewport.zoom;
  const viewH = VIEWBOX.height / viewport.zoom;
  const ownedCount = Object.values(ownedById).filter(Boolean).length;
  const totalCount = SKILL_NODES.length;

  return (
    <section className={styles.panel} aria-label="Constellation mini-map">
      <div className={styles.subhead}>Mini-map</div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
        aria-label="Constellation overview"
        onClick={handleClick}
        style={{ cursor: "pointer" }}
      >
        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="var(--bg-stone-d)" />
        <circle cx={FAME_HUB.x} cy={FAME_HUB.y} r="8" fill="var(--fame)" opacity="0.8" />
        {(Object.keys(NODE_POSITIONS) as SkillNodeId[]).map((id) => {
          const pos = NODE_POSITIONS[id];
          if (!pos) return null;
          const owned = ownedById[id];
          const isSelected = selectedId === id;
          const fill = owned ? "var(--gold)" : "var(--inspi-d)";
          return (
            <g
              key={id}
              data-testid={`mini-node-${id}`}
              data-state={owned ? "owned" : "locked"}
              data-selected={isSelected ? "true" : undefined}
            >
              {isSelected && <circle cx={pos.x} cy={pos.y} r="14" fill="rgba(155,108,214,0.4)" />}
              <circle cx={pos.x} cy={pos.y} r={isSelected ? 8 : 6} fill={fill} opacity={owned ? 1 : 0.55} />
            </g>
          );
        })}
        <rect
          data-testid="minimap-viewport"
          x={viewport.panX}
          y={viewport.panY}
          width={viewW}
          height={viewH}
          fill="rgba(255,216,106,0.08)"
          stroke="var(--gold)"
          strokeWidth="3"
          pointerEvents="none"
        />
      </svg>
      <div className={styles.caption}>
        {ownedCount} / {totalCount} owned · zoom out for more
      </div>
    </section>
  );
}
