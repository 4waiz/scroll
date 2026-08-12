/**
 * "Enhanced transforms" lens demo.
 *
 * Nine flat shapes - filled circles, filled rounded squares, outlined circles
 * and outlined rounded squares - scattered across the lens, each drifting and
 * rotating on its own seeded loop with `composition: 'blend'` so the transforms
 * layer instead of replacing one another.
 *
 * Everything is authored against the fixed 600 x 600 design box; the lens
 * overlay handles scaling.
 */

import { animate } from 'animejs';
import { DEMO_SIZE, type DemoFactory, type DemoHandle } from './types';
import { makeRng, rand } from './rand';

/** Fixed stream so the visual suite renders byte-identical frames. */
const SEED = 77;

/** How many shapes we scatter. */
const SHAPE_COUNT = 9;

/** Centre of the design box. */
const CENTRE = DEMO_SIZE / 2;

/** Shapes are laid out inside this disc so nothing starts under the lens edge. */
const LAYOUT_RADIUS = 200;

/** Smallest / largest shape edge, in design px. */
const MIN_SIZE = 28;
const MAX_SIZE = 96;

/** Candidate positions tried per shape when spreading them apart. */
const CANDIDATES_PER_SHAPE = 12;

/** Rounded-square corner radius as a fraction of the shape's size. */
const CORNER_RATIO = 0.14;

/** Stroke weight for the outlined variants. */
const OUTLINE_WIDTH = 3;

/** The four variants, cycled in order: filled circle, filled square, ... */
type ShapeKind = 'filled-circle' | 'filled-square' | 'outlined-circle' | 'outlined-square';

const KIND_CYCLE: readonly ShapeKind[] = [
  'filled-circle',
  'filled-square',
  'outlined-circle',
  'outlined-square',
];

/** Resolved layout for one shape. */
interface ShapeLayout {
  kind: ShapeKind;
  size: number;
  /** Centre offset from the design-box centre. */
  cx: number;
  cy: number;
}

/** Seeded drift parameters for one shape. */
interface ShapeMotion {
  dx: number;
  dy: number;
  rotate: number;
  duration: number;
  delay: number;
}

/**
 * Scatters `SHAPE_COUNT` shapes inside the layout disc.
 *
 * Each shape proposes a fixed number of candidate positions and keeps the one
 * furthest from everything already placed - a cheap deterministic way to avoid
 * a clump in the middle without any physics relaxation.
 */
function buildLayout(rng: () => number): ShapeLayout[] {
  const placed: ShapeLayout[] = [];

  for (let i = 0; i < SHAPE_COUNT; i++) {
    const size = rand(rng, MIN_SIZE, MAX_SIZE);
    // Keep the whole shape inside the disc.
    const maxR = Math.max(0, LAYOUT_RADIUS - size / 2);

    let bestX = 0;
    let bestY = 0;
    let bestScore = -Infinity;

    for (let c = 0; c < CANDIDATES_PER_SHAPE; c++) {
      const angle = rand(rng, 0, Math.PI * 2);
      // sqrt keeps the sampling area-uniform rather than centre-heavy.
      const radius = Math.sqrt(rng()) * maxR;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      // Score = distance to the nearest neighbour's edge.
      let score = Infinity;
      for (const other of placed) {
        const gap = Math.hypot(x - other.cx, y - other.cy) - (size + other.size) / 2;
        if (gap < score) score = gap;
      }
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }

    placed.push({
      kind: KIND_CYCLE[i % KIND_CYCLE.length],
      size,
      cx: bestX,
      cy: bestY,
    });
  }

  return placed;
}

/** Builds one absolutely positioned shape div. */
function buildShapeElement(layout: ShapeLayout, accent: string): HTMLDivElement {
  const el = document.createElement('div');
  const { kind, size, cx, cy } = layout;
  const isCircle = kind === 'filled-circle' || kind === 'outlined-circle';
  const isOutlined = kind === 'outlined-circle' || kind === 'outlined-square';

  el.style.position = 'absolute';
  el.style.boxSizing = 'border-box';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left = `${CENTRE + cx - size / 2}px`;
  el.style.top = `${CENTRE + cy - size / 2}px`;
  el.style.borderRadius = isCircle ? '50%' : `${size * CORNER_RATIO}px`;

  if (isOutlined) {
    el.style.background = 'transparent';
    el.style.border = `${OUTLINE_WIDTH}px solid ${accent}`;
  } else {
    el.style.background = accent;
    el.style.border = 'none';
  }

  // Flat visual language: no shadow, no glow, no gradient.
  el.style.willChange = 'transform';

  return el;
}

export const transformsDemo: DemoFactory = (host, accent): DemoHandle => {
  const rng = makeRng(SEED);

  // ---- DOM, built immediately -------------------------------------------
  host.innerHTML = '';
  host.style.position = 'relative';
  host.style.width = `${DEMO_SIZE}px`;
  host.style.height = `${DEMO_SIZE}px`;
  host.style.overflow = 'visible';

  const layouts = buildLayout(rng);
  const elements: HTMLDivElement[] = layouts.map((layout) => {
    const el = buildShapeElement(layout, accent);
    host.appendChild(el);
    return el;
  });

  // Seeded drift values, drawn after the layout so both stay reproducible.
  const motions: ShapeMotion[] = layouts.map(() => ({
    dx: rand(rng, -100, 100),
    dy: rand(rng, -100, 100),
    rotate: rand(rng, -180, 180),
    duration: rand(rng, 500, 1000),
    delay: rand(rng, 0, 600),
  }));

  // ---- Animation state ---------------------------------------------------
  type ShapeAnimation = ReturnType<typeof animate>;
  let animations: ShapeAnimation[] = [];
  let running = false;
  let destroyed = false;

  /** Creates the per-shape loops once; later calls just resume them. */
  function ensureAnimations(): void {
    if (animations.length > 0) return;

    animations = elements.map((el, i) => {
      const m = motions[i];
      return animate(el, {
        x: m.dx,
        y: m.dy,
        rotate: m.rotate,
        duration: m.duration,
        delay: m.delay,
        composition: 'blend',
        loop: true,
        alternate: true,
        ease: 'inOutQuad',
        autoplay: false,
      });
    });
  }

  return {
    play(): void {
      if (destroyed || running) return;
      running = true;
      ensureAnimations();
      for (const a of animations) a.play();
    },

    pause(): void {
      if (!running) return;
      running = false;
      for (const a of animations) a.pause();
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      running = false;
      for (const a of animations) {
        a.pause();
        a.revert();
      }
      animations = [];
      elements.length = 0;
      host.innerHTML = '';
    },
  };
};
