/**
 * "Scroll Observer" lens demo.
 *
 * A ball of ~22 loose, hand-drawn oval scribbles. Every stroke is the *same*
 * base scribble, rotated progressively about the centre so that together they
 * sweep out a rough wireframe sphere. A small seeded jitter in scale and
 * rotation keeps the stack from looking machine-perfect.
 *
 * Unlike the other demos this one is entirely scroll-driven: the timeline is
 * built with `autoplay: false` and the owning section pushes progress in
 * through `setProgress(t)`. Strokes draw on as the reader scrolls down and
 * undraw as they scroll back up. `play()` / `pause()` are bookkeeping only.
 */

import { createTimeline, stagger, svg } from 'animejs';
import { DEMO_SIZE, type DemoFactory, type DemoHandle } from './types';
import { makeRng, rand } from './rand';

/** Fixed seed - the visual regression suite needs byte-identical frames. */
const SEED = 909;

/** Number of scribbles in the ball. */
const STROKE_COUNT = 22;

/** Total rotation swept by the stack, in degrees. */
const TOTAL_SWEEP_DEG = 170;

/** Centre of the 600 x 600 design box. */
const CENTER = DEMO_SIZE / 2;

/** Base scribble is roughly 260 x 330 design px, well inside the r=230 lens. */
const RADIUS_X = 130;
const RADIUS_Y = 165;

/** Cubic segments making up one scribble. */
const SEGMENTS = 5;

/** Where the pen starts, and how far round it travels before lifting. */
const START_ANGLE = (-100 * Math.PI) / 180;
const SWEEP = (338 * Math.PI) / 180; // open loop - ~22deg gap at the end

const SVG_NS = 'http://www.w3.org/2000/svg';

type Vec2 = readonly [number, number];

/** Trim float noise out of the path data. */
function f(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/**
 * Build one open, slightly irregular oval out of cubic segments.
 *
 * Each vertex sits on an ellipse but with its own radius multiplier, and each
 * bezier handle gets its own length multiplier. The result reads as a single
 * confident-but-wobbly pen stroke rather than a geometric ellipse.
 */
function buildScribble(rng: () => number): string {
  const step = SWEEP / SEGMENTS;
  // Standard circular-arc -> cubic handle length for an arc of `step` radians.
  const alpha = (4 / 3) * Math.tan(step / 4);

  const pointAt = (theta: number, k: number): Vec2 => [
    CENTER + RADIUS_X * k * Math.cos(theta),
    CENTER + RADIUS_Y * k * Math.sin(theta),
  ];
  // Derivative of the parametric ellipse - the un-normalised tangent.
  const tangentAt = (theta: number, k: number): Vec2 => [
    -RADIUS_X * k * Math.sin(theta),
    RADIUS_Y * k * Math.cos(theta),
  ];

  // One radius multiplier per vertex: this is what makes the oval lopsided.
  const radii: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) radii.push(rand(rng, 0.9, 1.1));

  let d = '';
  for (let i = 0; i < SEGMENTS; i++) {
    const t0 = START_ANGLE + step * i;
    const t1 = t0 + step;

    const p0 = pointAt(t0, radii[i]);
    const p1 = pointAt(t1, radii[i + 1]);
    const g0 = tangentAt(t0, radii[i]);
    const g1 = tangentAt(t1, radii[i + 1]);

    const l0 = alpha * rand(rng, 0.82, 1.18);
    const l1 = alpha * rand(rng, 0.82, 1.18);

    const c1x = p0[0] + g0[0] * l0;
    const c1y = p0[1] + g0[1] * l0;
    const c2x = p1[0] - g1[0] * l1;
    const c2y = p1[1] - g1[1] * l1;

    if (i === 0) d += `M ${f(p0[0])} ${f(p0[1])} `;
    d += `C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p1[0])} ${f(p1[1])} `;
  }

  return d.trim();
}

export const scrollObserverDemo: DemoFactory = (host, accent) => {
  const rng = makeRng(SEED);

  host.style.position = 'relative';
  host.style.width = `${DEMO_SIZE}px`;
  host.style.height = `${DEMO_SIZE}px`;

  const root = document.createElementNS(SVG_NS, 'svg');
  root.setAttribute('viewBox', `0 0 ${DEMO_SIZE} ${DEMO_SIZE}`);
  root.setAttribute('width', `${DEMO_SIZE}`);
  root.setAttribute('height', `${DEMO_SIZE}`);
  root.setAttribute('fill', 'none');
  root.style.position = 'absolute';
  root.style.left = '0';
  root.style.top = '0';
  root.style.overflow = 'visible';

  // Every stroke shares this one geometry; only the transform differs.
  const scribble = buildScribble(rng);

  const paths: SVGPathElement[] = [];
  const stepDeg = TOTAL_SWEEP_DEG / STROKE_COUNT;

  for (let i = 0; i < STROKE_COUNT; i++) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', scribble);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', accent);
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    // Progressive rotation builds the sphere; jitter keeps it hand-made.
    const angle = i * stepDeg + rand(rng, -4, 4);
    const scale = rand(rng, 0.86, 1.04);
    path.setAttribute(
      'transform',
      `translate(${CENTER} ${CENTER}) rotate(${f(angle)}) scale(${f(scale)}) ` +
        `translate(${-CENTER} ${-CENTER})`,
    );

    root.appendChild(path);
    paths.push(path);
  }

  host.appendChild(root);

  // Draw on, hold, then retract - scrubbed by the section's scroll progress.
  const drawables = svg.createDrawable(paths);
  const tl = createTimeline({ autoplay: false }).add(
    drawables,
    {
      draw: ['0 0', '0 1', '1 1'],
      ease: 'inOut(3)',
      duration: 1000,
    },
    stagger(40),
  );

  /** Park the timeline at `t` (0..1) without ever letting it self-run. */
  const applyProgress = (t: number): void => {
    tl.pause();
    tl.progress = t < 0 ? 0 : t > 1 ? 1 : t;
  };

  // Force one render away from the default before settling on "undrawn", so
  // the strokes are guaranteed to be hidden on the very first paint.
  tl.pause();
  tl.progress = 1;
  applyProgress(0);

  let running = false;
  let destroyed = false;

  const handle: DemoHandle = {
    /**
     * Bookkeeping only. There is nothing to start: the section owns the
     * playhead and feeds it through setProgress(). Idempotent by definition.
     */
    play(): void {
      if (destroyed || running) return;
      running = true;
      tl.pause();
    },

    pause(): void {
      if (!running) return;
      running = false;
      tl.pause();
    },

    setProgress(t: number): void {
      if (destroyed) return;
      applyProgress(t);
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      running = false;
      tl.pause();
      tl.revert();
      paths.length = 0;
      host.innerHTML = '';
    },
  };

  return handle;
};
