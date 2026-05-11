import type { StateCreator } from "zustand";
import { big, type Big } from "@/core/bigNumber";
import type { GameStore } from "@/store";
import { rollCandidate, type Candidate } from "@/core/officeRoll";
import type { ClassId } from "@/config/officeClasses";
import type { WorkerTier } from "@/core/balance";
import type { Affix } from "@/core/workshopRoll";
import { hasCapability, countCapability } from "@/store/skillTreeSlice";
import { OFFICE_CLASSES } from "@/config/officeClasses";
import { OFFICE_TIER_UNLOCK_LEVEL, ALL_WORKER_TIERS, trickleSeconds } from "@/core/balance";

export interface Worker {
  readonly id: string;
  readonly class: ClassId;
  readonly tier: WorkerTier;
  readonly level: number;
  readonly xp: Big;
  readonly affixes: ReadonlyArray<Affix>;
}

export interface OfficeState {
  readonly officeLevel: number;
  readonly officeXp: Big;
  readonly queue: ReadonlyArray<Candidate>;
  readonly roster: ReadonlyArray<Worker>;
  readonly trickleTimer: number;
}

export const initialOfficeState: OfficeState = Object.freeze({
  officeLevel: 0,
  officeXp: big(0),
  queue: Object.freeze([]) as ReadonlyArray<Candidate>,
  roster: Object.freeze([]) as ReadonlyArray<Worker>,
  trickleTimer: 0,
}) as OfficeState;

export interface OfficeSlice extends OfficeState {
  tickOffice: (deltaSeconds: number) => void;
  hireFromQueue: (candidateId: string) => boolean;
  rejectFromQueue: (candidateId: string) => boolean;
  fireWorker: (workerId: string) => boolean;
  awardOfficeXp: (goldSold: Big) => void;
  resetOffice: () => void;
}

/** Max number of hired workers. Sums fame-node levels with the `roster_slot` tag. */
export const getRosterCap = (state: GameStore): number =>
  countCapability(state, "roster_slot");

/** Max number of waiting candidates in the queue. Sums fame-node levels with `queue_slot`. */
export const getQueueCap = (state: GameStore): number =>
  countCapability(state, "queue_slot");

/** Highest tier that can roll in the queue at the player's current office level. */
export const getOfficeTierCap = (state: GameStore): WorkerTier => {
  let cap: WorkerTier = "common";
  for (const t of ALL_WORKER_TIERS) {
    if (state.officeLevel >= OFFICE_TIER_UNLOCK_LEVEL[t]) cap = t;
  }
  return cap;
};

/** Whether the class can roll for new candidates (capability-gate check). */
export const getClassUnlocked = (state: GameStore, classId: ClassId): boolean => {
  const cap = OFFICE_CLASSES[classId].capability;
  if (cap === null) return true;
  return hasCapability(state, cap);
};

export const createOfficeSlice: StateCreator<GameStore, [], [], OfficeSlice> = (set, get) => ({
  ...initialOfficeState,

  tickOffice: (delta: number) => {
    if (delta <= 0) return;
    const state = get();
    const queueCap = getQueueCap(state);
    if (queueCap <= 0) return;
    if (state.queue.length >= queueCap) return;

    const period = trickleSeconds(state.officeLevel);
    let timer = state.trickleTimer + delta;
    const newCandidates: Candidate[] = [];
    let queueSize = state.queue.length;

    while (timer >= period && queueSize < queueCap) {
      timer -= period;
      newCandidates.push(rollCandidate(state.officeLevel, state));
      queueSize += 1;
    }

    set({
      queue: [...state.queue, ...newCandidates],
      trickleTimer: timer,
    });
  },
  hireFromQueue: (_id: string) => false,
  rejectFromQueue: (_id: string) => false,
  fireWorker: (_id: string) => false,
  awardOfficeXp: (_g: Big) => {
    // Stub — implemented in Task 12.
  },
  resetOffice: () => {
    set({
      queue: [],
      roster: [],
      trickleTimer: 0,
    });
  },
});
