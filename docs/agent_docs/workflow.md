# Workflow

How to actually build this thing — turn plans into shipped code without burning out reviewers.

## The cycle

```
brainstorm  →  spec      →  plan       →  execute    →  finish
(human +)     (writing-     (writing-     (subagent-    (review +
              spec skill)   plans skill)  driven-dev)   merge)
```

For Artdle web v1, the brainstorm and v1 spec already happened (see `docs/PORT_PLAN.md`). The first plan exists (`docs/superpowers/plans/2026-05-01-artdle-web-phase0-1.md`). What follows: execute the plan, then write the next plan (Phase 2), then execute, etc.

## Subagent-driven development

The user prefers this workflow. Per the **superpowers:subagent-driven-development** skill: dispatch one subagent per plan task, review the result, dispatch the next.

**Why:** keeps the main session's context clean (subagents do the verbose work, return concise summaries), allows parallelism for independent tasks, and makes per-task review the natural review boundary.

**When dispatching:** include the task's exact text from the plan, the relevant file paths, the relevant tests, and any cross-task context the subagent needs (e.g., "Task 14 imports from `@/core/bigNumber.ts` which Task 13 just created — see its actual interface").

**Don't:** dispatch a subagent with just "implement Task 5 from the plan." Subagents start cold; they need the full task text or they'll guess.

**After each subagent returns:**
1. Verify the diff (read the actual changes — don't trust the summary).
2. Run the tests (don't trust the summary).
3. Run `npx tsc -b --noEmit` (catches type errors the subagent may have missed).
4. Mark the task complete in the plan (check the `- [ ]` boxes).
5. Commit if not already committed.
6. Dispatch the next task.

## When to call advisor

The advisor is a stronger reviewer that sees the full conversation. Per the harness's advisor doc:

- **Before substantive work** — before writing a plan, before committing to an interpretation.
- **When stuck** — errors recurring, approach not converging.
- **When considering a change of approach** — before deviating from the plan.
- **When declaring done** — before claiming a major milestone is complete.

The advisor takes time. Make the deliverable durable (write the file, commit) BEFORE calling advisor — if the session ends during the call, durable work persists.

## When the plan is wrong

Plans are written upfront and don't always survive contact with reality. If a task's instructions don't match the codebase state (e.g., the plan says "modify `src/core/foo.ts` line 23" but the file is shaped differently than the plan assumed):

1. **Stop. Don't improvise.**
2. Read the actual file.
3. Decide: is the plan wrong, or is the prior task incomplete?
4. If the plan is wrong: update the plan inline (add a note explaining the deviation), commit the plan change, then proceed.
5. If the prior task was incomplete: re-dispatch it.

**Don't silently deviate from the plan.** Future-you reading the plan won't know what actually shipped.

## When tests fail

The plan ships with green tests. If a test fails after a task:

1. Read the actual error message.
2. Run the test in isolation (`npm test -- tests/path/to/test.ts`) to confirm.
3. Determine: is it the test or the implementation?
4. If implementation: fix it, commit fix.
5. If test: rewrite the test to match the new contract, commit, note in the commit message that the contract changed.

**Don't disable a failing test to make CI green.** Fix the underlying issue.

## Verification before completion

Before claiming a phase is done:

```bash
npm test                         # all green
npx tsc -b --noEmit              # no type errors
npm run lint                     # no lint errors
npm run build                    # production build works
git status                       # clean working tree
git log --oneline | head -20     # recent commits make sense
```

If any of these fail, the phase is not done. Fix and re-verify.

## Handover discipline

After every major milestone (phase complete, before context window is at risk, before stopping for the day):

1. Update `docs/HANDOVER.md` with current state.
2. Commit (`docs(handover): refresh after Phase N`).

The HANDOVER.md is what a fresh Claude session reads first to know "where are we." Don't let it accrete history — overwrite the snapshot.

## When stuck

If you've tried a fix three times and it's not working:

1. Stop. Don't try variant #4.
2. Use the **superpowers:systematic-debugging** skill.
3. Or call the advisor.
4. Or ask the user.

Three failed attempts means the model of the problem is wrong, not the fix.

## Dispatching parallel work

When two tasks are independent (no shared state, no sequential dependency), dispatch them in parallel — single message, multiple subagent calls. Per the **superpowers:dispatching-parallel-agents** skill.

**Common parallelizable cases:**
- Multiple independent slice + test pairs (e.g., currencySlice and hoverInfoSlice are independent).
- Multiple unrelated formula additions to `balance.ts` (each with its own test).
- Lint fixes across files that don't share imports.

**Not parallelizable:**
- Tasks that touch the same file.
- Tasks where Task B imports from a file Task A creates.
- Tasks that share global state changes (e.g., adding a new package both need).

## Plan execution etiquette

- **Read CLAUDE.md and HANDOVER.md before starting.** They're the entry points.
- **Read the plan's preamble.** Goal, architecture, file structure, tech stack — these set context for every task.
- **Don't read the whole plan upfront** if it's long. Read the next 1-2 tasks; trust the structure.
- **Mark tasks complete as you finish them**, not in batch.
- **Commit per task at minimum**, more often is fine.
- **Don't squash plan execution commits.** The history is the audit trail.
