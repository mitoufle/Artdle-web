# Artdle Web — Code Review, Security Companion (2026-06-02)

**Companion to `docs/CODE_AUDIT-2026-06-02.md`.** That audit read the engine/store/systems
layer in depth but explicitly skipped the **security surface** and spot-checked the UI only.
This document (a) corrects the status of the prior audit's findings against current code,
(b) adds the security review it omitted, and (c) sharpens the still-open functional/design
items. Findings are severity-sorted.

> **Two items here were fixed the same session this was written** (commit `a3994d0`): the
> `report-bug` rate limit (S1) and the CLAUDE.md offline-cap doc drift (part of F1). They are
> marked **[FIXED a3994d0]** inline and kept in the record for traceability.

---

## 0. Status of the prior audit (read this first)

The prior audit (`CODE_AUDIT-2026-06-02.md`, committed `f2cd310`) is partly stale against its
own repo — it cites a ~700-line `store/index.ts` (migration "149–401", `tickAll` "line 684");
the current file is **421 lines**.

| Prior audit § | Verdict now |
|---|---|
| **§2 Dead migration code (~255 lines)** | **Already closed** in `c20fbd3` — one commit *before* the audit was committed. `store/index.ts:90` is the collapsed `if (fromVersion < 23) return {}` with a comment dating the removal to 2026-06-02. The audit recommends a shipped fix; don't action it. (An ironic instance of the §8 doc-drift it flags.) |
| §1 JSON⇄TS dual source of truth | **Open.** |
| §3 5×`set()`/frame + cherry-pick returns | **Open** — confirmed live in `canvasSlice.canvasTick:132–146` (~14 fields hand-listed) and `workshopSlice.performCraft:214`. |
| §4 Multi-painter scheduler not step-invariant | **Open, and now load-bearing** (see F1). |
| §5 Global mutable RNG | **Open.** |
| §6 `tsc -b` gating blind spot | **Open.** |

§1/§5/§6 substance is unchanged and not re-derived here.

---

## CRITICAL / HIGH — Security (new; prior audit skipped this layer)

### S1 (HIGH). `api/report-bug.ts` — unauthenticated GitHub-issue proxy  **[partially FIXED a3994d0]**
The only real server-side code in the repo. It accepts any `POST` and creates a GitHub issue
using a server-held `GITHUB_TOKEN`.

- **Correct by design (keep):** the token is server-side only, read from `process.env`, never
  returned to the client, and a Vercel *Sensitive* var. Length caps (30k/200) exist.
- **The hole (pre-fix):** no auth, no rate limit, no CORS/origin check, no captcha. Anyone
  could loop `curl` against it. Impact scales with repo visibility (`mitoufle/Artdle-web`):
  public → public issue spam + GitHub REST quota (5k/hr) exhaustion → legitimate reports start
  returning `502`; private → mention/notification spam + quota exhaustion.
- **Sub-issues:** the `description` is injected into the issue body *unfenced*
  (`bugReport.ts:issueBody` fences only the JSON context), so markdown/`@mentions` render;
  `title`/`body` were typed `string?` but never runtime-checked, so `title: 123` passed the
  guards.
- **[FIXED a3994d0]:** added best-effort in-memory rate limiting (per-IP sliding window 5/10min
  + global 60/hour token-quota guard), a same-origin guard (rejects cross-origin browser POSTs;
  no-Origin requests fall through to the limiter), and strict `typeof === "string"` validation.
  Verified live: cross-origin POST → `403`, `GET` → `405`.
- **Still open (durable fix):** the limiter is **per-instance** (resets on cold start, each
  concurrent Fluid Compute instance keeps its own copy). The real fix is a shared store
  (Vercel KV / Upstash Redis) keyed by IP. Do this if abuse shows up in the issue tracker.

### S2 (MEDIUM, situational). Dev design-writer endpoints + public tunnel
`vite.config.ts` registers three `configureServer` middlewares — `/api/skill-design`,
`/api/school-design`, `/api/achievement-design` — that write **attacker-controlled JSON to
fixed `src/config/*.json` paths with no auth**. These are **dev-only** (`configureServer`
doesn't run in the prod build; prod ships only `api/report-bug.ts`), so production is safe.

The risk is the local workflow: the dev server is tunneled publicly (per the
`feedback_dev_server_remote` workflow), and `server.allowedHosts: true` disables Vite's
DNS-rebinding/host-header guard. **While a tunnel is up, any visitor — or any site the
developer browses, via DNS rebinding — can POST and overwrite those three repo files.** Fixed
paths mean no traversal, but content is fully attacker-controlled (and may then be committed).
**Direction:** replace `allowedHosts: true` with an explicit host allowlist; gate the writer
middlewares behind a shared-secret header; or don't tunnel a server that has filesystem-write
endpoints.

### S3 (LOW). Single-player self-cheat (grouped — not a vulnerability)
The `__artdle` console object exposed in **production** (`main.tsx:30–38`: `store` + `setState`
+ `catchup`), the client-editable IDB save, and clock-forward offline gain are one class: **the
client is the authority, there is no server state to defraud, the player can only cheat
themselves.** Acceptable for a local idle game (the `main.tsx` comment acknowledges it).
Revisit **only** if leaderboards/accounts ship (deferred per PORT_PLAN).

---

## HIGH — Functional

### F1 (HIGH). Uncapped offline + per-step sale clip ⇒ offline < online  **[docs part FIXED a3994d0]**
Two halves of one defect:

1. **The "24h cap" was fiction.** CLAUDE.md said "24h-capped"; there is no cap —
   `runCatchupSimulation` only does `Math.max(0, elapsed)` (`catchup.ts:53`), and the offline
   spec deliberately chose *no cap*. **[FIXED a3994d0]:** CLAUDE.md now describes the uncapped
   adaptive-delta catch-up and its approximation caveat. (Code behavior unchanged — this was
   the doc.)
2. **The clip bites at large steps.** Long absences run at `chooseDelta` = 60s steps. At 60s
   with high throughput, `MAX_SALES_PER_TICK = 1000` (`canvasTickPure:23`) is reachable; when
   the loop breaks on it (`canvasTickPure:150`), the remaining `budget` is **silently
   discarded and clocks aren't advanced** on that path — lost gold an online player would have
   earned. This compounds the prior audit's §4 step-invariance gap (float tie-break drift makes
   offline crit/combo diverge from online non-deterministically).
3. **Unbounded boot sim.** A multi-week absence is millions of 60s steps × the inner sale loop
   — a potentially multi-minute boot simulation with no upper bound.

**Direction (matches prior §4):** rebuild the scheduler on **absolute next-stroke times** in a
priority queue (step-invariant by construction, no epsilon), make the throughput cap a *clip of
simulated time* (advance clocks, then stop) rather than a silent budget drop, and decide a real
elapsed cap (even a generous 7-day bound limits the worst case). A fix is complete only when
{gold, crits, maxCombo, per-worker strokes} all match across step sizes.

---

## MEDIUM / LOW — Functional / robustness

### F2 (MED). Live tick commits 5× per frame via hand-maintained allowlists (prior §3)
`tickAll` runs five slice ticks, each its own `set()` returning a hand-listed subset of `draft`
(`canvasSlice:132–146` ~14 fields; `workshopSlice:214` 6 fields). Any pure-tick that begins
writing a field not on the list is **silently dropped** — the exact regression class the
handover keeps hitting (`museBurstTimer`, school fields, "Pick fan-out"). Meanwhile
`catchup.ts` already does the right thing: one draft, all five pure ticks, **one `setState`**.
Live and offline use the same pure functions but opposite commit strategies — a latent gap.
**Unify the live tick on the catchup pattern** (clone once, run all ticks, commit once).

### F3 (MED). `partialize` drops in-flight accumulators
`store/index.ts:397–412` excludes `collaborativeStrokeAcc` and `museBurstTimer` as "transient,"
but the first is a research-speed carry-over accumulator and the second is an active timed buff
— both are real progress. On reload you lose ≤10 banked strokes and any active Muse Burst.
Either persist them or document the loss as intended.

### F4 (LOW). `fuseItem` spends gold before its last validation
`workshopSlice:290` spends gold, then `:295` returns false if `targetSlot` isn't found (no
refund). Unreachable in practice (`getFusionTarget` returns an item that is in
`state.equipped`, so the slot is always found), so this is fragile ordering, not a live bug.
Validate fully, then spend. The currency primitives (`currencySlice` `spend`/`add`) are sound —
they guard negatives and insufficient funds correctly.

---

## Design challenges ("are the bases solid?")

1. **Two sources of truth (prior §1) is the right first target.** By the handover's own record
   it's the single largest source of *shipped* bugs (constellation desync `4f33733`,
   cross-cluster pile-up, recurring "edit BOTH files" warnings). The agreement tests detect
   drift instead of preventing it. Effects are *already* data-driven via the capability-tag
   system (keep it); only the node graph + geometry are hand-transcribed. **Generate**
   `skillTreeNodes.ts`/`skillClusters.ts` from the JSON at build, or read the graph from JSON
   directly. Pick one source.
2. **The global RNG (prior §5) is accidental complexity.** The "preview must NOT consume the
   RNG" machinery in `workerAscend.ts` exists *only* because one process-global stream is
   shared across crit/combo/workshop/ascend — and the seed isn't even persisted, so you pay for
   determinism infrastructure without getting determinism. Either thread a seeded, persisted
   stream (and let previews fork a throwaway), or accept non-determinism and delete the
   gymnastics.
3. **`tsc -b` blind spot (prior §6).** Root `tsconfig.json` is a `files: []` references stub, so
   `tsc -p` checks nothing; only `tsc -b`/`vite build` are real, and ~25 baseline errors live in
   test files, ungated. **Note:** `api/` is in *no* tsconfig at all, so the serverless function
   is type-checked only by Vercel at deploy time, not locally. Add both to a CI gate.
4. **No CI is the meta-issue.** Deploy is `npx vercel --prod` from the working dir, so
   imported-but-untracked assets "work" only because Vercel uploads local files (a fresh clone
   fails to build, per HANDOVER). Tests, `tsc -b`, the JSON⇄TS agreement guards, and `api/`
   typing are all manual. A minimal GitHub Action (`vitest` + `tsc -b` + build-from-clean-clone
   + `tsc` over `api/`) would catch the recurring "untracked asset" and "JSON⇄TS desync"
   failures before prod.

---

## Severity summary

| # | Severity | Finding | Status |
|---|---|---|---|
| S1 | **HIGH** | `report-bug.ts` unauthenticated → issue/quota spam | Rate limit shipped `a3994d0`; durable KV fix open |
| F1 | **HIGH** | Uncapped offline + 1000-sale/step clip → offline<online + unbounded boot sim | Docs fixed `a3994d0`; scheduler fix open |
| S2 | MED (situational) | Dev write-endpoints + public tunnel + `allowedHosts:true` → repo file overwrite | Open |
| F2 | MED | 5×`set()`/frame cherry-pick allowlists → silent dropped mutations (prior §3) | Open |
| F3 | MED | `partialize` drops real accumulators (`collaborativeStrokeAcc`, `museBurstTimer`) | Open |
| S3 | LOW | Single-player self-cheat (`__artdle` prod console, editable save, clock) | Accepted |
| F4 | LOW | `fuseItem` spends before last validation (unreachable, fragile) | Open |

**Genuinely solid — don't "fix":** the capability-tag effect system, the
`CanvasMultiplierInputs` `Pick<>` guard, `pureMutations` copy-on-write, the throttled IDB
adapter (≤1s loss bound, zero-loss on graceful close), and UI selector discipline. The bases
*are* mostly solid; the gaps are (1) one open external endpoint (now rate-limited), (2) the
offline path being a non-deterministic, occasionally-lossy approximation of the live path, and
(3) the absence of CI enforcement around an otherwise disciplined codebase.

### Suggested order of attack
1. **S2 dev-tunnel hardening** — cheap, removes a live-while-tunneling risk.
2. **F1 absolute-time scheduler + elapsed cap** — correctness for offline players with workers.
3. **§1 JSON→TS codegen** — highest bug-prevention ROI; skill tree first.
4. **F2 single-draft live tick** — adopt the catchup pattern; removes a live bug class.
5. **CI gate (incl. `api/` typing)** + **S1 durable KV limiter** — close the enforcement gaps.
