import type { JSX } from "react";
import styles from "./TreeScene.module.css";
import phase1 from "@/assets/images/Inspiration_Tree_phases/phase1.png";
import phase2 from "@/assets/images/Inspiration_Tree_phases/phase2.png";
import phase3 from "@/assets/images/Inspiration_Tree_phases/phase3.png";
import phase4 from "@/assets/images/Inspiration_Tree_phases/phase4.png";
import phase5 from "@/assets/images/Inspiration_Tree_phases/phase5.png";
import phase6 from "@/assets/images/Inspiration_Tree_phases/phase6.png";

interface Props {
  stage: number;
}

/** Phase images: one per stage. Stages beyond the last image clamp to the final phase. */
const PHASE_IMAGES = [phase1, phase2, phase3, phase4, phase5, phase6] as const;
const getPhaseImage = (stage: number): string => {
  const idx = Math.min(PHASE_IMAGES.length - 1, Math.max(0, stage));
  return PHASE_IMAGES[idx]!;
};

/**
 * Per-stage backdrop: a full-scene phase image overlaid with animated inspiration
 * motes and rising fireflies. Mote and firefly positions/durations come from the
 * handoff §Animations spec.
 */
export function TreeScene({ stage }: Props): JSX.Element {
  const phaseSrc = getPhaseImage(stage);
  return (
    <div className={styles.scene} data-stage={String(stage)}>
      <img
        src={phaseSrc}
        alt=""
        aria-hidden="true"
        className={styles.fullImage}
        data-testid="phase-image"
      />

      <svg
        viewBox="0 0 480 320"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        className={styles.svg}
        aria-label="Inspiration tree scene"
      >
        {/* Inspiration motes around the canopy — 7 small circles, animated opacity */}
        <g data-testid="motes">
          <circle cx="310" cy="160" r="2" fill="#9b6cd6">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx="335" cy="148" r="2" fill="#f4efe6">
            <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="350" cy="170" r="1.5" fill="#9b6cd6">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="3.1s" repeatCount="indefinite" />
          </circle>
          <circle cx="295" cy="178" r="2" fill="#f4efe6">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2.6s" repeatCount="indefinite" />
          </circle>
          <circle cx="325" cy="155" r="1.5" fill="#9b6cd6">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3.7s" repeatCount="indefinite" />
          </circle>
          <circle cx="345" cy="190" r="2" fill="#9b6cd6">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="310" cy="195" r="1.5" fill="#f4efe6">
            <animate attributeName="opacity" values="0.3;0.9;0.3" dur="3.3s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Fireflies rising from the ground — cy and opacity animation */}
        <g data-testid="fireflies">
          <circle cx="180" cy="260" r="1.5" fill="#ffd86a">
            <animate attributeName="cy" values="260;180" dur="6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur="6s" repeatCount="indefinite" />
          </circle>
          <circle cx="240" cy="260" r="1.5" fill="#ffd86a">
            <animate attributeName="cy" values="260;200" dur="7.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur="7.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="400" cy="260" r="1.5" fill="#ffd86a">
            <animate attributeName="cy" values="260;190" dur="8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur="8s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
    </div>
  );
}
