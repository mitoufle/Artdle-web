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
    id: "Rising_star",
    name: "Rising Star",
    description: "Increases canvas speed when player reaches 1000 lifetime canvases sold",
    icon: "✨",
    category: "canvas",
    condition: { stat: "lifetime.canvasesSold", op: ">=", value: 1000 },
    effects: [{ kind: "speed_pct", value: 0.2 }],
  },
];
