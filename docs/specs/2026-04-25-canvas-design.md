# Canvas — Design Spec

**Status:** Draft for review. Promoted from `2026-04-25-canvas-design-WIP.md` on 2026-04-26.
**Implementation order:** Canvas first, then Atelier (Atelier affix pool depends on canvas dimensions).
**Companion spec:** `2026-04-25-atelier-design.md`.
**References:** §6 of `2026-04-25-info-panel-design.md` (mandatory hover-info content authoring rule).

---

## 1. Design intent

The canvas is the central production loop (gold faucet). Every other Peinture sub-mechanic (Atelier, Workshop, Inventory, Painter Office) exists to make the canvas more efficient. This spec enriches the canvas from its 2-multiplier MVP state into a multi-axis system so that the Atelier affix pool can hook into a wide surface area of canvas-derived stats.

**Tuning north star (inherited from Atelier brainstorm):** *« difficile, long, récompensant »* — hardcore patient ARPG philosophy. Numerical tuning rewards intentional, accumulating play.

---

## 2. Architecture overview

The canvas is split into three concerns:

- **Configuration** — sticky settings the player edits (style level, palette level, current subject, gamble setting). Edited via the **Configuration tab** of `CanvasPopup`. Applies to all subsequent canvases until manually changed.
- **Improvement** — permanent upgrades the player buys with currencies (style ceiling, palette ceiling, etc.). Edited via the **Improvement tab** of `CanvasPopup`. Persists across ascends only via the skill tree; per-run improvements reset.
- **Execution** — the loop itself. Visible on the `PaintingView` directly: progress bar, current subject, current quality preview, slot count, drops feed.

```
PaintingView
├── Canvas slots (1..N parallel — N from Painter Office workers)
│   ├── Progress bar (filling toward completion)
│   ├── Current subject + quality preview (live)
│   └── Auto-sale on completion → gold + PM + (RNG) item drop
├── Sub-mechanic buttons: [Atelier] [Workshop] [Painter Office] [Canvas ⚙]
└── BottomBar (currencies) + InfoPanel (hover info)

CanvasPopup (opens from [Canvas ⚙])
├── Configuration tab — sticky sliders/toggles
└── Improvement tab — buy upgrades (style ceiling, palette ceiling, hint reveals, …)
```

---

## 3. Operating model

1. **Sticky configuration + observed loop.** Player opens `CanvasPopup` → Configuration tab, sets sliders/toggles, closes. Config applies to all subsequent canvases until manually changed. No per-canvas re-decision.
2. **Auto-sale state machine.**
   - `peint en cours` → progress fills (auto, time = f(taille, style))
   - `terminé` → auto-sold immediately (gold + PM credited; item drop rolled)
   - `nouveau canvas` starts immediately with same sticky setup
   - No "ready to sell" idle state — direct chain.
3. **Multi-canvas.** Each canvas slot runs the same sticky configuration independently. Slot count = number of unlocked Painter Office workers. Affix `parallel_canvas_efficiency` modifies the per-slot output multiplier.
4. **Auto-max taille.** Canvas always paints at the highest unlocked tier (existing `CanvasTiers` config — 10 tiers).

---

## 4. Dimensions exposed

| Axis | Type | Mode | Notes |
|---|---|---|---|
| **Taille (tier)** | int upgrade | Auto-max | Always painted at the highest unlocked tier (10 MVP tiers). |
| **Style** | slider 1–N sticky | Player sets, capped by unlocked ceiling | Discrete 1–10 baseline ceiling. Skill tree extends. |
| **Palette** | slider 1–N sticky | Player sets, capped by unlocked ceiling | Discrete 1–10 baseline ceiling. Skill tree extends. |
| **Sujet courant** | choice sticky | Player picks among unlocked subjects | Subject discovery graph below. |
| **Gamble inspi** | toggle + amount sticky | Player activates and calibrates | Spends inspiration before canvas start. |
| **Maîtrise sujet** | per-subject stat | Auto-accumulates with completions of that subject | Drives quality + unlocks derived subjects. |
| **Qualité (output)** | derived | f(taille, style, palette, mastery, floor_bonus) | See §6. |
| **Temps (output)** | derived | f(taille, style) | Higher tier + style = slower. Affixes reduce. |
| **Gold (output)** | derived | f(qualité, taille, multipliers) | See §6. |
| **PM gain (output)** | derived | f(qualité, threshold, RNG burst) | See §6. |
| **Chef d'œuvre** | RNG very low | Gated by skill tree anchor node | Quality override — see §6. |
| **Drop d'item** | RNG | Gated by atelier level + canvas quality | See §11 — items source. |

---

## 5. Style and palette — discrete sliders

Both **style** and **palette** are discrete integer sliders 1–`current_ceiling`. Two layered limits gate progression:

- **Skill-tree cap** = the maximum the player is allowed to ever reach. Baseline 10. Skill tree nodes raise to 25 across 3 chained nodes (+5 each).
- **Current ceiling** = the maximum the player has bought via the Improvement tab (within the skill-tree cap). The Improvement tab buys `+1 current ceiling` at a time, gold-cost curve in §10.
- At game start: skill-tree cap = 10, current ceiling = 1, so the slider is locked at 1 until the player buys the first +1.

Per-step effects:
- **Style** — each step adds **time + quality** (style is a quality/speed tradeoff lever).
- **Palette** — each step adds **quality only**, no time cost (palette differentiates from style by being a pure quality investment).

Player sets the slider anywhere from 1 to current ceiling. Sticky.

---

## 6. Quality, gold, PM, chef d'œuvre — formulas

### 6.0 Order of operations

For each canvas tick that completes:

1. Compute `base_quality` from sticky settings + mastery + floor bonus (§6.1).
2. If gamble is active, resolve the gamble: success multiplies `base_quality`, failure halves it (§8.2). Result is `gambled_quality`.
3. Roll chef d'œuvre RNG. If proc, override quality to `ideal_quality` (§6.2). Result is `final_quality`.
4. Compute gold (§6.3) and PM (§6.4) from `final_quality`.

### 6.1 Base quality

```
base_quality = taille + style + palette + mastery_tier(current_subject) + quality_floor_bonus
```

Where:
- `taille` = current canvas tier (1–10)
- `style` = sticky style setting (1–current_ceiling, see §5)
- `palette` = sticky palette setting (1–current_ceiling, see §5)
- `mastery_tier(subject)` = current mastery tier of the active subject (0–10)
- `quality_floor_bonus` = sum of `quality_floor_bonus` affixes from equipped items + skill tree quality floor nodes

**Example (mid-game):** tier 5, style 5, palette 5, mastery 3, floor bonus 0 → base_quality = 18.
**Example (late, all maxed):** tier 10, style 25, palette 25, mastery 10, floor bonus 5 → base_quality = 75.

### 6.2 Chef d'œuvre

When the chef d'œuvre RNG roll succeeds (gated by the skill tree anchor node), the canvas's quality is boosted to the **ideal quality** for the current canvas state:

```
ideal_quality = taille + style_skill_cap + palette_skill_cap + 10 + quality_floor_bonus
final_quality = max(gambled_quality, ideal_quality)
```

Where `style_skill_cap` and `palette_skill_cap` are the player's current skill-tree caps (10 baseline, up to 25 fully unlocked) — NOT the player's current improvement-tab ceiling. Chef d'œuvre treats every sticky setting as if it were at the skill-tree-permitted maximum and mastery as if the active subject is fully mastered. Always ≥ `gambled_quality`.

**Example:** player at tier 5, style 5/skill_cap 10, palette 5/skill_cap 10, mastery 3/10, floor 0 → base = 18, ideal = 5 + 10 + 10 + 10 + 0 = 35. Chef d'œuvre canvas yields final_quality = 35.

Chef d'œuvre RNG base chance = **0.5%** per canvas. Modified by `chef_doeuvre_chance_mult` affix from items (multiplicative) and by the Set du Maître 4-piece (×2 always + streak proc).

If chef d'œuvre does NOT proc, `final_quality = gambled_quality`.

### 6.3 Gold

```
gold = final_quality * tier * 10 * canvas_gold_mult
```

- `canvas_gold_mult` = product of all gold multipliers (skill tree, items, set bonuses).
- Tier 1, final_quality 3 (default ceilings 1/1, mastery 0): 30 g per canvas at game start.
- Tier 5, final_quality 18, mult 1: 900 g.
- Tier 10, final_quality 75, mult 1: 7,500 g.
- Tier 10, chef d'œuvre final_quality 100, mult 5 (late-game stack): 50,000 g per canvas.

### 6.4 PM gain

```
base_pm = floor(final_quality / 10)
pm_burst_eligible = final_quality > 30
pm_burst_proc = pm_burst_eligible and rng() < (0.10 * pm_burst_chance_mult)
pm_gained = base_pm * (2 if pm_burst_proc else 1) * paint_mastery_gain_mult
```

- final_quality 5 → 0 PM (sub-threshold). final_quality 10 → 1 PM. final_quality 75 → 7 PM. Burst doubles.
- Burst eligibility uses post-gamble post-chef-d'œuvre quality, so both gamble success and chef d'œuvre can flip a sub-threshold canvas into burst-eligible.
- `pm_burst_chance_mult` is multiplicative: ×2 = 20% per eligible canvas. Set de l'Héritage 4-piece doubles base gain and adds rare "révélation" proc.

### 6.5 Time per canvas

```
time_seconds = (tier * 2 + style * 1) * (1 - style_time_reduction) / canvas_speed_mult
```

- Tier 1 / style 1 / no mods: 3 s.
- Tier 5 / style 10 / no mods: 20 s.
- Tier 10 / style 25 / 30% reduction / 2× speed: ~16 s.
- Affix `style_time_reduction` is additive cap at 70%. `canvas_speed_mult` is multiplicative.

---

## 7. Subject system

### 7.1 Hidden discovery graph

5 starting subjects. All others derive via prereqs (mastery thresholds on parent subjects). Player does not see locked subjects upfront — placeholder `?` cards appear in the subject picker once the player has reached **half** the mastery threshold on at least one parent (lazy reveal).

**Hint reveal:** unlocked via skill tree nodes — reveal one prereq edge of a `?` placeholder.

### 7.2 Mastery curve

- **10 mastery tiers per subject.**
- **XP cost per tier:** tier T requires `200 * 2^(T-1)` mastery points. Tier 1 = 200, tier 5 = 3,200, tier 10 = 102,400. Exponential gate.
- **Gain per canvas:** `1 + floor(quality / 20)` mastery points to active subject. Affix `subject_mastery_gain_mult` multiplies.
- **Quality contribution:** each mastery tier adds +1 to quality of that subject's canvases (max +10).
- **Prereq threshold for derived subjects:** mastery tier 5 on each parent subject.

### 7.3 Starter subjects (5)

1. **Nature** — paysages, plantes, pierres
2. **Vie** — animaux, créatures
3. **Géométrie** — motifs, formes, abstractions
4. **Émotion** — visages humains, expressions
5. **Mythe** — symboles, dieux, narrations

### 7.4 Derived subjects (15) and prereq graph

| Derived subject | Prereqs (each at mastery tier 5) |
|---|---|
| **Animalière** | Nature + Vie |
| **Architecture** | Nature + Géométrie |
| **Portrait** | Vie + Émotion |
| **Religieuse** | Émotion + Mythe |
| **Cosmique** | Mythe + Géométrie |
| **Bestiaire mythique** | Animalière + Mythe |
| **Jardin classique** | Architecture + Nature |
| **Allégorie** | Portrait + Mythe |
| **Cathédrale** | Religieuse + Architecture |
| **Surréaliste** | Cosmique + Nature |
| **Apocalypse** | Bestiaire mythique + Religieuse |
| **Pastorale** | Jardin classique + Allégorie |
| **Triomphe** | Cathédrale + Allégorie |
| **Onirique** | Surréaliste + Portrait |
| **Eschatologique** | Apocalypse + Cosmique |

20 subjects total. Names + topology are taste calls — see §15 flagged-for-review.

---

## 8. Inspiration gamble

### 8.1 Mechanism

Configuration: sticky toggle **off / 10 / 100 / 1000 / 10,000** inspiration spent per canvas. When set above zero, each canvas-start spends N inspiration. If the player lacks N inspiration, the canvas runs without gambling (no penalty).

### 8.2 Resolution

Gamble runs between §6.1 (base_quality) and §6.2 (chef d'œuvre roll). Output is `gambled_quality`.

- **Base success chance:** 50%.
- **Success:** `gambled_quality = base_quality * (1 + log10(N) * 0.5)`. N=10 → ×1.5. N=100 → ×2.0. N=1k → ×2.5. N=10k → ×3.0.
- **Failure:** inspiration is consumed (lost) and `gambled_quality = max(1, floor(base_quality / 2))`.
- **No gamble (toggle off or insufficient inspiration):** `gambled_quality = base_quality`.
- **Modifiers:**
  - `gamble_success_chance_mult` (item affix) — multiplies success chance up to a 95% cap.
  - `gamble_yield_mult` (item affix) — multiplies the success quality multiplier (`1 + log10(N) * 0.5 * gamble_yield_mult`).
- **Set du Risque-tout 4-piece:** yield ×2 always + rare JACKPOT proc (×10 yield).

### 8.3 Skill tree options

- **Always-gamble toggle** (skill tree node) — adds an option to the gamble setting where each canvas auto-gambles the largest tier the player can afford, without requiring manual recalibration.
- **Gamble safety net** (skill tree node) — refunds 50% of spent inspiration on failure.

---

## 9. Skill tree — Canvas branch

New "Canvas" branch on the global (fame) skill tree. Sister to the new "Atelier" branch. **17 nodes total.**

| Node | Effect | Fame cost | Prereq |
|---|---|---|---|
| **Chef d'œuvre unlock** (anchor) | Enables the chef d'œuvre RNG (0.5% base). | 10 | none |
| **Style ceiling +5 (1)** | Style ceiling 10 → 15. | 5 | none |
| **Style ceiling +5 (2)** | Style ceiling 15 → 20. | 15 | Style ceiling +5 (1) |
| **Style ceiling +5 (3)** | Style ceiling 20 → 25. | 40 | Style ceiling +5 (2) |
| **Palette ceiling +5 (1)** | Palette ceiling 10 → 15. | 5 | none |
| **Palette ceiling +5 (2)** | Palette ceiling 15 → 20. | 15 | Palette ceiling +5 (1) |
| **Palette ceiling +5 (3)** | Palette ceiling 20 → 25. | 40 | Palette ceiling +5 (2) |
| **Subject hint (1)** | Reveal one prereq edge of an unlocked `?` placeholder. | 15 | none |
| **Subject hint (2)** | Reveal a second prereq edge (any). | 30 | Subject hint (1) |
| **Multi-canvas slot (1)** | +1 parallel canvas slot (independent of Painter Office). | 50 | none |
| **Multi-canvas slot (2)** | +1 parallel canvas slot. | 150 | Multi-canvas slot (1) |
| **Multi-canvas slot (3)** | +1 parallel canvas slot. | 400 | Multi-canvas slot (2) |
| **Gamble safety net** | Refund 50% inspiration on gamble failure. | 25 | none |
| **Always-gamble toggle** | Unlocks auto-gamble option in canvas config. | 15 | none |
| **Quality floor (1)** | +2 to `quality_floor_bonus`. | 20 | none |
| **Quality floor (2)** | +2 to `quality_floor_bonus`. | 60 | Quality floor (1) |
| **Auto-mastery passive** | All subjects gain mastery from any canvas at 25% of active-subject rate. | 75 | Subject hint (2) |

Multi-canvas slots from skill tree are additive with Painter Office worker slots (so a player with 3 workers + 2 skill-tree slots = 5 parallel canvases, modulo the global cap mentioned in §15).

---

## 10. Canvas improvement panel — content

The Improvement tab of `CanvasPopup` exposes:

| Upgrade | Currency | Cost curve |
|---|---|---|
| Tier (taille) | gold | Existing `CanvasTiers` config (100 → 1 M g per tier). |
| Style ceiling within current skill-tree-unlocked ceiling | gold | `100 * 3^(level-1)` per +1. |
| Palette ceiling within current skill-tree-unlocked ceiling | gold | `100 * 3^(level-1)` per +1. |
| Reveal one prereq hint of an eligible `?` subject | inspiration | `1000 * 2^(reveals_used)` |

The skill tree raises the *cap* on style/palette ceiling. The improvement tab raises the *current* ceiling within that cap (so per-run grind, persistent cap).

---

## 11. Items source — drops on canvas completion

> **OBSOLETE (design call 2026-04-26):** Items are now crafted only — no canvas drops. All `drop_rolled` signal/UI/test code has been removed (see HANDOVER §"Architecture decisions"). The Atelier brainstorm must redefine the items source (recipe inputs, currency cost) before the Atelier plan can be written. The text below is preserved for context only.

**This integrates the canvas into the Atelier's items-as-materials economy.** The Atelier WIP did not specify where raw items enter the inventory; this spec defines that source.

### 11.1 Drop mechanics

On every canvas auto-sale, an item drop is rolled:

```
drop_chance = 0.05 + 0.001 * quality          # 5% baseline, +0.1% per quality point
                                              # Quality 30 → 8%, quality 75 → 12.5%
```

If the drop succeeds:
- **Slot type:** uniform random among the player's atelier-level-unlocked slot types (gated by skill tree slot-unlock nodes).
- **Set affiliation:** weighted random — base 10% per of the 6 sets and 40% no-set (rare/magique items can be no-set; épique+ always carries a set tag); modified by set-targeting active.
- **Tier:** weighted by atelier level — see Atelier spec §11 (tier distribution table).
- **Affixes:** count and pool follow Atelier spec §7 (1 implicit + 2–4 random by tier).

### 11.2 Cross-system synergy

This drop model creates intentional cross-system depth:
- High-quality canvases drop more items → quality builds (chef d'œuvre, mastery, palette) feed atelier progression.
- Multi-canvas slots multiply drops → speed builds feed atelier progression.
- Set targeting (atelier paid action) raises the set-affiliation odds of the next canvas drop.

### 11.3 Drop feed UI

The PaintingView shows a small "drop feed" log at the bottom of the canvas slot area — last ~5 drops with sprite + tier color. New drops auto-route to the player's stash.

---

## 12. Multi-canvas

- **Slot sources:** Painter Office workers (each unlocked worker = +1 slot) + skill tree multi-canvas nodes (+3 max).
- **Soft cap:** **8 simultaneous canvases.** Above 8, additional sources are no-ops with a UI hint. Set de l'Atelier prolifique 4-piece grants +1 above the cap (= 9 max). See §15 — flagged for review.
- **Per-slot independence:** all slots paint the same sticky config but progress independently. Each slot rolls drops independently.
- **Affix interaction:** `parallel_canvas_efficiency` multiplies per-slot gold/PM output. Stacks multiplicatively across pieces; cap at +200% per slot (so a 5-slot player can effectively output as 15 base slots with full investment).

---

## 13. Painting view layout impact

Current `PaintingView` has 4 popup buttons. After this spec:

- **Replace** the existing `CanvasPopup` (single screen) with `CanvasPopup` containing two tabs: **Configuration** + **Improvement**.
- **Add** the canvas slot panel directly on `PaintingView` (replaces the current single-canvas progress bar): a vertical list of 1..N slot cards, each showing progress, current subject, live quality preview, drop feed.
- **Keep** the 4-button popup row (Atelier / Workshop / Painter Office / Canvas ⚙).
- The 4-popup gating from MVP (`is_possible` / `is_active` / `try_activate_mechanic`) stays — but now `Canvas ⚙` is always available once the player owns ≥1 canvas slot (= start of game).

---

## 14. Affix pool (canvas-derived) — used by Atelier items

These are the canvas-related affixes that roll on Atelier items. Full pool, slot routing, and tier ranges in `2026-04-25-atelier-design.md` §7.

**Existing (MVP):**
- `canvas_speed_mult`
- `canvas_gold_mult`
- `paint_mastery_gain_mult`

**Canvas-derived (this spec):**
- `quality_floor_bonus` — flat add to quality floor
- `style_time_reduction` — additive % time cut from style
- `palette_size_bonus` — flat add to effective palette
- `subject_mastery_gain_mult` — multiplies mastery point gain
- `chef_doeuvre_chance_mult` — multiplies chef d'œuvre RNG
- `gamble_success_chance_mult` — multiplies gamble success chance
- `gamble_yield_mult` — multiplies gamble success yield
- `parallel_canvas_efficiency` — multiplies per-slot output
- `pm_burst_chance_mult` — multiplies PM burst proc chance

**Atelier-meta (very rare, not canvas):**
- `+1 pin slot`
- `+1 stash slot`

---

## 15. Flagged for review

Initial values invented in this draft. The user is the validation gate. Two flag categories:

### 15.1 Tuning numbers (math / feel check)

- **Mastery curve (§7.2):** `200 * 2^(T-1)` XP per tier, gain `1 + floor(quality / 20)`. Tier 10 = 102k mastery points = ~10k mid-game canvases per fully-mastered subject. May be too long even for hardcore.
- **Gamble yield (§8.2):** `1 + log10(N) * 0.5`. N=10k → ×3 quality. Combined with chef d'œuvre ideal-quality + Risque-tout 4p ×2, late-game gamble can stack into ~quality 600+. Consider whether that ceiling is intended.
- **Chef d'œuvre base RNG (§6.2):** 0.5%. Atelier set + chevalet stack can push to ~5%. Verify that this feels rewarding-but-rare.
- **Time formula (§6.5):** `(tier*2 + style*1)` seconds. Tier 10 / style 25 = 45 s baseline. Verify mid-late-game pacing — may need to scale up if multi-canvas + speed mods make canvases fire too fast for the rest of the loop.
- **Drop chance (§11.1):** 5% + 0.1%/quality. Quality 75 → 12.5% per canvas. With 5 slots this means ~62% of canvases produce a drop somewhere. Verify against atelier persistence math (see Atelier §15).
- **Multi-canvas cap (§12):** 8 simultaneous, +1 with Atelier prolifique 4p. Soft cap may need adjustment based on perf + UI density.
- **Skill tree fame costs (§9):** range 5–400. Calibrate against MVP skill tree costs and fame-per-ascend rates once those are profiled.
- **Improvement panel cost curve (§10):** `100 * 3^(level-1)` per +1 ceiling. Verify against gold output curves.

### 15.2 Thematic / naming (taste check)

- **Subject names (§7.3, §7.4):** the 5 starters and 15 derived names (`Nature`, `Vie`, `Animalière`, `Bestiaire mythique`, `Eschatologique`, …). All taste calls.
- **Subject prereq graph topology (§7.4):** which two parents derive which child. Alternative topologies exist (e.g., 3-parent prereqs, asymmetric chains).
- **Skill tree node names (§9):** flavour names (`Always-gamble toggle`, `Auto-mastery passive`, …) — final names should match the project's naming voice.

### 15.3 Architectural assumption needing validation

- **Items source = canvas drops (§11).** The Atelier WIP did not specify where items enter the inventory. This spec defines it as canvas drops. **Alternative designs:** items produced by gold-cost atelier action (no seed), items produced via "raw material" sub-currency that drops from canvases, or hybrid. If the user prefers a different source, the affix pool and atelier level economy do NOT change — only the entry-point mechanism. **This is the #1 thing to validate before plan-writing.**

---

## 16. Open implementation questions for plan phase

Resolved during writing-plans, not needed in this spec:

- File layout: new `Canvas.gd` autoload? Extend existing `Canvas.gd`? Same for `Subjects.gd` registry, `Mastery.gd` per-subject tracking.
- Persistence: `Save.gd` schema additions for sticky config, mastery per subject, unlocked subjects, ceilings.
- Test surface: target ~30 GUT tests for the system (formulas, mastery progression, prereq graph, drop rolls, gamble outcomes, multi-canvas tick).
- UI scenes: `CanvasPopup.tscn` rebuilt with TabContainer; `PaintingView.tscn` adjusted for slot list + drop feed.
- `Hoverable` rollout per `2026-04-25-info-panel-design.md` §6 — every interactive element in CanvasPopup gets one.

---

## 17. Definition of done

- All 17 skill tree Canvas branch nodes added to `SkillTreeNodes.gd` and rendered.
- Style and palette sliders functional, capped by ceiling (improvement-tab + skill-tree).
- Subject system: 20 subjects defined, prereq graph evaluated on every mastery-tier-up, hidden until half-prereq, `?` placeholders revealed by hints.
- Quality / chef d'œuvre / gold / PM / time formulas in `Balance.gd`, all 9 canvas-derived affixes implemented.
- Drop system on canvas completion with weighted slot/set/tier roll.
- Auto-sale state machine confirmed (no idle ready-to-sell).
- Multi-canvas: N slots tick independently, each rolls drops, hard cap 8.
- Gamble: 5 sticky levels, success/fail formulas, safety net + always-gamble nodes.
- All formulas covered by GUT tests (target 30+ new tests).
- Hover info wired (§6 of info-panel spec) on every interactive element.
- 156 prior tests still pass.
