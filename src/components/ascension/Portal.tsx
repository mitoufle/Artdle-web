import type { JSX } from "react";
import styles from "./Portal.module.css";

/**
 * Animated stone-arch portal. ~380px wide on a typical screen (sized by parent).
 * Outer arch: bricked stone gradient + thin dark joint lines.
 * Inside: radial lavender→violet→black glow + keystone with gold ✦ rune.
 * 6 purple runes flank L/R (3 each). Whole block animates `float` (±6px Y, 6s
 * ease) + `shimmer` (drop-shadow pulse, 4s ease).
 */
export function Portal(): JSX.Element {
  // Position the 6 flanking runes (3 left, 3 right of the arch).
  const RUNES: ReadonlyArray<{ x: number; y: number }> = [
    { x: 30,  y: 100 },
    { x: 30,  y: 170 },
    { x: 30,  y: 240 },
    { x: 350, y: 100 },
    { x: 350, y: 170 },
    { x: 350, y: 240 },
  ];

  return (
    <div className={styles.portalWrap}>
      <svg
        viewBox="0 0 380 360"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.portal}
        aria-label="Stone arch portal"
      >
        <defs>
          <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5a2855" />
            <stop offset="1" stopColor="#2a1238" />
          </linearGradient>
          <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0"   stopColor="#c9b8ff" />
            <stop offset="0.5" stopColor="#6b4cb8" />
            <stop offset="1"   stopColor="#0a0814" />
          </radialGradient>
        </defs>

        {/* Outer arch — rectangle base + half-circle top, all in stone gradient */}
        <path
          d="M 70,340 L 70,150 A 120,120 0 0 1 310,150 L 310,340 Z"
          fill="url(#stone)"
        />

        {/* Stone-joint lines (decorative thin dark strokes) */}
        <g stroke="#1a0822" strokeWidth="1.5" fill="none" opacity="0.7">
          <line x1="70"  y1="200" x2="310" y2="200" />
          <line x1="70"  y1="260" x2="310" y2="260" />
          <line x1="190" y1="150" x2="190" y2="340" />
          <line x1="130" y1="200" x2="130" y2="340" />
          <line x1="250" y1="200" x2="250" y2="340" />
        </g>

        {/* Inner radial glow circle */}
        <ellipse
          cx="190"
          cy="190"
          rx="100"
          ry="120"
          fill="url(#glow)"
          data-testid="portal-glow"
        />

        {/* Keystone at top with gold ✦ rune */}
        <g data-testid="portal-keystone">
          <rect x="180" y="100" width="20" height="32" fill="#3a2e5a" stroke="#a87f3a" strokeWidth="1.5" />
          <text
            x="190" y="124"
            textAnchor="middle"
            fontSize="14"
            fill="#e6b667"
            fontFamily="serif"
            style={{ filter: "drop-shadow(0 0 4px rgba(230,182,103,0.6))" }}
          >
            ✦
          </text>
        </g>

        {/* 6 flanking purple runes */}
        <g>
          {RUNES.map((r, idx) => (
            <text
              key={idx}
              x={r.x} y={r.y}
              textAnchor="middle"
              fontSize="18"
              fill="#9b6cd6"
              fontFamily="serif"
              data-testid="portal-rune"
              style={{ filter: "drop-shadow(0 0 4px rgba(155,108,214,0.5))" }}
            >
              ✦
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}
