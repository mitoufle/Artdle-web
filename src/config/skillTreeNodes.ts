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
  /** Parent node IDs. Empty array = the cluster's root (no prerequisite). */
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
  { id: "get_inspired", clusterId: "inspiration", name: "Get Inspired", description: "each level increases inspiration gain by +20%", numericEffect: "20%", parentIds: [], stacking: "additive", kind: "major", maxLevel: 5, costs: [1, 2, 3, 4, 5], unlocks: [] },
  { id: "black_white", clusterId: "colors", name: "Black & White", description: "increases canvas sell price", numericEffect: "50%", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [3], unlocks: [] },
  { id: "magenta", clusterId: "colors", name: "Magenta", description: "increases canvas sell price", numericEffect: "80%", parentIds: ["black_white"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [8], unlocks: [] },
  { id: "cyan", clusterId: "colors", name: "Cyan", description: "increases canvas sell price", numericEffect: "80%", parentIds: ["black_white"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [8], unlocks: [] },
  { id: "yellow", clusterId: "colors", name: "Yellow", description: "increases canvas sell price", numericEffect: "80%", parentIds: ["black_white"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [8], unlocks: [] },
  { id: "red", clusterId: "colors", name: "Red", description: "increases canvas sell price", numericEffect: "130%", parentIds: ["magenta"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [20], unlocks: [] },
  { id: "green", clusterId: "colors", name: "Green", description: "increases canvas sell price", numericEffect: "130%", parentIds: ["yellow"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [20], unlocks: [] },
  { id: "blue", clusterId: "colors", name: "Blue", description: "increases canvas sell price", numericEffect: "130%", parentIds: ["cyan"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [20], unlocks: [] },
  { id: "purple", clusterId: "colors", name: "Purple", description: "increases canvas sell price", numericEffect: "200%", parentIds: ["blue"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "brown", clusterId: "colors", name: "Brown", description: "increases canvas sell price", numericEffect: "200%", parentIds: ["green"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "orange", clusterId: "colors", name: "Orange", description: "increases canvas sell price", numericEffect: "200%", parentIds: ["red"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "rainbow", clusterId: "colors", name: "Rainbow", description: "increases canvas sell price", numericEffect: "500%", parentIds: ["orange", "brown", "purple"], stacking: "multiplicative", kind: "major", maxLevel: 1, costs: [150], unlocks: [] },
  { id: "poke_tree", clusterId: "inspiration", name: "Poke the Tree", description: "Get 100 inspiration every 10 secondes.\nEach level doubles it", numericEffect: "100", parentIds: ["get_inspired"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [3, 5, 8, 12, 20], unlocks: [] },
  { id: "basic_technique", clusterId: "workshop", name: "Basic Technique", description: "Each level makes canvas painting 5% faster.", numericEffect: "5%", parentIds: [], stacking: "additive", kind: "minor", maxLevel: 5, costs: [1, 2, 3, 4, 5], unlocks: [] },
  { id: "muscle_memory", clusterId: "workshop", name: "Muscle Memory", description: "Each level makes canvas painting 5% faster.", numericEffect: "5%", parentIds: ["basic_technique"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [3, 5, 8, 12, 20], unlocks: [] },
  { id: "gear_up", clusterId: "workshop", name: "Gear Up", description: "Unlocks a second equipment slot for palette items.", numericEffect: "+1 palette slot", parentIds: ["muscle_memory"], stacking: "additive", kind: "major", maxLevel: 1, costs: [15], unlocks: [] },
  { id: "Bargain", clusterId: "inspiration", name: "Bargain", description: "Each level decreases inspiration tree upgrade cost by 5%", numericEffect: "5%", parentIds: ["get_inspired"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [3, 5, 8, 12, 20], unlocks: [] },
  { id: "craftsmanship", clusterId: "workshop", name: "Craftsmanship", description: "Each level add %5 to min and max item rollable affix magnitude.", numericEffect: "5%", parentIds: ["gear_up"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [20, 35, 60, 100, 160], unlocks: [] },
  { id: "wooden_chest", clusterId: "workshop", name: "Wooden Chest", description: "adds 2 item storage slots", numericEffect: "2", parentIds: ["craftsmanship"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "shredder", clusterId: "workshop", name: "shredder", description: "you can craft when inventory is full, it will destroy the oldest crafted item inside.", numericEffect: "1", parentIds: ["craftsmanship"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "taylorsim", clusterId: "workshop", name: "Taylorism", description: "Autocraft a free Item every 10s.", numericEffect: "1", parentIds: ["shredder"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [120], unlocks: [] },
  { id: "steel_chest", clusterId: "workshop", name: "Steel Chest", description: "adds 2 item storage slots", numericEffect: "2", parentIds: ["wooden_chest"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [120], unlocks: [] },
  { id: "forget_pain", clusterId: "workshop", name: "Forget your back pain", description: "Unlock Easel item slot", numericEffect: "1", parentIds: ["steel_chest", "taylorsim"], stacking: "additive", kind: "major", maxLevel: 1, costs: [300], unlocks: [] },
  { id: "painters_hat", clusterId: "workshop", name: "Enjoyable Shade", description: "Unlock the Hat equipment slot.", numericEffect: "+1 hat slot", parentIds: ["socks", "quantitative_easing"], stacking: "additive", kind: "major", maxLevel: 1, costs: [10000], unlocks: [] },
  { id: "painters_apron", clusterId: "workshop", name: "No More Stains", description: "Unlock the Apron equipment slot.", numericEffect: "+1 apron slot", parentIds: ["painters_boots", "ma_specialist", "painters_hat"], stacking: "additive", kind: "major", maxLevel: 1, costs: [6000], unlocks: [] },
  { id: "monk_internship", clusterId: "workshop", name: "Monk Internship", description: "increases #% min/max affixes magnitude", numericEffect: "10", parentIds: ["taylorsim"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [700], unlocks: [] },
  { id: "entrepreneur", clusterId: "office", name: "Entrepreneur", description: "unlocks the Worker Office tab and the first worker slot", numericEffect: "1", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [700], unlocks: ["roster_slot"] },
  { id: "genius_episode", clusterId: "crit", name: "Genius Episode", description: "unlocks Critical upgrade for your canvas (and associated affixes)", numericEffect: "1", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [10], unlocks: ["canvas_crit"] },
  { id: "consistency", clusterId: "crit", name: "Consistency", description: "increases crit chance by 1%", numericEffect: "1", parentIds: ["genius_episode"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [20, 35, 60, 100, 160], unlocks: ["crit_chance"] },
  { id: "unrelentless", clusterId: "combo", name: "unrelentless", description: "unlocks Combo upgrade for your canvas (and associated affixes)", numericEffect: "1", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [150], unlocks: ["canvas_combo"] },
  { id: "hire_manager", clusterId: "office", name: "Hire Manager", description: "unlock an additional worker slot", numericEffect: "1", parentIds: ["robin_hood"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [7000], unlocks: ["roster_slot"] },
  // ── Office worker-progression nodes (2026-06-01 design submission). These
  //    boost every worker's base stats / XP curve; wiring lives in
  //    multipliers (getWorkerBaseStatBonuses) + officeSlice (getWorkerXpGrowth).
  { id: "food_regulation", clusterId: "office", name: "Food regulation", description: "workers gain +1 to every base stat (+1% crit chance).", numericEffect: "1", parentIds: ["entrepreneur"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [1200], unlocks: ["worker_food_regulation"] },
  { id: "robin_hood", clusterId: "office", name: "Robin Hood", description: "workers gain +7% Gold base stat per level.", numericEffect: "7%", parentIds: ["food_regulation"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [5000, 7500, 10000, 15000, 20000], unlocks: ["worker_goldpct_base"] },
  { id: "blury_hand", clusterId: "office", name: "Blurry Hand", description: "workers gain +10% stroke speed base stat.", numericEffect: "10%", parentIds: ["entrepreneur"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [7500], unlocks: ["worker_speed_base"] },
  { id: "handcrafted_brush", clusterId: "office", name: "Handcrafted Brush", description: "workers gain +3% stroke speed base stat per level.", numericEffect: "3%", parentIds: ["hire_manager"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [10000, 15000, 20000, 25000, 35000], unlocks: ["worker_speed_per_level"] },
  { id: "learning_curve", clusterId: "office", name: "Learning Curve", description: "lowers the worker XP ramp-per-level by 0.05 (flatter leveling curve).", numericEffect: "0.05", parentIds: ["accelerator"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [6000], unlocks: ["worker_xp_growth_reduction"] },
  // employer_branding + sp500 grant roster slots; ai_freelancer / work_ethic are
  // worker-progression nodes (XP on canvas completion / +10% ascend XP). The
  // new_node_* entries are inert authored placeholders (no effect yet).
  { id: "employer_branding", clusterId: "office", name: "Employer Branding", description: "unlock an additional worker slot", numericEffect: "1", parentIds: ["learning_curve"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [15000], unlocks: ["roster_slot"] },
  { id: "ai_freelancer", clusterId: "office", name: "AI Driven Freelancer", description: "workers bank +5 XP each time a canvas is completed.", numericEffect: "5", parentIds: ["hire_manager"], stacking: "additive", kind: "major", maxLevel: 1, costs: [300000], unlocks: ["worker_xp_on_canvas"] },
  { id: "work_ethic", clusterId: "office", name: "Work Ethic", description: "+10% to the worker ascend-XP pool.", numericEffect: "10%", parentIds: ["employer_branding"], stacking: "additive", kind: "major", maxLevel: 1, costs: [200000], unlocks: ["worker_xp_mult"] },
  { id: "sp500", clusterId: "office", name: "SP500", description: "unlock an additional worker slot", numericEffect: "1", parentIds: ["work_ethic", "ai_freelancer"], stacking: "additive", kind: "major", maxLevel: 1, costs: [450000], unlocks: ["roster_slot"] },
  { id: "new_node_11", clusterId: "office", name: "New Node", description: "", numericEffect: "", parentIds: ["hire_manager"], stacking: "additive", kind: "major", maxLevel: 1, costs: [0], unlocks: [] },
  { id: "new_node_12", clusterId: "office", name: "New Node", description: "", numericEffect: "", parentIds: ["employer_branding"], stacking: "additive", kind: "major", maxLevel: 1, costs: [0], unlocks: [] },
  { id: "new_node_10", clusterId: "office", name: "New Node", description: "", numericEffect: "", parentIds: ["employer_branding"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [0], unlocks: [] },
  { id: "new_node_14", clusterId: "office", name: "New Node", description: "", numericEffect: "", parentIds: ["entrepreneur"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [0], unlocks: [] },
  { id: "new_node_15", clusterId: "office", name: "New Node", description: "", numericEffect: "", parentIds: ["entrepreneur"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [0], unlocks: [] },
  { id: "accelerator", clusterId: "office", name: "Accelerator Program", description: "Each level boosts the worker ascend-XP pool by +10%.", numericEffect: "10%", parentIds: ["entrepreneur"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [4500, 6000, 7500, 9000, 10000], unlocks: ["worker_xp_mult"] },
  { id: "afterburner", clusterId: "combo", name: "Afterburner", description: "Each level reduces combo decay by 1 percentage point per chain link.", numericEffect: "-1pp", parentIds: ["unrelentless"], stacking: "additive", kind: "minor", maxLevel: 4, costs: [300, 500, 800, 1200], unlocks: ["combo_decay_reduction"] },
  { id: "enlightenment", clusterId: "inspiration", name: "Enlightenment", description: "Each level grants +2% inspiration gain per equipped item.", numericEffect: "+2%", parentIds: ["get_inspired"], stacking: "additive", kind: "minor", maxLevel: 4, costs: [8, 15, 25, 40], unlocks: ["inspi_per_equipped_item"] },
  { id: "patron", clusterId: "inspiration", name: "Patron", description: "Each level boosts inspiration gain by +50% (stacks with Get Inspired).", numericEffect: "50%", parentIds: ["get_inspired"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [8, 15, 25, 40, 60], unlocks: ["inspi_mult_bonus"] },
  { id: "third_hand", clusterId: "workshop", name: "Third Hand", description: "reduces the time for autocraft by #% ", numericEffect: "10", parentIds: ["steel_chest"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [600, 900, 1400, 2000, 3000], unlocks: [] },
  { id: "painters_boots", clusterId: "workshop", name: "Warm Feet", description: "unlocks the boot Item slot", numericEffect: "+1 boots slot", parentIds: ["forget_pain"], stacking: "additive", kind: "major", maxLevel: 1, costs: [1500], unlocks: [] },
  { id: "better_scaling", clusterId: "workshop", name: "Better Scaling", description: "for each workshop level, give +# to min and max item affix magnitude ", numericEffect: "1", parentIds: ["monk_internship", "painters_boots"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [3500], unlocks: [] },
  { id: "socks", clusterId: "workshop", name: "Socks", description: "equiped boots get +#% efficency.", numericEffect: "50", parentIds: ["third_hand", "painters_boots"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [3500], unlocks: [] },
  { id: "unlock_school", clusterId: "school", name: "Painting School", description: "Unlocks the Painting School — research permanent bonuses one at a time.", numericEffect: "", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [25000], unlocks: ["school_access"] },
  { id: "ma_specialist", clusterId: "workshop", name: "M&A specialist", description: "You can now merge epic and legendary items with other items of the same tier even if they don't share the same affixes type. Affixes outcome will be randomized.", numericEffect: "", parentIds: ["better_scaling", "expert_manufacture"], stacking: "additive", kind: "major", maxLevel: 1, costs: [10000], unlocks: ["cross_affix_fusion"] },
  { id: "quantitative_easing", clusterId: "workshop", name: "Quantitative easing", description: "Each level halves the price of merging items.", numericEffect: "×0.5", parentIds: ["painters_boots"], stacking: "multiplicative", kind: "minor", maxLevel: 5, costs: [15000, 20000, 25000, 30000, 35000], unlocks: ["fuse_cost_halving"] },
  { id: "expert_manufacture", clusterId: "workshop", name: "Expert manufacture", description: "Each level increases the min and max item affix magnitude by 25%.", numericEffect: "25%", parentIds: ["painters_boots"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [20000, 20000, 20000, 20000, 20000], unlocks: ["affix_magnitude_pct"] },
  // New Inspiration nodes from the 2026-05-31 design submission. Shells only —
  // their gameplay effects (fame-on-ascend, timed inspiration buff, etc.) are
  // not wired to engine capabilities yet; unlocks intentionally empty.
  { id: "zion", clusterId: "inspiration", name: "Zion", description: "every time a tree upgrades reaches level 100, gain +10% total inspiration gain.", numericEffect: "10", parentIds: ["Bargain"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [25000], unlocks: ["zion_tree_milestone"] },
  { id: "babylon_king", clusterId: "inspiration", name: "Babylon King", description: "each level increase inspiration gain by #%", numericEffect: "100", parentIds: ["patron"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [10000, 20000, 30000, 40000, 50000], unlocks: ["babylon_inspi_bonus"] },
  { id: "muse_burst", clusterId: "inspiration", name: "Muse Burst", description: "every 100 sold canvas, grant # total inspiration gain for 42 seconds", numericEffect: "x7", parentIds: ["poke_tree"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [15000], unlocks: ["muse_burst_buff"] },
  { id: "royalties", clusterId: "inspiration", name: "Royalties", description: "increases total Fame gain upon ascending by #%", numericEffect: "70", parentIds: ["enlightenment"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [30000, 50000, 80000, 100000, 150000], unlocks: ["ascend_fame_bonus"] },
  // ── School tree expansion (2026-06-01 submission). The 9 nodes the designer
  //    left in the default "inspiration" cluster are reassigned to "school"
  //    here (and in the JSON) so the cluster stays a single connected tree.
  { id: "invest_brain", clusterId: "school", name: "Invest in brain", description: "Each level grants +10% canvas sell price per completed school research.", numericEffect: "10%", parentIds: ["unlock_school"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [50000, 75000, 100000, 150000, 200000], unlocks: ["invest_brain_sell"] },
  { id: "collaborative_research", clusterId: "school", name: "Collaborative Research #1", description: "Worker #1 also researches: every 10 strokes it lands cuts 1s off the active research.", numericEffect: "1", parentIds: ["unlock_school"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [80000], unlocks: ["collaborative_research_speed"] },
  { id: "feedback_loop", clusterId: "school", name: "Feedback Loop", description: "+10% worker XP gain per completed school research.", numericEffect: "10%", parentIds: ["collaborative_research"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [150000], unlocks: ["feedback_loop_xp"] },
  { id: "Sponsoring", clusterId: "school", name: "Sponsoring", description: "Every canvas sold cuts 1s off the active research.", numericEffect: "1", parentIds: ["invest_brain"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [200000], unlocks: ["sponsoring_research_speed"] },
  { id: "mentorship", clusterId: "school", name: "Mentorship", description: "All completed-research numeric effects are increased by 30%.", numericEffect: "30%", parentIds: ["unlock_school"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [250000], unlocks: ["mentorship_research_boost"] },
  // Inert placeholders — authored but not yet crafted (no effect). Present so the
  // constellation renders them and the JSON↔runtime agreement test passes.
  { id: "new_node", clusterId: "school", name: "New Node", description: "", numericEffect: "", parentIds: ["feedback_loop"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [0], unlocks: [] },
  { id: "new_node_2", clusterId: "school", name: "New Node", description: "", numericEffect: "", parentIds: ["Sponsoring"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [0], unlocks: [] },
  { id: "new_node_3", clusterId: "school", name: "New Node", description: "", numericEffect: "", parentIds: ["new_node_2"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [0], unlocks: [] },
  { id: "new_node_4", clusterId: "school", name: "New Node", description: "", numericEffect: "", parentIds: ["new_node"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [0], unlocks: [] },
  { id: "new_node_5", clusterId: "school", name: "New Node", description: "", numericEffect: "", parentIds: ["new_node_3"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [0], unlocks: [] },
  { id: "new_node_6", clusterId: "school", name: "New Node", description: "", numericEffect: "", parentIds: ["new_node_4"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [0], unlocks: [] },
  { id: "new_node_7", clusterId: "school", name: "New Node", description: "", numericEffect: "", parentIds: ["mentorship"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [0], unlocks: [] },
  { id: "technical_implementation", clusterId: "school", name: "Technical Implementation", description: "", numericEffect: "", parentIds: ["new_node_6", "new_node_5", "new_node_7"], stacking: "additive", kind: "major", maxLevel: 1, costs: [0], unlocks: [] },
];

/** Lookup helper. Returns null if id unknown. */
export function getSkillNodeConfig(id: SkillNodeId): SkillNodeConfig | null {
  return SKILL_NODES.find((n) => n.id === id) ?? null;
}
