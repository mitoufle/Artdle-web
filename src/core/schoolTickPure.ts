import { incrementStatPure, type DraftState } from "@/core/pureMutations";

export function schoolTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;
  if (!draft.activeResearch) return;
  const next = draft.activeResearch.remainingSeconds - deltaSeconds;
  if (next > 0) {
    draft.activeResearch = { ...draft.activeResearch, remainingSeconds: next };
    return;
  }
  draft.completedResearches = { ...draft.completedResearches, [draft.activeResearch.id]: true };
  draft.activeResearch = null;
  incrementStatPure(draft, "lifetime", "schoolResearchesCompleted");
  incrementStatPure(draft, "run", "schoolResearchesCompleted");
}
