# The Lab — Brainstorm Notes (deferred)

_Date: 2026-05-17 — Partial brainstorm, deferred before design phase._

---

## Decisions made

| Topic | Decision |
|---|---|
| **What the Lab is** | A new room/panel (like Workshop, Office, School). Provides permanent bonuses via a living pigment hatchery. |
| **Bonus model** | Pure consume — pigments in slots are inventory only, no active bonus. All value comes from consumption. Consumed bonuses add permanently to the Lab's bonus pool. |
| **Ascend semantics** | Everything survives ascensions — bonus pool, pigments in slots, unlocked slots. Meta-progression like PM and School. |
| **T1 generation** | Passive, automatic. Lab generates T1 pigments over time. Traits are random within the type's range. If all slots are full, generation pauses. |
| **Breeding / merge** | Same action. Select 2 same-tier pigments → timer → offspring. Parents consumed. T1+T1 → T2, T2+T2 → T3. |
| **Genetics** | Magnitude blending + mutation. Offspring inherits parent trait magnitudes (average ± variance). Small % chance per breed to mutate → new trait emerges. |
| **T1 trait structure** | Each T1 type has exactly 1 fixed trait. All pigments of the same type share the same trait kind; only magnitudes vary between individuals. |
| **Cross-type breeding** | Not possible at T1. T1+T1 must be same type. Trait diversity only via mutation. At T2+, any same-tier pair can breed (since mutation may have diverged traits). |
| **Slot progression** | Consuming pigments unlocks additional slots (internal Lab progression, self-contained). |
| **Bonus integration** | `getLabBonus(state, kind)` in `multipliers.ts` — same pattern as school, workshop, achievement bonuses. |
| **Designer** | Yes — `/dev/lab-designer`, same pattern as school/skill tree/achievement designers. Defines T1 types, trait kinds, magnitude ranges, timers, mutation probability, slot thresholds. |

---

## Open questions (deferred)

1. **Simultaneous breeds or one at a time?** — architecturally significant for the slice state shape.
2. **Unlock gate** — when does the player get Lab access? Fame node? School tier? Available from start?
3. **Consume formula** — what value does a T1/T2/T3 consume give? Shape of the curve (even if exact numbers come from balance pass).
4. **Balance parameters** — T1 generation rate, breeding timers per tier, mutation probability %, slot unlock thresholds, starting slot count.
5. **Number of T1 types** — breadth of the trait pool (content design → designer).

---

## UI sketch (discussed)

- New "Lab" room in the nav bar
- Grid of pigment slots (current pigments, states: occupied / breeding / empty)
- Generation progress bar (time to next T1)
- Breeding panel: select 2 pigments → breed button → active timer
- Bonus pool display: accumulated permanent bonuses
- Slot unlock progress bar
