# Cluster authoring → runtime wiring handoff

The skill designer (`/dev/skill-designer`) lets the user author clusters into
`src/config/skillTreeDesign.json` (`clusters[]`). These are a SPEC. The game reads
the hand-coded `SKILL_CLUSTERS` in `src/config/skillClusters.ts`. After the user
saves a new/edited cluster, an agent reconciles them:

1. Read `clusters[]` from `skillTreeDesign.json`.
2. For each cluster, add/update the entry in `skillClusters.ts` using the JSON's
   `id`, `name`, `theme`, `rootNodeId`, `region`, plus:
   - `completionBonus: "cluster_<id>_complete"` (a placeholder capability tag),
   - `completionArtPath: null`.
3. Reconcile node `clusterId`s in `skillTreeNodes.ts` to match the JSON
   (`skillTreeDesign.json` is the source for node→cluster assignment).
4. Run these and confirm green:
   - `npx vitest run tests/dev/skill-designer/clusterGuard.test.ts` (TS ⇄ JSON agree on id/name/root/region)
   - `npx vitest run tests/config/skillClusters.test.ts` (one root per cluster, no cross-cluster edges, JSON↔TS node agreement)
   - `npx tsc -b` (clean)

`completionBonus` effects (what the bonus actually DOES) remain a separate, manual
gameplay task — the tag exists and resolves via `hasCapability`, but no multiplier
consumes it yet.
