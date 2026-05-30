/** Node identifier. String — typo protection is sacrificed for data-driven config. */
export type SkillNodeId = string;

export type StackingMode = "additive" | "multiplicative";
export type NodeKind = "minor" | "major";

export interface SkillNodeConfig {
  readonly id: SkillNodeId;
  /** Which constellation cluster this node belongs to. See skillClusters.ts. */
  readonly clusterId: string;
  readonly name: string;
  readonly description: string;
  /** Free-form effect text, e.g. "+10% gold per level". Player-facing. */
  readonly numericEffect: string;
  /** Parent node IDs. Empty array = root (child of FAME hub). */
  readonly parentIds: ReadonlyArray<SkillNodeId>;
  /** Per-level costs in fame. `costs.length === maxLevel`. */
  readonly costs: ReadonlyArray<number>;
  readonly maxLevel: number;
  readonly stacking: StackingMode;
  /** Visual prominence on the constellation. Major nodes render bigger + brighter. */
  readonly kind: NodeKind;
  /**
   * Generic capability tags granted by this node when purchased at level ≥ 1.
   * Engine reads these to decouple node IDs from recognized capabilities.
   * Example: ["canvas_crit"] unlocks the crit track regardless of this node's ID.
   * Empty array means no capability tags.
   */
  readonly unlocks: ReadonlyArray<string>;
}

/**
 * Runtime skill-tree node table. Hand-maintained by the agent who wires
 * entries from `skillTreeDesign.json` (the designer's working file). The
 * JSON is a user→agent communication channel; it is NOT imported here so
 * that saving in the skill designer does not affect the running game.
 *
 * To add a node: the user designs in `/dev/skill-designer` and saves the
 * JSON. The agent reads the JSON, ensures any `unlocks` capability tags are
 * recognized by the engine (e.g. via `core/multipliers.ts`), and appends
 * the node entry below. The `position` field stored in the JSON is for
 * designer canvas layout only and is not part of the runtime shape.
 */
export const SKILL_NODES: ReadonlyArray<SkillNodeConfig> = [
  { id: "get_inspired", clusterId: "inspiration", name: "Get Inspired", description: "each level increase inspiration gain", numericEffect: "50%", parentIds: [], stacking: "additive", kind: "minor", maxLevel: 5, costs: [1, 2, 3, 5, 8], unlocks: [] },
  { id: "black_white", clusterId: "colors", name: "Black & White", description: "increases canvas sell price", numericEffect: "50%", parentIds: [], stacking: "additive", kind: "minor", maxLevel: 1, costs: [3], unlocks: [] },
  { id: "magenta", clusterId: "colors", name: "Magenta", description: "increases canvas sell price", numericEffect: "80%", parentIds: ["black_white"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [8], unlocks: [] },
  { id: "cyan", clusterId: "colors", name: "Cyan", description: "increases canvas sell price", numericEffect: "80%", parentIds: ["black_white"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [8], unlocks: [] },
  { id: "yellow", clusterId: "colors", name: "Yellow", description: "increases canvas sell price", numericEffect: "80%", parentIds: ["black_white"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [8], unlocks: [] },
  { id: "red", clusterId: "colors", name: "Red", description: "increases canvas sell price", numericEffect: "130%", parentIds: ["magenta", "yellow"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [20], unlocks: [] },
  { id: "green", clusterId: "colors", name: "Green", description: "increases canvas sell price", numericEffect: "130%", parentIds: ["yellow", "cyan"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [20], unlocks: [] },
  { id: "blue", clusterId: "colors", name: "Blue", description: "increases canvas sell price", numericEffect: "130%", parentIds: ["cyan", "magenta"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [20], unlocks: [] },
  { id: "purple", clusterId: "colors", name: "Purple", description: "increases canvas sell price", numericEffect: "200%", parentIds: ["blue", "red"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "brown", clusterId: "colors", name: "Brown", description: "increases canvas sell price", numericEffect: "200%", parentIds: ["green", "blue"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "orange", clusterId: "colors", name: "Orange", description: "increases canvas sell price", numericEffect: "200%", parentIds: ["red", "green"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "rainbow", clusterId: "colors", name: "Rainbow", description: "increases canvas sell price", numericEffect: "500%", parentIds: ["orange", "brown", "purple"], stacking: "multiplicative", kind: "major", maxLevel: 1, costs: [150], unlocks: [] },
  { id: "poke_tree", clusterId: "inspiration", name: "Poke the Tree", description: "Get 100 inspiration every 10 secondes.\nEach level doubles it", numericEffect: "100", parentIds: ["get_inspired"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [3, 5, 8, 12, 20], unlocks: [] },
  { id: "basic_technique", clusterId: "workshop", name: "Basic Technique", description: "Each level makes canvas painting 10% faster.", numericEffect: "10%", parentIds: [], stacking: "additive", kind: "minor", maxLevel: 5, costs: [1, 2, 3, 4, 5], unlocks: [] },
  { id: "muscle_memory", clusterId: "workshop", name: "Muscle Memory", description: "Each level makes canvas painting 10% faster.", numericEffect: "10%", parentIds: ["basic_technique"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [3, 5, 8, 12, 20], unlocks: [] },
  { id: "gear_up", clusterId: "workshop", name: "Gear Up", description: "Unlocks a second equipment slot for palette items.", numericEffect: "+1 palette slot", parentIds: ["muscle_memory"], stacking: "additive", kind: "major", maxLevel: 1, costs: [15], unlocks: [] },
  { id: "Bargain", clusterId: "inspiration", name: "Bargain", description: "Each level decreases inspiration tree upgrade cost by 5%", numericEffect: "5%", parentIds: ["get_inspired"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [3, 5, 8, 12, 20], unlocks: [] },
  { id: "craftsmanship", clusterId: "workshop", name: "Craftsmanship", description: "Each level add %5 to min and max item rollable affix magnitude.", numericEffect: "5%", parentIds: ["gear_up"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [20, 35, 60, 100, 160], unlocks: [] },
  { id: "wooden_chest", clusterId: "workshop", name: "Wooden Chest", description: "adds 2 item storage slots", numericEffect: "2", parentIds: ["craftsmanship"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "shredder", clusterId: "workshop", name: "shredder", description: "you can craft when inventory is full, it will destroy the oldest crafted item inside.", numericEffect: "1", parentIds: ["craftsmanship"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "taylorsim", clusterId: "workshop", name: "Taylorism", description: "Autocraft a free Item every 10s.", numericEffect: "1", parentIds: ["shredder"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [120], unlocks: [] },
  { id: "steel_chest", clusterId: "workshop", name: "Steel Chest", description: "adds 2 item storage slots", numericEffect: "2", parentIds: ["wooden_chest"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [120], unlocks: [] },
  { id: "forget_pain", clusterId: "workshop", name: "Forget your back pain", description: "Unlock Easel item slot", numericEffect: "1", parentIds: ["steel_chest", "taylorsim"], stacking: "additive", kind: "major", maxLevel: 1, costs: [300], unlocks: [] },
  { id: "painters_hat", clusterId: "workshop", name: "Enjoyable Shade", description: "Unlock the Hat equipment slot.", numericEffect: "+1 hat slot", parentIds: ["painters_apron"], stacking: "additive", kind: "major", maxLevel: 1, costs: [10000], unlocks: [] },
  { id: "painters_apron", clusterId: "workshop", name: "No More Stains", description: "Unlock the Apron equipment slot.", numericEffect: "+1 apron slot", parentIds: ["socks", "better_scaling"], stacking: "additive", kind: "major", maxLevel: 1, costs: [6000], unlocks: [] },
  { id: "monk_internship", clusterId: "workshop", name: "Monk Internship", description: "increases #% min/max affixes magnitude", numericEffect: "10", parentIds: ["forget_pain"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [700], unlocks: [] },
  { id: "entrepreneur", clusterId: "office", name: "Entrepreneur", description: "unlocks the Worker Office tab ", numericEffect: "1", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [700], unlocks: ["roster_slot"] },
  { id: "genius_episode", clusterId: "crit", name: "Genius Episode", description: "unlocks Critical upgrade for your canvas (and associated affixes)", numericEffect: "1", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [10], unlocks: ["canvas_crit"] },
  { id: "consistency", clusterId: "crit", name: "Consistency", description: "increases crit chance by 1%", numericEffect: "1", parentIds: ["genius_episode"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [20, 35, 60, 100, 160], unlocks: ["crit_chance"] },
  { id: "fast_learner", clusterId: "crit", name: "Fast Learner", description: "each canvas upgrade is 2% more effective", numericEffect: "2", parentIds: ["consistency"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [50, 100, 200, 350, 600], unlocks: [] },
  { id: "unrelentless", clusterId: "combo", name: "unrelentless", description: "unlocks Combo upgrade for your canvas (and associated affixes)", numericEffect: "1", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [150], unlocks: ["canvas_combo"] },
  { id: "hire_manager", clusterId: "office", name: "Hire Manager", description: "Each level adds +1 roster slot for hired workers.", numericEffect: "+1", parentIds: ["entrepreneur"], stacking: "additive", kind: "minor", maxLevel: 4, costs: [4500, 6000, 8000, 10000], unlocks: ["roster_slot"] },
  { id: "accelerator", clusterId: "office", name: "Accelerator Program", description: "Each level boosts the worker ascend-XP pool by +10%.", numericEffect: "10%", parentIds: ["entrepreneur"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [4500, 6000, 7500, 9000, 10000], unlocks: ["worker_xp_mult"] },
  { id: "afterburner", clusterId: "combo", name: "Afterburner", description: "Each level reduces combo decay by 1 percentage point per chain link.", numericEffect: "-1pp", parentIds: ["unrelentless"], stacking: "additive", kind: "minor", maxLevel: 4, costs: [300, 500, 800, 1200], unlocks: ["combo_decay_reduction"] },
  { id: "enlightenment", clusterId: "inspiration", name: "Enlightenment", description: "Each level reduces the inspiration needed to ascend by 5%.", numericEffect: "-5%", parentIds: ["Bargain"], stacking: "additive", kind: "minor", maxLevel: 4, costs: [8, 15, 25, 40], unlocks: ["ascend_threshold_reduction"] },
  { id: "patron", clusterId: "inspiration", name: "Patron", description: "Each level boosts inspiration gain by +10% (stacks with Get Inspired).", numericEffect: "10%", parentIds: ["poke_tree"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [8, 15, 25, 40, 60], unlocks: ["inspi_mult_bonus"] },
  { id: "third_hand", clusterId: "workshop", name: "Third Hand", description: "reduces the time for autocraft by #% ", numericEffect: "10", parentIds: ["forget_pain"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [600, 900, 1400, 2000, 3000], unlocks: [] },
  { id: "painters_boots", clusterId: "workshop", name: "Warm Feet", description: "unlocks the boot Item slot", numericEffect: "+1 boots slot", parentIds: ["monk_internship", "third_hand"], stacking: "additive", kind: "major", maxLevel: 1, costs: [1500], unlocks: [] },
  { id: "better_scaling", clusterId: "workshop", name: "Better Scaling", description: "for each workshop level, give +# to min and max item affix magnitude ", numericEffect: "1", parentIds: ["painters_boots"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [3500], unlocks: [] },
  { id: "socks", clusterId: "workshop", name: "Socks", description: "equiped boots get +#% efficency.", numericEffect: "50", parentIds: ["painters_boots"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [3500], unlocks: [] },
  { id: "unlock_school", clusterId: "school", name: "Painting School", description: "Unlocks the Painting School — research permanent bonuses one at a time.", numericEffect: "", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [25000], unlocks: ["school_access"] },
  { id: "ma_specialist", clusterId: "workshop", name: "M&A specialist", description: "You can now merge epic and legendary items with other items of the same tier even if they don't share the same affixes type. Affixes outcome will be randomized.", numericEffect: "", parentIds: ["better_scaling"], stacking: "additive", kind: "major", maxLevel: 1, costs: [10000], unlocks: ["cross_affix_fusion"] },
  { id: "quantitative_easing", clusterId: "workshop", name: "Quantitative easing", description: "Each level halves the price of merging items.", numericEffect: "×0.5", parentIds: ["ma_specialist"], stacking: "multiplicative", kind: "minor", maxLevel: 5, costs: [15000, 20000, 25000, 30000, 35000], unlocks: ["fuse_cost_halving"] },
  { id: "expert_manufacture", clusterId: "workshop", name: "Expert manufacture", description: "Each level increases the min and max item affix magnitude by 25%.", numericEffect: "25%", parentIds: ["ma_specialist"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [20000, 20000, 20000, 20000, 20000], unlocks: ["affix_magnitude_pct"] },
];

/** Lookup helper. Returns null if id unknown. */
export function getSkillNodeConfig(id: SkillNodeId): SkillNodeConfig | null {
  return SKILL_NODES.find((n) => n.id === id) ?? null;
}
