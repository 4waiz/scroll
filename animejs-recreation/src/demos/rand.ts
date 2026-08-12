/**
 * Deterministic PRNG.
 *
 * The lens demos use randomised layouts, but the Playwright visual suite has to
 * produce byte-comparable frames. Every demo therefore seeds its own stream
 * instead of touching Math.random() or anime's utils.random().
 */

/** mulberry32 - small, fast, good enough distribution for layout jitter. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform float in [min, max). */
export function rand(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Uniform integer in [min, max]. */
export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

/** Pick one element deterministically. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}
