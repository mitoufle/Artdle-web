let _seed = Date.now() | 0;

export function setSeed(seed: number): void {
  _seed = seed | 0;
}

/** mulberry32 — deterministic, fast, well-distributed. Returns [0, 1). */
export function rng(): number {
  _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform integer in [min, max] inclusive. */
export function rngInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Uniform float in [min, max). */
export function rngFloat(min: number, max: number): number {
  return rng() * (max - min) + min;
}

/** Pick a uniformly-random element from a non-empty array. */
export function rngPick<T>(arr: ReadonlyArray<T>): T {
  if (arr.length === 0) throw new Error("rngPick: empty array");
  const idx = rngInt(0, arr.length - 1);
  return arr[idx]!;
}
