/**
 * Declarative scene states, keyed by global scroll progress.
 *
 * Everything the WebGL stage does is a pure function of one number, `p`, the
 * progress through the sticky stage track. Nothing is a one-shot tween, which
 * is what makes scrolling back up retrace exactly. Adjacent keyframes are
 * blended, so the model never jumps between sections either.
 *
 * Camera values use the model-relative (tilt, roll, radius) frame described in
 * REFERENCE_NOTES.md section 9.
 */

import type { PartGroup } from './loadModel';
import type { MaterialMode } from './materials';
import { PALETTE } from '../content';

export type ExplodeMap = Partial<Record<PartGroup, number>>;

export interface SceneState {
  /** page/scene background colour */
  bg: string;
  /** camera, model-relative spherical */
  tilt: number;
  roll: number;
  /** rotation about the camera's own view axis - the on-screen angle */
  camRoll: number;
  radius: number;
  fov: number;
  target: [number, number, number];
  /** pivot transform, degrees for rotation */
  rot: [number, number, number];
  pos: [number, number, number];
  scale: number;
  material: MaterialMode;
  /** per-group exploded travel, in model units */
  explode: ExplodeMap;
  /** per-group extra spin about the barrel axis, degrees */
  spin: ExplodeMap;
  ledIntensity: number;
  tickColor: string;
  /** opacity of the in-lens DOM overlay */
  lens: number;
  /** opacity of the toolbox leader lines + labels */
  labels: number;
  /** opacity of the modular section's floating per-part KB labels */
  partLabels: number;
  /** whole-model opacity, used to fade the engine out before the docs grid */
  modelOpacity: number;
}

export interface Keyframe extends SceneState {
  p: number;
}

const NONE: ExplodeMap = {};

const base: Omit<SceneState, 'bg' | 'material'> = {
  tilt: 0, roll: 0, camRoll: 0, radius: 14.8, fov: 32, target: [0, 0, 0],
  rot: [0, 0, 0], pos: [0, 0, 0], scale: 1,
  explode: NONE, spin: NONE,
  ledIntensity: 1.0, tickColor: '#ff4b4b',
  lens: 1, labels: 0, partLabels: 0, modelOpacity: 1,
};

const dark = (o: Partial<Keyframe> & { p: number }): Keyframe => ({
  ...base, bg: PALETTE.bg1, material: 'solid', ...o,
});

const light = (o: Partial<Keyframe> & { p: number }): Keyframe => ({
  ...base, bg: PALETTE.light, material: 'line',
  ledIntensity: 0, lens: 0, ...o,
});

/* -------------------------------------------------------------------------- */

/**
 * Progress landmarks. The stage track is 21 viewports tall and 20 of those are
 * scrollable, so a stage that begins at S viewports begins at p = S / 20.
 */
export const KEYFRAMES: Keyframe[] = [
  /* ---- hero: 3 viewports, p 0.00 -> 0.10 ------------------------------- */

  // A. assembled, near-frontal, the ring filling ~32% of viewport height
  dark({
    p: 0.0,
    tilt: 7, roll: 4, radius: 17.0,
    rot: [0, 0, -4],
    spin: { led: 0, gear: 0 },
  }),

  // B. rolls over so the barrel length reads (screenshot 2)
  dark({
    p: 0.05,
    tilt: 50, roll: 10, camRoll: 22, radius: 20.5,
    pos: [0.3, -0.2, 0],
    spin: { gear: 40, led: 12 },
  }),

  // C. shells release and float clear (screenshots 3 + 4)
  dark({
    p: 0.10,
    tilt: 64, roll: 20, camRoll: 36, radius: 24.5,
    pos: [0, 0.3, 0], scale: 0.95,
    explode: { shell: 3.6, detail: 0.5 },
    spin: { gear: 90, led: 22 },
    lens: 0.55,
  }),

  /* ---- toolbox: 4 viewports, p 0.15 -> 0.30 ---------------------------- */

  // D. hand over to the light technical view, running lower-left to upper-right
  //    with the lens at the bottom left (screenshot 5)
  light({
    p: 0.15,
    tilt: 58, roll: 14, camRoll: 42, radius: 27.0,
    scale: 0.84,
    explode: { shell: 4.2, gear: 0.8, internal: 0.5, pod: 0.4 },
    labels: 1,
  }),

  // E. swings toward vertical (screenshot 6)
  light({
    p: 0.21,
    tilt: 34, roll: 10, camRoll: 14, radius: 25.5,
    scale: 0.88, pos: [0.6, 0, 0],
    explode: { shell: 2.6, gear: 0.5, internal: 0.3 },
    labels: 1,
  }),

  // F. lays down horizontal, lens to the right (screenshot 7)
  light({
    p: 0.30,
    tilt: 88, roll: 6, camRoll: -6, radius: 26.0,
    scale: 0.86, pos: [0, -0.3, 0],
    explode: { shell: 1.0 },
    labels: 0.35,
  }),

  /* ---- eight feature sections, dead-on, constant scale ------------------ */
  /* p 0.35 .. 0.70, one every 0.05                                          */

  dark({ p: 0.335, tilt: 12, roll: 6, radius: 15.4, rot: [0, 0, 6], tickColor: '#ff4b4b' }),
  dark({ p: 0.35, tilt: 0, roll: 0, radius: 14.8, tickColor: '#ff4b4b', spin: { led: 0 } }),
  dark({ p: 0.40, tilt: 0, roll: 0, radius: 14.8, tickColor: '#ffa828', spin: { led: 14 } }),
  dark({ p: 0.45, tilt: 0, roll: 0, radius: 14.8, tickColor: '#00ffaa', spin: { led: 28 } }),
  dark({ p: 0.50, tilt: 0, roll: 0, radius: 14.8, tickColor: '#4d9cff', spin: { led: 42 } }),
  dark({ p: 0.55, tilt: 0, roll: 0, radius: 14.8, tickColor: '#26f2d5', spin: { led: 56 } }),
  dark({ p: 0.60, tilt: 0, roll: 0, radius: 14.8, tickColor: '#b7ff54', spin: { led: 70 } }),
  dark({ p: 0.65, tilt: 0, roll: 0, radius: 14.8, tickColor: '#ffcc2a', spin: { led: 84 } }),
  dark({ p: 0.70, tilt: 0, roll: 0, radius: 14.8, tickColor: '#8dff55', spin: { led: 98 } }),

  /* ---- modular API: 4 viewports, p 0.75 -> 0.90 ------------------------ */

  // P. assembled technical drawing, high 3/4 (screenshot 15)
  light({
    p: 0.755,
    tilt: 44, roll: 20, camRoll: 26, radius: 27.0,
    scale: 0.8,
    explode: { gear: 0.6, detail: 0.3 },
  }),

  // Q. exploded with the per-part weight labels (screenshot 16)
  light({
    p: 0.83,
    tilt: 40, roll: 18, camRoll: 22, radius: 31.0,
    scale: 0.78,
    explode: { shell: 5.4, gear: 3.4, internal: 2.6, pod: 2.2, detail: 1.8, front: 1.6 },
    spin: { gear: 120 },
    partLabels: 1,
  }),

  // R. reduced set - fewer modules, tighter bundle (screenshot 17)
  light({
    p: 0.895,
    tilt: 66, roll: 40, camRoll: -8, radius: 28.0,
    scale: 0.82,
    explode: { shell: 3.2, gear: 1.4, internal: 1.0, pod: 3.0 },
    spin: { gear: 180, pod: 40 },
    partLabels: 0.25,
  }),

  /* ---- sponsors + docs: the engine leaves the stage -------------------- */

  dark({
    p: 0.95,
    tilt: 38, roll: 30, radius: 30.0,
    rot: [0, 0, 10], scale: 0.8, pos: [0, 2.2, 0],
    ledIntensity: 1.4, lens: 0, modelOpacity: 0.5,
  }),

  dark({
    p: 1.0,
    tilt: 30, roll: 24, radius: 34.0,
    rot: [0, 0, 6], scale: 0.7, pos: [0, 5.5, 0],
    ledIntensity: 0.6, lens: 0, modelOpacity: 0,
  }),
];

/* -------------------------------------------------------------------------- */
/* interpolation                                                               */
/* -------------------------------------------------------------------------- */

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Smoothstep keeps the model from changing speed abruptly at a keyframe. */
const smooth = (t: number): number => t * t * (3 - 2 * t);

function lerpMap(a: ExplodeMap, b: ExplodeMap, t: number): ExplodeMap {
  const out: ExplodeMap = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<PartGroup>;
  for (const k of keys) out[k] = lerp(a[k] ?? 0, b[k] ?? 0, t);
  return out;
}

const _c1: number[] = [0, 0, 0];
const _c2: number[] = [0, 0, 0];

function hexToRgb(hex: string, out: number[]): number[] {
  const h = hex.replace('#', '');
  out[0] = parseInt(h.slice(0, 2), 16);
  out[1] = parseInt(h.slice(2, 4), 16);
  out[2] = parseInt(h.slice(4, 6), 16);
  return out;
}

export function lerpHex(a: string, b: string, t: number): string {
  hexToRgb(a, _c1);
  hexToRgb(b, _c2);
  const r = Math.round(lerp(_c1[0], _c2[0], t));
  const g = Math.round(lerp(_c1[1], _c2[1], t));
  const bl = Math.round(lerp(_c1[2], _c2[2], t));
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

const lerp3 = (
  a: [number, number, number], b: [number, number, number], t: number,
): [number, number, number] => [
  lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t),
];

/**
 * Resolve the scene state at global progress `p`.
 *
 * `material` is not blended - it flips at the midpoint of the transition, and
 * the background colour cross-fades around it, which is exactly how the
 * reference hands over between its dark and light sections.
 */
export function resolveState(p: number, out?: SceneState): SceneState {
  const kfs = KEYFRAMES;
  const t = Math.min(1, Math.max(0, p));

  let i = 0;
  while (i < kfs.length - 2 && kfs[i + 1].p <= t) i++;
  const a = kfs[i];
  const b = kfs[Math.min(kfs.length - 1, i + 1)];
  const span = Math.max(1e-6, b.p - a.p);
  const raw = Math.min(1, Math.max(0, (t - a.p) / span));
  const k = smooth(raw);

  const s: SceneState = out ?? ({} as SceneState);
  s.bg = lerpHex(a.bg, b.bg, k);
  s.tilt = lerp(a.tilt, b.tilt, k);
  s.roll = lerp(a.roll, b.roll, k);
  s.camRoll = lerp(a.camRoll, b.camRoll, k);
  s.radius = lerp(a.radius, b.radius, k);
  s.fov = lerp(a.fov, b.fov, k);
  s.target = lerp3(a.target, b.target, k);
  s.rot = lerp3(a.rot, b.rot, k);
  s.pos = lerp3(a.pos, b.pos, k);
  s.scale = lerp(a.scale, b.scale, k);
  s.material = k < 0.5 ? a.material : b.material;
  s.explode = lerpMap(a.explode, b.explode, k);
  s.spin = lerpMap(a.spin, b.spin, k);
  s.ledIntensity = lerp(a.ledIntensity, b.ledIntensity, k);
  s.tickColor = lerpHex(a.tickColor, b.tickColor, k);
  s.lens = lerp(a.lens, b.lens, k);
  s.labels = lerp(a.labels, b.labels, k);
  s.partLabels = lerp(a.partLabels, b.partLabels, k);
  s.modelOpacity = lerp(a.modelOpacity, b.modelOpacity, k);
  return s;
}

/** The static state used when the visitor prefers reduced motion. */
export const REDUCED_MOTION_P = 0.35;
