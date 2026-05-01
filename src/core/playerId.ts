import { v4 as uuidv4 } from "uuid";

/**
 * Generate a fresh playerId. Used by the meta slice initializer.
 * The slice initializer's value gets overwritten by persist rehydration if a saved playerId exists.
 */
export function newPlayerId(): string {
  return uuidv4();
}

/**
 * Validate a string is a UUID v4.
 * Loose check: matches the v4 shape; accepts upper or lower case.
 */
export function isPlayerId(s: unknown): s is string {
  if (typeof s !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}
