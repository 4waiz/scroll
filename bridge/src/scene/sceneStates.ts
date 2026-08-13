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
import { ACCENTS, PALETTE } from '../content';
import { progressAt, type PageDef } from '../pages/pages';

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

/* -------------------------------------------------------------------------- */
/* per-page timeline                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Build a timeline for a page from its stage *kinds*.
 *
 * Stage layouts differ per page, so a single hand-authored table of global
 * progress values cannot serve them all: the same `p` lands on a different
 * section depending on how many viewports precede it. Beats are therefore
 * authored per stage kind and their progress is resolved against the page's own
 * layout.
 */
export function buildTimeline(page: PageDef): Keyframe[] {
  const at = (stage: string, t: number): number => progressAt(page, stage, t);
  const out: Keyframe[] = [];
  const accentOf = (id: string): string => {
    const f = page.features.find((x) => x.id === id);
    return f ? ACCENTS[f.accent] : '#ff4b4b';
  };

  for (const st of page.stages) {
    switch (st.kind) {
      case 'hero':
        out.push(dark({ p: at(st.id, 0), tilt: 7, roll: 4, radius: 17.0, rot: [0, 0, -4] }));
        out.push(dark({
          p: at(st.id, 0.5), tilt: 50, roll: 10, camRoll: 22, radius: 20.5,
          pos: [0.3, -0.2, 0], spin: { gear: 40, led: 12 },
        }));
        out.push(dark({
          p: at(st.id, 1), tilt: 64, roll: 20, camRoll: 36, radius: 24.5,
          pos: [0, 0.3, 0], scale: 0.95,
          explode: { shell: 3.6, detail: 0.5 }, spin: { gear: 90, led: 22 }, lens: 0.55,
        }));
        break;

      case 'technical':
        // Five beats: enters assembled, turns to line-art, shell separates,
        // full explode, partial reassemble before handing over.
        out.push(light({ p: at(st.id, 0), tilt: 38, roll: 22, radius: 19.0, labels: 0.35 }));
        out.push(light({ p: at(st.id, 0.27), tilt: 31, roll: -12, radius: 18.4, labels: 1 }));
        out.push(light({
          p: at(st.id, 0.53), tilt: 42, roll: 16, radius: 21.0, scale: 0.98,
          explode: { shell: 0.10, battery: 0.13, avionics: 0.05, gimbal: 0.07 }, labels: 1,
        }));
        out.push(light({
          p: at(st.id, 0.8), tilt: 46, roll: 34, radius: 24.5, scale: 0.94,
          explode: {
            shell: 0.14, battery: 0.18, avionics: 0.08, gimbal: 0.12,
            arm: 0.16, motor: 0.13, prop: 0.20, esc: 0.09,
            gear: 0.10, sensor: 0.10, payload: 0.10,
          },
          labels: 1,
        }));
        out.push(light({
          p: at(st.id, 1), tilt: 40, roll: 44, radius: 21.5, scale: 0.96,
          explode: { shell: 0.05, battery: 0.06, arm: 0.05, prop: 0.07 }, labels: 0.3,
        }));
        break;

      case 'feature':
        out.push(dark({
          p: at(st.id, 0), tilt: 0, roll: 0, radius: 14.8,
          tickColor: accentOf(st.id),
        }));
        break;

      case 'modular':
        out.push(light({
          p: at(st.id, 0), tilt: 44, roll: 20, camRoll: 26, radius: 27.0, scale: 0.8,
          explode: { gear: 0.6, detail: 0.3 },
        }));
        out.push(light({
          p: at(st.id, 0.5), tilt: 40, roll: 18, camRoll: 22, radius: 31.0, scale: 0.78,
          explode: { shell: 5.4, gear: 3.4, internal: 2.6, pod: 2.2, detail: 1.8, front: 1.6 },
          spin: { gear: 120 }, partLabels: 1,
        }));
        out.push(light({
          p: at(st.id, 1), tilt: 66, roll: 40, camRoll: -8, radius: 28.0, scale: 0.82,
          explode: { shell: 3.2, gear: 1.4, internal: 1.0, pod: 3.0 },
          spin: { gear: 180, pod: 40 }, partLabels: 0.25,
        }));
        break;

      case 'sponsors':
        out.push(dark({
          p: at(st.id, 0), tilt: 38, roll: 30, radius: 30.0, scale: 0.8,
          pos: [0, 2.2, 0], ledIntensity: 1.4, lens: 0, modelOpacity: 0.5,
        }));
        break;

      case 'docs':
        out.push(dark({
          p: at(st.id, 0), tilt: 30, roll: 24, radius: 34.0, scale: 0.7,
          pos: [0, 5.5, 0], ledIntensity: 0.6, lens: 0, modelOpacity: 0,
        }));
        break;
    }
  }

  out.sort((a, b) => a.p - b.p);
  return out;
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
export function resolveState(kfs: Keyframe[], p: number, out?: SceneState): SceneState {
  const t = Math.min(1, Math.max(0, p));
  if (!kfs.length) return out ?? dark({ p: 0 });

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
