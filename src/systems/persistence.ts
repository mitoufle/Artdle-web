import { get, set, del } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

/**
 * Storage interface compatible with Zustand's `createJSONStorage`.
 * Future RemoteSyncAdapter (v3.x) implements the same shape: read from IDB, push to server.
 */
export type SaveAdapter = StateStorage;

export const idbAdapter: SaveAdapter = {
  getItem: async (name: string): Promise<string | null> => {
    const v = await get<string>(name);
    return v ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};
