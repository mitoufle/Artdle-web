import type { StateCreator } from "zustand";
import { big, type Big } from "@/core/bigNumber";
import type { GameStore } from "@/store";
import { rollCandidate, type Candidate } from "@/core/officeRoll";
import type { ClassId } from "@/config/officeClasses";
import type { WorkerTier } from "@/core/balance";
import type { Affix } from "@/core/workshopRoll";
import { hasCapability, countCapability } from "@/store/skillTreeSlice";
import { OFFICE_CLASSES } from "@/config/officeClasses";
import { OFFICE_TIER_UNLOCK_LEVEL, ALL_WORKER_TIERS, trickleSeconds, hireCost, workerXpToNext, officeXpToNext, XP_GOLD_FRACTION } from "@/core/balance";
import { getWorkerXpMultiplier, getHireCostMultiplier } from "@/core/multipliers";
import { AFFIX_MAGNITUDE_RANGE } from "@/config/workshopAffixes";

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
  if (state.officeLevel <= 0) return "common";
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

export const getHireCost = (
  state: Pick<GameStore, "officeLevel" | "purchasedNodes">,
  candidate: { tier: WorkerTier; affixes: ReadonlyArray<Affix> },
): Big => {
  let magnitudeSum = 0;
  let minMagnitudeSum = 0;
  let maxMagnitudeSum = 0;
  for (const a of candidate.affixes) {
    magnitudeSum += a.magnitude;
    minMagnitudeSum += AFFIX_MAGNITUDE_RANGE["normal"][a.kind].min;
    maxMagnitudeSum += AFFIX_MAGNITUDE_RANGE["normal"][a.kind].max;
  }
  const base = hireCost(
    { tier: candidate.tier, magnitudeSum, minMagnitudeSum, maxMagnitudeSum },
    state.officeLevel,
  );
  return base.mul(getHireCostMultiplier(state as GameStore));
};

const LEVEL_UP_CAP = 1000;

function applyLevelUps(
  level: number,
  xp: Big,
  xpToNextFn: (level: number) => number,
  warnTag: string,
): { level: number; xp: Big } {
  let i = 0;
  for (; i < LEVEL_UP_CAP; i++) {
    const cost = xpToNextFn(level);
    if (xp.lt(cost)) break;
    xp = xp.sub(cost);
    level += 1;
  }
  if (import.meta.env.DEV && i === LEVEL_UP_CAP) {
    console.warn(`${warnTag} hit ${LEVEL_UP_CAP}-level cap; still has unspent XP. Remainder will resolve on next sale.`);
  }
  return { level, xp };
}

function applyWorkerLevelUps(worker: Worker): Worker {
  const { level, xp } = applyLevelUps(worker.level, worker.xp, workerXpToNext, `worker ${worker.id}`);
  return { ...worker, level, xp };
}

function applyOfficeLevelUps(currentLevel: number, currentXp: Big): { level: number; xp: Big } {
  return applyLevelUps(currentLevel, currentXp, officeXpToNext, "office");
}

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
  hireFromQueue: (candidateId: string): boolean => {
    const state = get();
    if (state.roster.length >= getRosterCap(state)) return false;
    const candidate = state.queue.find((c) => c.id === candidateId);
    if (!candidate) return false;
    const cost = getHireCost(state, candidate);
    if (state.gold.lt(cost)) return false;

    const worker: Worker = {
      id: candidate.id,
      class: candidate.class,
      tier: candidate.tier,
      level: 1,
      xp: big(0),
      // Shared ReadonlyArray ref — neither side mutates. Don't defensive-copy.
      affixes: candidate.affixes,
    };
    set({
      gold: state.gold.sub(cost),
      roster: [...state.roster, worker],
      queue: state.queue.filter((c) => c.id !== candidateId),
    });
    get().incrementStat("lifetime", "officeWorkersHired");
    get().evaluateAchievements();
    return true;
  },
  rejectFromQueue: (candidateId: string): boolean => {
    const state = get();
    if (!state.queue.find((c) => c.id === candidateId)) return false;
    set({ queue: state.queue.filter((c) => c.id !== candidateId) });
    return true;
  },
  fireWorker: (workerId: string): boolean => {
    const state = get();
    if (!state.roster.find((w) => w.id === workerId)) return false;
    set({ roster: state.roster.filter((w) => w.id !== workerId) });
    return true;
  },
  awardOfficeXp: (goldSold: Big) => {
    const state = get();
    const n = state.roster.length;
    // Spec §4.3: Office Level is emergent from roster activity. No roster, no progression.
    if (n === 0) return;
    const xpMult = getWorkerXpMultiplier(state);
    const pot = goldSold.mul(XP_GOLD_FRACTION).mul(xpMult);
    if (pot.lte(big(0))) return;

    const newRoster = state.roster.map((w) => {
      const share = pot.div(n);
      return applyWorkerLevelUps({ ...w, xp: w.xp.add(share) });
    });

    const officeAfter = applyOfficeLevelUps(state.officeLevel, state.officeXp.add(pot));

    set({
      roster: newRoster,
      officeXp: officeAfter.xp,
      officeLevel: officeAfter.level,
    });
  },
  resetOffice: () => {
    set({
      queue: [],
      roster: [],
      trickleTimer: 0,
    });
  },
});
