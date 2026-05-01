# Workshop — Design Spec

**Status:** Draft for review. Replaces `2026-04-25-atelier-design.md` (which assumed canvas drops as the items source — that assumption was rejected on 2026-04-26).
**Implementation order:** Workshop ships **after** Canvas (Workshop affix pool depends on canvas dimensions). See `2026-04-25-canvas-design.md`.
**References:** §6 of `2026-04-25-info-panel-design.md` (mandatory hover-info content authoring rule).

---

## 1. Design intent

**Deep long-game axis** (option C from the original Q1). The Workshop is comparable in depth to the skill tree — the player crafts (via the conveyor), equips, optimizes builds, hunts sets, and gambles for top-tier persistence. Not a passive multiplier; a mid-to-late-game system the player actively engages with.

This is **post-MVP scope.** Exceeds the MVP-rebuild spec on slot count, tier depth, and skill-tree expansion — intentional, because MVP shipped.

**Constraint:** every sub-mechanic of the Peinture view exists to make the central canvas mechanic more efficient. Workshop item affixes therefore must roll only **canvas-related stats** — never `inspiration_gain`, `fame_at_ascend`, or anything outside the canvas loop.

**Tuning north star:** *« difficile, long, récompensant »* — system designed to reward patient accumulation and intentional play. Hardcore ARPG philosophy. All numerical tuning (rates, stash sizes, success probabilities, level costs, fame costs) follows this principle.

**Items source (decided 2026-04-26).** Items enter the inventory via the Workshop conveyor — a continuous gold-drain production line running in parallel with canvas. RNG is a core part of crafting: slot, set, tier, and affixes are all rolled per item-pop. Workshop level and skill tree investment shift the odds toward higher-tier outputs. There are no item drops on canvas completion. See §11.

---

## 2. Architecture

**Single merged interface.** The Workshop combines crafting, equipping, and inventory management into one panel (`WorkshopPopup`). Conveyor → equip → manage happens in one place. The MVP's separate `CraftPopup` and `InventoryPopup` are deprecated and replaced by this panel.

```
WorkshopPopup
├── Top bar: Workshop level + XP + Conveyor status (rate / drain / on-off) + Stash | Vault toggle
├── Left col 25%: 8 equipment slots (with currently equipped item visible)
├── Center col 50%: Stash grid + filter row + sort + pagination
├── Right col 25%: Action panel (Reroll / Upgrade / Set Target / Persistence)
│                   + selected-item details + lock/pin toggles
└── Bottom: hover info bridge to InfoPanel (§6 of info-panel spec)
```

---

## 3. Slots and tiers

- **8 equippable slots.**
- **6 rarity tiers:** normal → rare → magique → épique → légendaire → masterpiece. Higher tiers gated by skill tree tier-ceiling unlocks.

### 3.1 Slot taxonomy

| Slot | Implicit affix | Build naturel |
|---|---|---|
| Brush | `canvas_speed_mult` | Speed |
| Palette | `palette_size_bonus` | (utility) |
| Chapeau | `subject_mastery_gain_mult` | Mastery |
| Blouse | `quality_floor_bonus` | Chef d'œuvre / PM |
| Gants | `style_time_reduction` | Speed hybride |
| Chevalet | `chef_doeuvre_chance_mult` | Chef d'œuvre |
| Couteau à peindre | `gamble_success_chance_mult` | Gamble |
| Broche | `pm_burst_chance_mult` | PM |

Implicit affixes always present; ranges scale with tier (see §7.4).

---

## 4. Sets

### 4.1 Set system

- Each item carries a set tag (or none for normal/rare items above a small probability — see §11.2).
- **4-piece bonus per set.** No 2-piece tier.
- Player can have **up to 2 set bonuses active simultaneously** (4+4 across 8 slots).
- **6 launch sets** — one per build archetype. **No 7th set.**

### 4.2 Four-piece set bonuses

| Set | Build | 4-piece bonus |
|---|---|---|
| **Risque-tout** | Gamble | Gamble yield ×2 always **+** chance par gamble de "JACKPOT" — yield ×10 (proc rare). |
| **Maître** | Chef d'œuvre | Chef d'œuvre yield ×2 always **+** un chef d'œuvre déclenche une "streak créative" : les 3 prochains canvas ont ×3 chef d'œuvre chance. |
| **Rendement** | Speed + Gold | `canvas_speed_mult` ×1.5 + `canvas_gold_mult` ×1.5 always **+** chance par canvas d'un proc random : burst speed ×100 pendant 7 s, OU boost gold ×10 sur les 3 prochains canvas. |
| **Érudit** | Mastery | `subject_mastery_gain_mult` ×2 **+** révèle un sujet caché à chaque palier de mastery franchi (continu — pas de proc). |
| **Atelier prolifique** | Multi-canvas | **+1 slot canvas parallèle** (effet structural unique). Set name retains French flavor; references the canvas slot, not the Workshop. |
| **Héritage** | PM | `pm_gain_mult` ×2 always **+** chance de "révélation" — un canvas accorde instantanément 5% du PM total gagné dans le run en cours (proc rare). |

4 sets sur 6 ont un proc/burst (Risque-tout, Maître, Rendement, Héritage). 2 restent continus (Érudit, Atelier prolifique) — leur identité (apprentissage progressif / slot extra) résiste aux procs. Initial proc tuning in §11.5.

---

## 5. Loot model

**Conveyor + paid actions.** Items enter the inventory via two channels:

1. **Workshop conveyor** (primary source — see §11). Continuous gold-drain RNG roller. Slot, set, tier, and affixes are all rolled per item-pop, weighted by workshop level + skill tree gates + active set targeting.
2. **Workshop paid actions** (secondary — see §6). Modify existing items: reroll affixes, upgrade rarity, set targeting (biases conveyor for a window), persistence craft.

There is **no** direct "I want a légendaire chevalet Maître" button. Players run the conveyor, accumulate items, then refine via paid actions. This is the difficile-long-récompensant philosophy in mechanism form.

---

## 6. Cost model — items-as-materials, strict B+C

**No new currency.** The conveyor consumes gold only (the Workshop's existing economy). Reroll, upgrade rarity, set targeting, and persistence craft consume **other items** as input.

### 6.1 Strict B+C constraint

Input items must match BOTH **slot type** AND **set affiliation** of the action target.

- Reroll a brush Maître → exigé : 2 brushes Maître same-tier. Sinon action impossible.
- Stash management = puzzle exigeant. C'est l'intention, en ligne avec « difficile, long, récompensant ».
- Conséquence : **set targeting** est le moteur central du système. Doit être unlocked tôt et fiable.

### 6.2 Quantities by action

| Action | Input requis | Note |
|---|---|---|
| **Conveyor (craft)** | Gold drain only — see §11.1 | The conveyor is the items source. No per-item input items required. |
| **Reroll affixes** | 2 items same-tier same-slot same-set | Rerolls all random affixes; implicit unchanged. |
| **Upgrade rarity** | 3 items du tier courant same-slot same-set | Output item one tier higher (e.g., 3 magique brushes Maître → 1 épique brush Maître with rerolled affixes). |
| **Set targeting** | 1 item du set visé (consommé) | Active for the next 10 conveyor item-pops; raises set-affiliation odds. See §11.3. |
| **Persistence craft** | 5 items same-tier same-slot (any sets) — or fewer with tier overshoot | Bound to one specific item; success makes that item permanent. See §10. |

**Persistence craft excess sacrifice:** input `n ≥ 5` items same tier (same slot only — set affiliation not required). Each item beyond 5 adds a success bonus. See §10 for tuning.

---

## 7. Affixes

### 7.1 Roll model (PoE-style hybrid)

Each item has:
- **1 implicit affix** — always present, fixed range per tier, specific to slot type (§3.1).
- **2–4 random affixes** drawn from the universal pool (count by tier — §7.4).
- **0–1 set affix** — present iff the item carries a set tag (§4.1).

### 7.2 Universal affix pool

**Existing (MVP):**
- `canvas_speed_mult`
- `canvas_gold_mult`
- `paint_mastery_gain_mult`

**Canvas-derived (from canvas spec §14):**
- `quality_floor_bonus`
- `style_time_reduction`
- `palette_size_bonus`
- `subject_mastery_gain_mult`
- `chef_doeuvre_chance_mult`
- `gamble_success_chance_mult`
- `gamble_yield_mult`
- `parallel_canvas_efficiency`
- `pm_burst_chance_mult`

**Workshop-meta (very rare on items):**
- `+1 pin slot`
- `+1 stash slot`

### 7.3 Excluded from items

Workshop-internal stats live in skill tree nodes or workshop-level bonuses — never on items:
- `set_targeting_odds`
- `salvage_yield`
- `craft_cost_reduction`
- `workshop_rate_mult`
- (any future internal-economy lever)

### 7.4 Affix counts by tier

| Tier | Implicit | Random | Set | Total |
|---|---|---|---|---|
| Normal | 1 | 2 | 0 | 3 |
| Rare | 1 | 3 | 0 | 4 |
| Magique | 1 | 3 | 0–1 | 4–5 |
| Épique | 1 | 4 | 1 | 6 |
| Légendaire | 1 | 4 | 1 | 6 |
| Masterpiece | 1 | 4 | 1 + 1 unique | 7 |

### 7.5 Affix value ranges

Every affix rolls within a tier-scaled range. Initial values flagged for tuning (§15).

| Affix | Normal range | Légendaire range | Masterpiece range |
|---|---|---|---|
| `*_mult` style affixes (gold, speed, mastery, gamble yield, parallel efficiency, pm gain, …) | +1% to +5% | +20% to +35% | +35% to +50% |
| `*_chance_mult` style affixes (chef d'œuvre, gamble success, pm burst) | +5% to +10% | +50% to +80% | +80% to +120% |
| `quality_floor_bonus` (flat) | +1 to +2 | +5 to +8 | +9 to +12 |
| `style_time_reduction` (additive %) | +1% to +2% | +6% to +9% | +10% to +14% |
| `palette_size_bonus` (flat) | +1 | +3 | +5 |
| `+1 pin slot` (very rare) | n/a | one possible roll on légendaire+ | rolls in masterpiece-only pool |
| `+1 stash slot` (very rare) | n/a | one possible roll on légendaire+ | rolls in masterpiece-only pool |

Linear interpolation between normal and légendaire for rare/magique/épique.

---

## 8. Skill tree — Workshop branch

New "Workshop" branch on the global (fame) skill tree. Permanent across ascends. Sister to the new "Canvas" branch.

### 8.1 31 nodes total, themed sub-branches

| Catégorie | Nb nodes | Détail |
|---|---|---|
| Capabilities | 4 | reroll, upgrade rarity, set targeting, persistence craft |
| Tier ceilings | 5 | rare → magique → épique → légendaire → masterpiece (chain prereq) |
| Slot unlocks | 6 | chapeau, blouse, gants, chevalet, couteau, broche |
| Pin slots | 4 | +1 pin slot par node, jusqu'au cap de 4 |
| QoL / power | 12 | stash expansion ×3, workshop level cap +N ×3, cost reduction per action ×3, **workshop rate +25% ×3** (NEW) |

Brush + palette are unlocked from game start (Phase 1 MVP). The 6 slot-unlock nodes cover the post-MVP slots. **Note:** the pre-revision spec mistakenly stated "22 nodes total" — the actual count summing the per-subcategory references in §9 + §12 was 28; the Workshop rework adds 3 new rate nodes for 31 total.

### 8.2 Topology

Themed sub-branches with internal prereqs (ex. tier ceilings chain). Between categories, free purchase order, except structural prereqs:
- **Persistence capability** requires **masterpiece tier** déjà unlocked.
- **Set targeting** requires **rare tier** unlocked.
- **Reroll** + **upgrade rarity** have no prereq beyond the branch root.
- **Workshop rate +25%** nodes have no prereq beyond the branch root (they are pure throughput multipliers).

### 8.3 Node fame costs

| Catégorie | Cost range |
|---|---|
| Capability nodes (reroll, upgrade) | 5–25 |
| Set targeting | 30 |
| Persistence craft | 200 |
| Tier ceiling: rare | 5 |
| Tier ceiling: magique | 25 |
| Tier ceiling: épique | 75 |
| Tier ceiling: légendaire | 200 |
| Tier ceiling: masterpiece | 500 |
| Slot unlock (each) | 10 |
| Pin slot 1 / 2 / 3 / 4 | 50 / 150 / 350 / 700 |
| Stash expansion (each) | 30 |
| Workshop level cap +N (each) | 50 |
| Cost reduction per action (each) | 75 |
| **Workshop rate +25% (each)** | **75** |

Calibrated against fame-per-ascend rates from MVP. **Flagged for tuning** — see §15.

---

## 9. Workshop level vs skill tree

**Two parallel axes.**
- **Skill tree (fame, permanent)** sets the *ceiling* — what is possible at all (which tiers, which slots, which capabilities, base rate cap).
- **Workshop level (gold-spent, per-run)** is the *per-run progress toward that ceiling.* Reset on ascend.

### 9.1 Workshop level economy

- **100 levels max.** Cap raised by skill tree QoL "workshop level cap +N" nodes (each +10 levels above the base 100, up to 130 with all 3).
- **XP source:** gold spent in workshop (conveyor drain + paid actions: reroll, upgrade, set targeting, persistence craft) accumulates as workshop XP, 1:1.
- **Cost curve:** level N → level N+1 requires `100 * 1.15^N` gold spent. Level 1 = 115 g cumulative. Level 50 = ~108 k cumulative. Level 100 = ~1.2 M cumulative.

### 9.2 Per-level effects

Each workshop level has two effects:

**(a) Conveyor rate scaling.** Workshop level multiplies the base item-pop rate. See §11.1 for the formula.

**(b) Craft tier distribution.** Workshop level shifts the conveyor's tier roll toward higher tiers, capped by skill tree tier-ceiling unlocks:

| Workshop level range | Craft tier weights (within unlocked ceiling) |
|---|---|
| 1–10 | 100% Normal |
| 11–25 | Normal 80–95%, Rare 5–20% (linear ramp) |
| 26–50 | Normal 60–80%, Rare 25–35%, Magique 0–8% |
| 51–75 | Normal 30–60%, Rare 30–40%, Magique 8–18%, Épique 0–4% |
| 76–95 | Normal 10–30%, Rare 25–35%, Magique 18–30%, Épique 4–10%, Légendaire 0–1.5% |
| 96–100 | Normal 5–10%, Rare 20–25%, Magique 30%, Épique 10–15%, Légendaire 1.5–5%, Masterpiece 0–0.3% |

Tiers above the player's skill-tree-unlocked ceiling are clamped to 0 and reweighted into lower tiers.

### 9.3 Cost reduction skill nodes

The 3 "cost reduction per action" QoL nodes each shave 10% off paid-action gold costs (additive — full 30% with all 3). Affects workshop-XP-accrual rate inversely (less spend = slower level), so the nodes accelerate efficiency at the cost of slower workshop levelling. Intentional tradeoff. **The conveyor's per-item cost is NOT affected** by these nodes — only the 4 paid actions (reroll, upgrade, set targeting, persistence craft).

---

## 10. End-game persistence — TWO-TIER

### 10.1 Étage 1 — Pin déterministe

- Skill tree unlocks up to **4 pin slots** total.
- Player chooses items to pin. **No risk.** Pinned items survive ascend (kept equipped at the start of the next run).
- Pin slot reversibility: **mid-run swap allowed** — the player can re-assign pin slots to different equipped items at any point during a run. Pin assignments lock at ascend.
- Secures up to one complete set (4/4) deterministically.

### 10.2 Étage 2 — Permanence craft

For the 4 non-pinned slots: sacrifice 5 items same-tier (same slot) → probability roll → success = item permanent (lives in the **Persistence Vault** UI tab and is auto-equipped each run), failure = target item destroyed.

### 10.3 Persistence-craft tuning

**Base success probability (5 sacrifice items, all same tier as target):**

| Target tier | Base success |
|---|---|
| Normal | 60% |
| Rare | 40% |
| Magique | 25% |
| Épique | 12% |
| Légendaire | 5% |
| Masterpiece | 1.5% |

**Bonuses:**
- Each excess sacrifice item beyond 5 (same tier): **+5%** chance, capped at **+20%** (so 9 items = max bonus).
- Each sacrifice item one tier above target: **+12%** chance, capped at **+24%** (so 2 tiers above = max bonus).

**Failure mode:** the targeted item is destroyed; sacrifices are also consumed (always — success or fail). No partial refund.

**Pin vs persistence resource trade:** pinned items occupy 1 of 4 pin slots. Persistence-crafted items live in the Persistence Vault and have no slot count limit (only the cost of crafting them limits them). Both modes can coexist for the same player.

### 10.4 Persistence Vault

Separate UI tab in `WorkshopPopup` (toggled from the top bar). Contains all persistence-crafted items. Each persistence-vaulted item auto-equips at run start. If the vault holds multiple items eligible for the same equipment slot (e.g. two persistence-crafted brushes), the player chooses one as **primary** for that slot via the vault UI; non-primary items remain in the vault and can be manually swapped in mid-run. Pinned items override the vault primary if both target the same slot.

---

## 11. Workshop production (the conveyor)

(Owns the policy that the per-item RNG roll implements.)

### 11.1 Conveyor mechanism

The Workshop is a single continuous production line running in parallel with canvas. While running, gold is drained at a fixed rate. Each completed cycle pops one item into the stash (or the auto-clean pipeline if at cap).

**Per-item rate formula:**

```
rate(items/min) = base_rate × workshop_level_multiplier × skill_tree_rate_multiplier
```

- **Base rate:** 1 item/min (tuning-flagged).
- **Workshop level multiplier:** `1 + 0.04 × (workshop_level − 1)` — level 1 = 1.0×, level 100 = ~5.0×.
- **Skill tree rate multiplier:** `1 + 0.25 × workshop_rate_nodes_purchased` — 0 nodes = 1.0×, 3 nodes = 1.75×.
- **End-game peak (level 100, full skill tree):** ~8.75 items/min (~525 items/hour).

**Per-item gold cost:**

```
cost_per_item = 200 g  (tuning-flagged, fixed across all tiers)
```

**Total gold drain (g/min) while conveyor is running:**

```
drain_rate = rate × cost_per_item
```

End-game peak drain: ~1750 g/min ≈ ~30 g/sec.

**Player controls:**
- **On/off toggle.** The conveyor only runs when toggled on. Off = no drain, no items.
- **No drain-rate cap.** The conveyor runs at its full computed rate when on.
- **Set targeting** (paid action — see §11.3) is the only way to bias the per-item roll.

**Insufficient gold.** If the player's gold drops below `cost_per_item` while the conveyor is running, the conveyor auto-pauses (toggle stays ON conceptually, but no progress accrues) until gold is replenished. A pending item-pop does not consume partial gold; gold is deducted in full at item-pop time. UI surfaces the pause state distinctly from a player-initiated OFF toggle ("Insufficient gold" badge on the conveyor strip).

**Tick model:** the conveyor accumulates progress at `rate / 60` items/sec while running and gold is sufficient. When accumulated progress crosses 1.0, it pops one item, deducts `cost_per_item` gold, decrements progress by 1.0, and continues. (Allows a single tick to pop multiple items if rate is high enough; prevents drift.)

### 11.2 Set affiliation roll

When a conveyor item-pop fires:
- 40% no-set (only valid for normal / rare / magique items)
- 60% set tag, with each of the 6 sets at 10%
- For épique+ tiers, the no-set 40% is reweighted onto the 6 sets (each → 16.67%)

Set affiliation is **rolled before tier**. Set targeting (§11.3) modifies these probabilities.

### 11.3 Set targeting effect

Set targeting (paid action, requires 1 item of target set as input) raises odds for the next 10 conveyor item-pops:

- Target set probability: 60% (vs 10% baseline) for the duration.
- Other 5 sets: 8% each (40% remaining redistributed).
- No-set: same 40% / 0% rule by tier.

Stacking: re-targeting the same set within an active window resets the count to 10 (does NOT additively boost). Targeting a different set replaces the prior target.

### 11.4 Tier roll

After set affiliation, tier is drawn from the workshop-level distribution (§9.2 (b)), clamped to skill-tree-unlocked ceiling.

### 11.5 Set 4-piece proc tuning

Initial procs for the 4 burst sets (flagged §15):

- **Risque-tout JACKPOT:** 2% per gamble. Yield ×10 on success.
- **Maître creative streak:** triggered on every chef d'œuvre. Buff: ×3 chef d'œuvre chance for the next 3 canvases. If a chef d'œuvre triggers during an active streak, the streak counter is reset to 3 (does not stack the multiplier).
- **Rendement burst:** 1% per canvas → 50% speed-burst (×100 for 7 s), 50% gold-burst (×10 next 3 canvases). If a second proc occurs during an active burst, it replaces the active buff (does not stack).
- **Héritage révélation:** 0.5% per canvas. Grants 5% of run's total accumulated PM instantly. Cooldown: 5 canvases minimum between procs.

---

## 12. Stash management

### 12.1 Capacity

- **Base = 200 slots.**
- Skill tree QoL "stash expansion" nodes (3 nodes total) → +50 slots each. Theoretical cap **350**.
- Affix `+1 stash slot` on items — very rare, additive. Realistic effective cap ~360–380 with full investment.

(The previous WIP mentioned ~500 cap; the lower 350 cap is more in line with the strict-B+C puzzle intent — too much room undermines the constraint. Flagged for tuning.)

### 12.2 Organisation

Single grid + filters/sort:
- **Filters (multi-select dropdowns):** slot, set, tier, affix.
- **Sort (single dropdown):** newest, oldest, tier ↓, value ↓.
- Filter+sort combine. Active filters are summarized at the top of the grid for clarity.
- Total subcategory space: 8 slots × 6 sets × 6 tiers = 288 buckets (plus no-set variants for low tiers). Filters are UI-critical.

### 12.3 Disposal — lock + auto-clean

- Items are **locked** by the player (toggle on item details panel) to protect them. Locked items are never consumed by actions or auto-clean.
- When the stash hits cap, **auto-clean** removes unlocked items to make room for new conveyor item-pops.
- **Auto-clean criterion:** lowest **value** first, ties broken by oldest first.
  - `value = sum(affix_score) + (50 if set else 0)`
  - `affix_score = tier_weight^2 * affix_quality_pct` where `affix_quality_pct` is the affix's roll within its tier range (0..1) and `tier_weight = {normal: 1, rare: 2, magique: 3, épique: 5, légendaire: 8, masterpiece: 13}`
- Player can override per-item via lock. Auto-clean **never** removes locked items — if all items are locked at cap, new conveyor item-pops are silently discarded with a UI warning.

---

## 13. UI structure of merged Workshop panel

### 13.1 Layout

`WorkshopPopup` is a Control with three columns and a top/bottom strip:

```
┌────────────────────────────────────────────────────────────────┐
│  Workshop Lv 47 [████████░░] 47/100   [Stash | Vault]   ⚙     │  Top bar
│  Conveyor: ON  ●  3.2 items/min  ▼  ~640 g/min  [Pause]       │  Conveyor strip
├──────────────┬──────────────────────────────────┬──────────────┤
│  EQUIPMENT   │  STASH GRID                      │  ACTION      │
│              │  [Slot ▾][Set ▾][Tier ▾][Aff ▾]  │  ┌────────┐  │
│  Brush       │  [Sort ▾]      [Search…]         │  │ Reroll │  │
│  Palette     │                                  │  │Upgrade │  │
│  Chapeau     │  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┐    │  │ Target │  │
│  Blouse      │  │  │  │  │  │  │  │  │  │  │    │  │Persist │  │
│  Gants       │  ├──┼──┼──┼──┼──┼──┼──┼──┼──┤    │  └────────┘  │
│  Chevalet    │  │  │  │  │  │  │  │  │  │  │    │              │
│  Couteau     │  …  …  …  …  …  …  …  …  …       │  [Selected   │
│  Broche      │  ◀ Page 1 / 4 ▶                  │   Item       │
│              │                                  │   Details    │
│              │                                  │   + 🔒 + 📌] │
└──────────────┴──────────────────────────────────┴──────────────┘
            (InfoPanel hover-info bridge below — outside this popup, on Main.tscn)
```

Approximate column widths: 25% / 50% / 25%.

### 13.2 Top bar elements

- **Workshop level + XP bar** (live updating).
- **Conveyor status strip** (NEW): on-state indicator, current items/min rate, current gold drain rate (g/min), Pause/Resume button. Hovers expose tooltip with the full rate breakdown (base × workshop_level × skill_tree).
- **Stash | Vault tabs** (Stash = full grid; Vault = persistence-crafted items, list view).
- **⚙** opens stash settings (auto-clean toggle, filter defaults, conveyor auto-pause-on-stash-full toggle).

### 13.3 Equipment column

- 8 vertical slot frames in canonical order (Brush, Palette, Chapeau, Blouse, Gants, Chevalet, Couteau, Broche).
- Each shows: sprite + tier-color border + set tag overlay + currently active set bonus indicators (count of pieces equipped per set).
- Drag-drop targets: drop a stash item onto a slot to equip; drop equipped onto stash to un-equip.

### 13.4 Center stash grid

- Filter row (multi-select dropdowns) + sort dropdown + search text field at top.
- Grid: 9 columns × variable rows, paginated at 90 items/page. Per-cell tile shows tier-color border, slot icon, set badge, lock indicator.
- Click an item → it becomes the **selected item** (right column populates).
- Right-click → context menu: equip, lock, mark for action input.

### 13.5 Action panel

- **4 action buttons** stacked: **Reroll**, **Upgrade**, **Set Target**, **Persistence**. (No "Craft" button — items enter the inventory via the conveyor, see §5 + §11.)
- Below buttons: selected-item details — full affix list with value, tier, set badge, lock + pin toggles.
- Action buttons are gated: disabled if the strict B+C input requirements are unmet, with a hover-info explanation per §6 of info-panel spec.

### 13.6 Hover info — InfoPanel bridge

Per `2026-04-25-info-panel-design.md` §6, every interactive element in `WorkshopPopup` gets a `Hoverable` child publishing structured info: numbers, live values, costs with icons, no narrative-only blurbs. Coverage required for: every slot, every action button, every filter dropdown, every selected-item affix line, lock + pin toggles, workshop level bar, conveyor status strip (each element: ON/OFF state, rate breakdown, drain breakdown, pause control).

---

## 14. Cross-system depth

Several builds depend on other systems to shine — the Workshop alone does not determine builds; it amplifies broader strategic choices.

| Build | Workshop slot synergy | Cross-system dep |
|---|---|---|
| Gamble (Risque-tout) | Couteau implicit + 4-piece | Tree (inspiration income to gamble at high N) |
| Chef d'œuvre (Maître) | Chevalet implicit + Blouse floor | Skill tree (chef d'œuvre unlock node) + Subject mastery |
| Speed + Gold (Rendement) | Brush + Gants implicits | — |
| Mastery (Érudit) | Chapeau implicit | Subject system progression pacing |
| Multi-canvas (Atelier prolifique) | 4-piece slot grant | Painter Office (worker count) + Canvas skill tree multi-canvas nodes |
| PM accumulator (Héritage) | Broche implicit | — |

**Implication:** the Workshop system is meant to be played alongside the rest of the game, not in isolation. Sparring weak Workshop with strong tree/canvas is intentional — the Workshop is amplification, not the primary lever.

---

## 15. Flagged for review

Initial values invented in this draft. The user is the validation gate. Two flag categories:

### 15.1 Tuning numbers (math / feel check)

- **Conveyor base rate (§11.1):** 1 item/min base. End-game ~8.75 items/min. **Walk-through (verify):** to persistence-craft a légendaire Maître brush:
  - Per item-pop probability of "légendaire Maître brush" with set targeting active and légendaire ceiling unlocked at workshop level 96–100: `5% (légendaire) × 60% (target set) × 12.5% (specific slot) = 0.375%`.
  - 5 same-slot-same-set items needed → ~1333 item-pops per persistence attempt → ~2.5 hours of conveyor time per attempt.
  - At légendaire-tier 5% persistence success rate, expected attempts to first success ≈ 20; ~50 hours of conveyor time per single permanent légendaire item per slot.
  - Full 4-slot Set du Maître via persistence: ~200 hours.
  - Without set targeting, attempt cost is 6× higher (10% baseline vs 60% targeted set affiliation), so set targeting is effectively mandatory for focused builds. This concentrates the §15.1 economy around the set-targeting paid action — flag for plan-phase tuning.
  - **The pre-revision spec stated ~125 hours per permanent légendaire item using a confused calculation that double-counted set affiliation. The corrected math above is honest.** User to validate the new scale (~50 h/slot, 200 h for a full set) against the « difficile, long, récompensant » north star — adjust base rate, légendaire roll %, or persistence success % to taste.
- **Conveyor per-item cost (§11.1):** 200g/item. End-game drain ~1750 g/min ≈ 30 g/sec. Verify against canvas gold-output curves at level-100 progression — at what gold/sec rate is canvas income at end-game? If canvas income is <30 g/sec, the conveyor saturates the player's gold income; if >>30 g/sec, the conveyor is essentially free and the toggle becomes vestigial. Tune cost up or down to keep the conveyor meaningful.
- **Workshop level cost curve (§9.1):** `100 * 1.15^N` gold spent. Total to level 100 = ~1.2 M. With conveyor consuming gold continuously, workshop XP accumulation now has two channels (conveyor + paid actions); verify the leveling curve still reaches level 100 at the right point in progression.
- **Drop tier distribution → craft tier distribution (§9.2):** légendaire ramps to 1.5–5% at levels 76–100. Same numbers as pre-revision; verified consistent in §15.1 walk-through.
- **Persistence base success (§10.3):** 60/40/25/12/5/1.5%. Excess sacrifice +5%/item (cap +20%). Tier overshoot +12% (cap +24%). Verify the math against the philosophy: a fully-resourced légendaire attempt = 5 + 5%×4 + 12%×2 = 49% chance (5 base + 20 excess + 24 overshoot). Light-touch légendaire attempt (5 légendaire only, no extras) = 5%. 1 in 20 attempts.
- **Affix value ranges (§7.5):** ×1–5% normal → ×35–50% masterpiece per `*_mult`. With 4 random affixes on légendaire+, a 4-piece Rendement player can easily reach +200% gold and +100% speed. Verify against canvas output curves to ensure the multipliers feel rewarding without overshooting the gold-faucet pacing.
- **Skill tree fame costs (§8.3):** persistence node = 200 fame, masterpiece tier = 500 fame, pin slot 4 = 700 fame, workshop rate +25% = 75 fame each. Worth recalibrating once we have fame-per-ascend data from MVP runs.
- **Set 4-piece proc rates (§11.5):** Risque-tout JACKPOT 2%, Rendement burst 1%, Héritage révélation 0.5%. Pure-vibes initial values.
- **Stash cap (§12.1):** 200 base + 150 from QoL. With the conveyor pumping items, auto-clean will be busier than the drop model; verify 200 base is enough headroom for active play before auto-clean kicks in. Actively flagged.
- **Implicit affix ranges across slots:** every implicit affix uses the same per-tier range as the random pool, but slots have different "feel" budgets. Probably needs slot-specific ranges later (e.g., chevalet implicit chef-d'œuvre-chance might want a tighter spread than brush speed).

### 15.2 Thematic / naming (taste check)

- **Set bonuses' flavour names** (`Risque-tout`, `Maître`, `Rendement`, `Érudit`, `Atelier prolifique`, `Héritage`) — taste calls. Note: `Atelier prolifique` retains the French word `atelier` as flavor; the Workshop rename does not propagate into set names by default.
- **Slot French names** (Chapeau, Blouse, Gants, Chevalet, Couteau à peindre, Broche) — taste calls.
- **JACKPOT, streak créative, révélation** — proc flavour names from set 4-piece bonuses; taste calls.
- **Tier names** (normal, rare, magique, épique, légendaire, masterpiece) — could rename "masterpiece" to a French equivalent (`chef-d'œuvre` is taken by the canvas mechanic; `magnum opus`?). Taste call.

### 15.3 (formerly: architectural assumption needing validation — RESOLVED)

The pre-revision spec had a flag: "Items source = canvas drops. The Atelier spec's level economy and persistence-craft math depend on this assumption. **#1 thing to validate before plan-writing.**" This is now resolved by the Workshop conveyor design (§11). No outstanding architectural assumption remains.

---

## 16. Open implementation questions for plan phase

Resolved during writing-plans, not needed in this spec:

- **File layout:** new `Workshop.gd` autoload (replacing the placeholder MVP `Workshop.gd`)? Replace existing `Inventory.gd` + `Craft.gd` + `CraftRecipes.gd`? The MVP `Workshop.gd`'s `tier` field maps to the new workshop_level; cost curve carries over.
- **Persistence:** `Save.gd` schema additions for workshop level, equipped items, stash items, pin slots, persistence vault, lock states, conveyor on/off, accumulated conveyor progress. (Note: save/load is currently disabled in production during rebuild churn — re-enabling will likely coincide with this implementation.)
- **Conveyor tick:** in `Main._process` (alongside `GameState.tick`)? Or the Workshop autoload's own `_process`? Probably called from `Main._process` for consistency with the existing pattern.
- **Conveyor item-pop function:** `Workshop.roll_item(workshop_level, slot_unlocks, tier_ceiling, set_target) -> Item`. Pure function; testable in isolation.
- **Test surface:** target ~50 GUT tests for the system (conveyor rate formula, item-pop roll weights, action input validation, persistence-craft probabilities, set bonus activation, auto-clean priority, save/load round-trip, conveyor on/off, gold drain accounting).
- **UI scenes:** `WorkshopPopup.tscn` rebuilt from scratch (existing placeholder is minimal); `CraftPopup.tscn` + `InventoryPopup.tscn` deprecated and deleted.
- **`Hoverable` rollout** per §6 — every interactive element in `WorkshopPopup` gets one.
- **Conveyor on/off persistence across ascend:** does ascend reset the toggle to OFF (forcing a deliberate restart) or carry the state? Probably reset to OFF, matching the pattern of "fresh run" — flagged for plan phase.

---

## 17. Definition of done

- All 31 Workshop skill tree nodes added to `SkillTreeNodes.gd` and rendered.
- 8 equipment slots + 6 tiers + 6 sets implemented.
- Affix system: pool, tier ranges, count by tier, implicit per slot.
- **Workshop conveyor** producing items at the gold-drain rate per §11.1; on/off toggle wired; rate formula tested.
- 4 Workshop paid actions implemented (reroll, upgrade, set target, persistence) with strict B+C gates.
- 4-piece set bonuses implemented for all 6 sets with proc/burst tuning.
- Two-tier persistence (4 pin slots + persistence vault crafting) with success math.
- Stash: 200 base + skill tree expansion + filters/sort/search + lock + auto-clean priority + auto-pause-on-stash-full toggle.
- Workshop level economy (gold-spent XP, 1:1 from both conveyor drain and paid actions) and tier distribution table.
- All formulas covered by GUT tests (target 50+ new tests).
- Hover info wired (§6 of info-panel spec) on every interactive element including the conveyor strip.
- 238 prior tests still pass.
