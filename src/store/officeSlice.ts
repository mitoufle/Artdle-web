import type { StateCreator } from "zustand";
import { big, type Big } from "@/core/bigNumber";
import type { GameStore } from "@/store";
import type { Candidate } from "@/core/officeRoll";
import type { ClassId } from "@/config/officeClasses";
import type { WorkerTier } from "@/core/balance";
import type { Affix } from "@/core/workshopRoll";

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

export const createOfficeSlice: StateCreator<GameStore, [], [], OfficeSlice> = (set, _get) => ({
  ...initialOfficeState,

  tickOffice: (_delta: number) => {
    // Stub — implemented in Task 9.
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
