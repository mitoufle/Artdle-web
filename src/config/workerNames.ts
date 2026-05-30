/**
 * First names of famous, non-controversial painters. Workers draw a random name
 * from this pool at spawn (cosmetic only — see officeSlice.createWorker).
 */
export const WORKER_NAME_POOL = [
  "Vincent", "Claude", "Frida", "Georgia", "Rembrandt",
  "Henri", "Berthe", "Mary", "Wassily", "Piet",
  "Hilma", "Yayoi", "Artemisia", "Jan", "Joan",
  "Edvard", "Camille", "Paul", "Élisabeth", "Grant",
] as const;
