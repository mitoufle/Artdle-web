export interface AchievementCondition {
  stat: string;
  op: ">=" | ">" | "==" | "<=" | "<";
  value: number;
}

export interface AchievementEffect {
  kind: string;
  value: number;
}

export type AchievementCategory =
  | "canvas"
  | "workshop"
  | "ascension"
  | "school_office"
  | "secret"
  | "inspiration";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  condition: AchievementCondition;
  effects: ReadonlyArray<AchievementEffect>;
}

/**
 * Runtime achievement table. Hand-maintained by the agent who wires entries
 * from `achievementsDesign.json` (the designer's working file). The JSON is a
 * user→agent communication channel; it is NOT imported here so that saving
 * in the achievement designer does not affect the running game.
 *
 * To add an achievement: the user crafts the shell in `/dev/achievement-
 * designer` and saves to JSON. The agent reads the JSON, translates the
 * description's intent into a structured condition + effects, adds any
 * needed synthetic stat resolver to `achievementSlice.ts`, and appends the
 * entry below.
 */
export const ACHIEVEMENTS: ReadonlyArray<Achievement> = [
  {
    id: "Sound_Blasting",
    name: "Sound Blasting",
    description: "increase inspiration gain when the player set the sound to 100/100 level",
    icon: "🔊",
    category: "secret",
    condition: { stat: "audio.musicVolumePct", op: ">=", value: 100 },
    effects: [{ kind: "inspi_pct", value: 0.1 }],
  },
  {
    id: "Piggy_bank",
    name: "Piggy Bank",
    description: "Increases gold gain when player reaches 1K lifetime gold acquired",
    icon: "🐽",
    category: "canvas",
    condition: { stat: "lifetime.goldgain", op: ">=", value: 1000 },
    effects: [{ kind: "canvas_gold_pct", value: 0.15 }],
  },
  {
    id: "Millionaire",
    name: "Millionaire",
    description: "Increases gold gain when player reaches 1M lifetime gold acquired",
    icon: "💰",
    category: "canvas",
    condition: { stat: "lifetime.goldgain", op: ">=", value: 1_000_000 },
    effects: [{ kind: "canvas_gold_pct", value: 0.2 }],
  },
  {
    id: "Nerbard_alnaurt",
    name: "Nerbard Alnaurt",
    description: "Increases gold gain when player reaches 1B lifetime gold acquired",
    icon: "🤑",
    category: "canvas",
    condition: { stat: "lifetime.goldgain", op: ">=", value: 1_000_000_000 },
    effects: [{ kind: "canvas_gold_pct", value: 0.25 }],
  },
  {
    id: "Trillionaire",
    name: "Trillionaire",
    description: "Increases gold gain when player reaches 1T lifetime gold acquired",
    icon: "💵",
    category: "canvas",
    condition: { stat: "lifetime.goldgain", op: ">=", value: 1e12 },
    effects: [{ kind: "canvas_gold_pct", value: 0.3 }],
  },
  {
    id: "Quadrillionaire",
    name: "Quadrillionaire",
    description: "Increases gold gain when player reaches 1Qa lifetime gold acquired",
    icon: "💴",
    category: "canvas",
    condition: { stat: "lifetime.goldgain", op: ">=", value: 1e15 },
    effects: [{ kind: "canvas_gold_pct", value: 0.35 }],
  },
  {
    id: "Quintillionaire",
    name: "Quintillionaire",
    description: "Increases gold gain when player reaches 1Qi lifetime gold acquired",
    icon: "💶",
    category: "canvas",
    condition: { stat: "lifetime.goldgain", op: ">=", value: 1e18 },
    effects: [{ kind: "canvas_gold_pct", value: 0.4 }],
  },
  {
    id: "Sextillionaire",
    name: "Sextillionaire",
    description: "Increases gold gain when player reaches 1Sx lifetime gold acquired",
    icon: "💷",
    category: "canvas",
    condition: { stat: "lifetime.goldgain", op: ">=", value: 1e21 },
    effects: [{ kind: "canvas_gold_pct", value: 0.45 }],
  },
  {
    id: "Septillionaire",
    name: "Septillionaire",
    description: "Increases gold gain when player reaches 1Sp lifetime gold acquired",
    icon: "🪙",
    category: "canvas",
    condition: { stat: "lifetime.goldgain", op: ">=", value: 1e24 },
    effects: [{ kind: "canvas_gold_pct", value: 0.5 }],
  },
  {
    id: "Octillionaire",
    name: "Octillionaire",
    description: "Increases gold gain when player reaches 1Oc lifetime gold acquired",
    icon: "🏦",
    category: "canvas",
    condition: { stat: "lifetime.goldgain", op: ">=", value: 1e27 },
    effects: [{ kind: "canvas_gold_pct", value: 0.55 }],
  },
  {
    id: "Psychedelic_enjoyer",
    name: "Psychedelic Enjoyer",
    description: "Increases inspiration gain when player reaches 1K lifetime inspiration acquired",
    icon: "🌿",
    category: "inspiration",
    condition: { stat: "lifetime.inspirationgain", op: ">=", value: 1000 },
    effects: [{ kind: "inspi_pct", value: 0.15 }],
  },
  {
    id: "T2",
    name: "Tier 2",
    description: "increases gold gain upon reaching Tier 2 Tree",
    icon: "2️⃣",
    category: "inspiration",
    condition: { stat: "tree.tier", op: ">=", value: 2 },
    effects: [{ kind: "canvas_gold_pct", value: 1 }],
  },
  {
    id: "T3",
    name: "Tier 3",
    description: "increases gold gain upon reaching Tier 3 Tree",
    icon: "3️⃣",
    category: "inspiration",
    condition: { stat: "tree.tier", op: ">=", value: 3 },
    effects: [{ kind: "canvas_gold_pct", value: 1 }],
  },
  {
    id: "T4",
    name: "Tier 4",
    description: "increases gold gain upon reaching Tier 4 Tree",
    icon: "4️⃣",
    category: "inspiration",
    condition: { stat: "tree.tier", op: ">=", value: 4 },
    effects: [{ kind: "canvas_gold_pct", value: 1 }],
  },
  {
    id: "T5",
    name: "Tier 5",
    description: "increases gold gain upon reaching Tier 5 Tree",
    icon: "5️⃣",
    category: "inspiration",
    condition: { stat: "tree.tier", op: ">=", value: 5 },
    effects: [{ kind: "canvas_gold_pct", value: 1 }],
  },
  {
    id: "T6",
    name: "Tier 6",
    description: "increases gold gain upon reaching Tier 6 Tree",
    icon: "6️⃣",
    category: "inspiration",
    condition: { stat: "tree.tier", op: ">=", value: 6 },
    effects: [{ kind: "canvas_gold_pct", value: 1 }],
  },
  {
    id: "T7",
    name: "Tier 7",
    description: "increases gold gain upon reaching Tier 7 Tree",
    icon: "7️⃣",
    category: "inspiration",
    condition: { stat: "tree.tier", op: ">=", value: 7 },
    effects: [{ kind: "canvas_gold_pct", value: 1 }],
  },
  {
    id: "T8",
    name: "Tier 8",
    description: "increases gold gain upon reaching Tier 8 Tree",
    icon: "8️⃣",
    category: "inspiration",
    condition: { stat: "tree.tier", op: ">=", value: 8 },
    effects: [{ kind: "canvas_gold_pct", value: 1 }],
  },
  {
    id: "T9",
    name: "Tier 9",
    description: "increases gold gain upon reaching Tier 9 Tree",
    icon: "9️⃣",
    category: "inspiration",
    condition: { stat: "tree.tier", op: ">=", value: 9 },
    effects: [{ kind: "canvas_gold_pct", value: 1 }],
  },
  {
    id: "T10",
    name: "Tier 10",
    description: "increases gold gain upon reaching Tier 10 Tree",
    icon: "🔟",
    category: "inspiration",
    condition: { stat: "tree.tier", op: ">=", value: 10 },
    effects: [{ kind: "canvas_gold_pct", value: 1 }],
  },
  {
    id: "Rising_star",
    name: "Rising Star",
    description: "Increases canvas speed when player reaches 1000 lifetime canvases sold",
    icon: "✨",
    category: "canvas",
    condition: { stat: "lifetime.canvasesSold", op: ">=", value: 1000 },
    effects: [{ kind: "speed_pct", value: 0.2 }],
  },
  // ── Ascension tab (2026-05-31 designer submission) ──────────────────────
  {
    id: "Portaled",
    name: "Portaled",
    description: "Gain 10 Fame upon performing the first ascend.",
    icon: "🚪",
    category: "ascension",
    // `lifetime.ascend` resolves to ascendCount (see achievementSlice resolver).
    condition: { stat: "lifetime.ascend", op: ">=", value: 1 },
    // One-time reward: fame_flat_gain is credited once on unlock, not a passive multiplier.
    effects: [{ kind: "fame_flat_gain", value: 10 }],
  },
  {
    id: "Spotlight",
    name: "Spotlight",
    description: "+10% Fame gained on ascend, after spending 1000 Fame.",
    icon: "🔦",
    category: "ascension",
    condition: { stat: "lifetime.fameSpent", op: ">=", value: 1000 },
    // ascend_fame_pct stacks additively with the Royalties node in getAscendFameMultiplier.
    effects: [{ kind: "ascend_fame_pct", value: 0.1 }],
  },
  // ── Secret triggers (synthetic stats incremented by event handlers) ─────
  {
    id: "Random_clicker",
    name: "Random Clicker",
    description: "Increases gold gain — found by clicking the top-left Artdle logo.",
    icon: "👆",
    category: "secret",
    condition: { stat: "lifetime.logoClicks", op: ">=", value: 1 },
    effects: [{ kind: "canvas_gold_pct", value: 0.15 }],
  },
  {
    id: "Pay_respect",
    name: "Pay Respect",
    description: "Increases inspiration gain — found by pressing F.",
    icon: "⭐",
    category: "secret",
    condition: { stat: "lifetime.fPresses", op: ">=", value: 1 },
    effects: [{ kind: "inspi_pct", value: 0.1 }],
  },
];
