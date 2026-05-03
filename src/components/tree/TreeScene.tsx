import type { JSX } from "react";
import styles from "./TreeScene.module.css";

interface Props {
  stage: number;
}

const STAGE_NAMES = ["seed", "sapling", "tree"] as const;

/**
 * Pixel-art landscape: sky → mountains → hills → pond → ground → tree → motes → fireflies.
 * The tree visual has 3 variants keyed off `stage`. Motes and fireflies animate
 * via SVG `<animate>` (durations from handoff §Animations).
 *
 * Scene colors are inlined per the handoff's pixel-art SVG approach (the colors
 * are scene-specific, not part of the ARTDLE token palette).
 */
export function TreeScene({ stage }: Props): JSX.Element {
  const treeStageName = STAGE_NAMES[Math.max(0, Math.min(2, stage))] ?? "seed";
  return (
    <div className={styles.scene} data-stage={String(stage)}>
      <svg
        viewBox="0 0 480 320"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        className={styles.svg}
        aria-label="Pixel-art landscape with a tree"
      >
        {/* Sky gradient */}
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a4f6a" />
            <stop offset="1" stopColor="#7a96b0" />
          </linearGradient>
        </defs>
        <rect width="480" height="200" fill="url(#sky)" />

        {/* Moon top-left */}
        <circle cx="60" cy="50" r="14" fill="#f4efe6" opacity="0.9" />
        <circle cx="65" cy="46" r="10" fill="#3a4f6a" opacity="0.5" />

        {/* Stars (pixel rectangles, scattered) */}
        <g fill="#f4efe6" opacity="0.7">
          <rect x="120" y="30" width="2" height="2" />
          <rect x="180" y="60" width="2" height="2" />
          <rect x="220" y="40" width="2" height="2" />
          <rect x="300" y="20" width="2" height="2" />
          <rect x="360" y="55" width="2" height="2" />
          <rect x="420" y="35" width="2" height="2" />
          <rect x="150" y="100" width="2" height="2" />
        </g>

        {/* Far mountains */}
        <polygon points="0,180 80,120 130,150 200,100 280,140 360,90 440,130 480,120 480,180" fill="#1f2a3a" />

        {/* Mid hills + pine triangles */}
        <polygon points="0,210 100,170 200,200 300,170 400,200 480,180 480,260 0,260" fill="#2e4a3a" />
        <g fill="#1a2e22">
          <polygon points="80,200 90,180 100,200" />
          <polygon points="120,205 130,185 140,205" />
          <polygon points="220,205 230,185 240,205" />
          <polygon points="380,200 390,180 400,200" />
        </g>

        {/* Waterfall (small line) */}
        <rect x="320" y="195" width="2" height="20" fill="#6fb1ff" opacity="0.6" />

        {/* Foreground ground */}
        <rect x="0" y="240" width="480" height="80" fill="#3a5a3a" />
        <rect x="0" y="260" width="480" height="60" fill="#2e4a2e" />

        {/* Grass tufts */}
        <g fill="#5a8a4a">
          <rect x="40" y="248" width="3" height="4" />
          <rect x="100" y="246" width="3" height="6" />
          <rect x="170" y="250" width="3" height="3" />
          <rect x="280" y="246" width="3" height="6" />
          <rect x="380" y="250" width="3" height="4" />
          <rect x="450" y="248" width="3" height="5" />
        </g>

        {/* Pond */}
        <ellipse cx="120" cy="280" rx="48" ry="10" fill="#1f3a4a" />
        <ellipse cx="120" cy="278" rx="40" ry="6" fill="#3a6a8a" />

        {/* Tree — center-right; rendered per stage */}
        <g data-testid="tree" data-tree-stage={treeStageName} transform="translate(320, 0)">
          {/* Root flare (always present) */}
          <rect x="-12" y="232" width="24" height="8" fill="#3a2a18" />
          <rect x="-8" y="240" width="16" height="4" fill="#2e2014" />

          {/* Stage 0: seed sprout — small */}
          {stage === 0 && (
            <>
              <rect x="-2" y="220" width="4" height="20" fill="#5a3a22" />
              <ellipse cx="0" cy="216" rx="10" ry="6" fill="#3a6a3a" />
              <ellipse cx="-2" cy="214" rx="6" ry="4" fill="#5a8a4a" />
            </>
          )}

          {/* Stage 1: sapling — mid */}
          {stage === 1 && (
            <>
              <rect x="-3" y="190" width="6" height="50" fill="#5a3a22" />
              <rect x="-3" y="200" width="6" height="2" fill="#3a2a18" />
              <rect x="-3" y="220" width="6" height="2" fill="#3a2a18" />
              {/* Two side branches */}
              <rect x="-12" y="200" width="9" height="3" fill="#5a3a22" />
              <rect x="3" y="208" width="9" height="3" fill="#5a3a22" />
              {/* 4-layer canopy */}
              <ellipse cx="0" cy="180" rx="30" ry="20" fill="#1a3a1a" />
              <ellipse cx="-2" cy="176" rx="24" ry="16" fill="#3a6a3a" />
              <ellipse cx="-2" cy="172" rx="18" ry="12" fill="#5a8a4a" />
              <ellipse cx="2" cy="170" rx="6" ry="4" fill="#a8d68f" />
              {/* Pixel highlights */}
              <rect x="-12" y="170" width="2" height="2" fill="#a8d68f" />
              <rect x="6" y="174" width="2" height="2" fill="#a8d68f" />
            </>
          )}

          {/* Stage 2: full tree — big */}
          {stage === 2 && (
            <>
              <rect x="-5" y="160" width="10" height="80" fill="#5a3a22" />
              <rect x="-5" y="170" width="10" height="3" fill="#3a2a18" />
              <rect x="-5" y="195" width="10" height="3" fill="#3a2a18" />
              <rect x="-5" y="220" width="10" height="3" fill="#3a2a18" />
              {/* Two side branches */}
              <rect x="-20" y="170" width="15" height="4" fill="#5a3a22" />
              <rect x="5" y="180" width="15" height="4" fill="#5a3a22" />
              {/* 4-layer canopy — bigger */}
              <ellipse cx="0" cy="150" rx="50" ry="35" fill="#1a3a1a" />
              <ellipse cx="-3" cy="144" rx="42" ry="28" fill="#3a6a3a" />
              <ellipse cx="-3" cy="140" rx="32" ry="22" fill="#5a8a4a" />
              <ellipse cx="3" cy="136" rx="12" ry="8" fill="#a8d68f" />
              {/* Pixel highlights */}
              <rect x="-22" y="138" width="2" height="2" fill="#a8d68f" />
              <rect x="14" y="142" width="2" height="2" fill="#a8d68f" />
              <rect x="-2" y="128" width="2" height="2" fill="#ffffff" opacity="0.6" />
            </>
          )}
        </g>

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
