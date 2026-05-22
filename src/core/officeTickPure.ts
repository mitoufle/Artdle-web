import { trickleSeconds } from "@/core/balance";
import { rollCandidate, type Candidate } from "@/core/officeRoll";
import type { DraftState } from "@/core/pureMutations";
import { getQueueCap } from "@/store/officeSlice";

export function officeTickPure(draft: DraftState, delta: number): void {
  if (delta <= 0) return;
  const queueCap = getQueueCap(draft);
  if (queueCap <= 0) return;
  if (draft.queue.length >= queueCap) return;

  const period = trickleSeconds(draft.officeLevel);
  let timer = draft.trickleTimer + delta;
  const newCandidates: Candidate[] = [];
  let queueSize = draft.queue.length;

  while (timer >= period && queueSize < queueCap) {
    timer -= period;
    newCandidates.push(rollCandidate(draft.officeLevel, draft));
    queueSize += 1;
  }

  draft.queue = [...draft.queue, ...newCandidates];
  draft.trickleTimer = timer;
}
