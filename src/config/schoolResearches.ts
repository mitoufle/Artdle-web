export interface SchoolResearchEffect {
  kind: string;
  value: number;
}

export interface SchoolResearch {
  id: string;
  name: string;
  durationSeconds: number;
  effects: ReadonlyArray<SchoolResearchEffect>;
}

export interface SchoolTier {
  tier: number;
  label: string;
  examCost: number;
  researches: ReadonlyArray<SchoolResearch>;
}

/**
 * Runtime school progression table. Hand-maintained by the agent who wires
 * entries from `schoolResearches.json` (the designer's working file). The
 * JSON is a user→agent communication channel; it is NOT imported here so
 * that saving in the school designer does not affect the running game.
 *
 * To add a tier/research: the user designs in `/dev/school-designer` and
 * saves the JSON. The agent reads the JSON and appends entries below,
 * adding any new effect kinds to the bonus resolvers in
 * `core/schoolMultipliers.ts` as needed.
 */
export const SCHOOL_TIERS: ReadonlyArray<SchoolTier> = [
  {
    tier: 1,
    label: "Apprentice",
    examCost: 50,
    researches: [
      { id: "color_theory_basics", name: "Color Theory Basics", durationSeconds: 18000, effects: [{ kind: "canvas_gold_pct", value: 0.6 }] },
      { id: "brushwork_basics", name: "Brushwork Basics", durationSeconds: 7200, effects: [{ kind: "canvas_gold_pct", value: 0.4 }] },
      { id: "light_and_shadow", name: "Light & Shadow", durationSeconds: 10800, effects: [{ kind: "speed_pct", value: 0.3 }] },
      { id: "closer_to_nature", name: "Closer to Nature", durationSeconds: 10800, effects: [{ kind: "+% inspiration gain", value: 0.15 }] },
      { id: "branding", name: "Branding", durationSeconds: 14400, effects: [{ kind: "+% Fame gain", value: 0.02 }] },
      { id: "quick_thinking", name: "Quick Thinking", durationSeconds: 18000, effects: [{ kind: "School Research flat reduction (mnt)", value: 10 }] },
      { id: "expensive_machinery", name: "Expensive Machinery", durationSeconds: 14400, effects: [{ kind: "Item min/max affix magnitude", value: 0.1 }] },
    ],
  },
  {
    tier: 2,
    label: "Student",
    examCost: 100,
    researches: [
      { id: "composition", name: "Composition", durationSeconds: 600, effects: [{ kind: "canvas_gold_pct", value: 0.12 }] },
      { id: "perspective", name: "Perspective", durationSeconds: 720, effects: [{ kind: "canvas_gold_pct", value: 0.1 }] },
      { id: "color_mixing", name: "Color Mixing", durationSeconds: 480, effects: [{ kind: "speed_pct", value: 0.07 }] },
    ],
  },
  {
    tier: 3,
    label: "Journeyman",
    examCost: 200,
    researches: [
      { id: "anatomy_basics", name: "Anatomy Basics", durationSeconds: 900, effects: [{ kind: "canvas_gold_pct", value: 0.15 }] },
      { id: "still_life_studies", name: "Still Life Studies", durationSeconds: 900, effects: [{ kind: "speed_pct", value: 0.12 }] },
      { id: "texture_techniques", name: "Texture Techniques", durationSeconds: 720, effects: [{ kind: "worker_xp_pct", value: 0.1 }] },
    ],
  },
  {
    tier: 4,
    label: "Master",
    examCost: 400,
    researches: [
      { id: "oil_painting", name: "Oil Painting", durationSeconds: 1200, effects: [{ kind: "canvas_gold_pct", value: 0.2 }] },
      { id: "watercolor_mastery", name: "Watercolor Mastery", durationSeconds: 1200, effects: [{ kind: "speed_pct", value: 0.15 }] },
      { id: "portrait_study", name: "Portrait Study", durationSeconds: 1500, effects: [{ kind: "worker_xp_pct", value: 0.15 }] },
    ],
  },
  {
    tier: 5,
    label: "Expert",
    examCost: 800,
    researches: [
      { id: "master_composition", name: "Master Composition", durationSeconds: 1800, effects: [{ kind: "canvas_gold_pct", value: 0.25 }] },
      { id: "advanced_technique", name: "Advanced Technique", durationSeconds: 1800, effects: [{ kind: "speed_pct", value: 0.2 }] },
      { id: "studio_discipline", name: "Studio Discipline", durationSeconds: 2400, effects: [{ kind: "worker_xp_pct", value: 0.2 }] },
    ],
  },
];

/** The research config for an id across all tiers, or null if unknown. */
export function getResearchById(id: string): SchoolResearch | null {
  for (const tier of SCHOOL_TIERS) {
    const r = tier.researches.find((res) => res.id === id);
    if (r) return r;
  }
  return null;
}

/** Display name for a research id across all tiers, or the id itself if unknown. */
export function getResearchName(id: string): string {
  return getResearchById(id)?.name ?? id;
}
