/**
 * "SVG toolset" lens demo.
 *
 * A closed racing-circuit outline is drawn across the lens while a small
 * triangular arrow laps it along a motion path, and the circuit itself morphs
 * between two variants of the same command structure.
 *
 * Three anime.js v4 SVG helpers are on display, one per animation:
 *   - svg.createMotionPath()  drives the arrow around the track
 *   - svg.createDrawable()    strokes the circuit on and off
 *   - svg.morphTo()           blends circuit A into circuit B
 */

import { animate, svg } from 'animejs';
import { DEMO_SIZE, type DemoFactory, type DemoHandle } from './types';
import { makeRng, rand } from './rand';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Deterministic seed for this demo's decorative layout. */
const SEED = 55;

/** Unique-ish class prefix so the injected stylesheet cannot leak. */
const P = 'svgdemo';

/** Anime v4 does not export a stable animation type name across builds. */
type Anim = ReturnType<typeof animate>;

/**
 * Road course, variant A.
 *
 * Command structure (shared byte-for-byte in shape with variant B so morphing
 * interpolates point-to-point):
 *   M  C C  L  C C C C C  L  C  Z
 * Long diagonal straight at the top right, a chicane on the right flank, a
 * hairpin at the bottom right and a slow left-hand sweep back to the start.
 */
const CIRCUIT_A =
  'M168,372 ' +
  'C140,322 152,262 200,236 ' +
  'C232,218 268,232 292,258 ' +
  'L372,196 ' +
  'C404,176 442,190 452,224 ' +
  'C462,256 440,280 412,292 ' +
  'C392,300 384,316 396,330 ' +
  'C420,358 466,366 462,398 ' +
  'C458,424 424,432 396,424 ' +
  'L262,428 ' +
  'C214,430 180,414 168,372 Z';

/** Road course, variant B - identical command sequence, shifted geometry. */
const CIRCUIT_B =
  'M152,348 ' +
  'C144,300 176,254 224,246 ' +
  'C262,240 286,258 302,286 ' +
  'L366,222 ' +
  'C398,190 446,200 456,240 ' +
  'C464,272 434,296 404,302 ' +
  'C384,306 374,320 388,336 ' +
  'C414,366 452,372 448,404 ' +
  'C444,428 410,434 384,426 ' +
  'L250,416 ' +
  'C200,402 160,396 152,348 Z';

/** Number of decorative rim ticks around the circuit. */
const TICK_COUNT = 48;

export const svgDemo: DemoFactory = (host, accent): DemoHandle => {
  const rng = makeRng(SEED);

  // ---------------------------------------------------------------- host box
  host.style.position = 'relative';
  host.style.width = `${DEMO_SIZE}px`;
  host.style.height = `${DEMO_SIZE}px`;

  const style = document.createElement('style');
  style.textContent = `
    .${P}-svg { position: absolute; inset: 0; overflow: visible; }
    .${P}-tick { stroke: #393735; stroke-width: 2; stroke-linecap: butt; }
    .${P}-circuit { fill: none; stroke-width: 5; stroke-linejoin: round;
                    stroke-linecap: round; }
  `;
  host.appendChild(style);

  // ----------------------------------------------------------------- the svg
  const root = document.createElementNS(SVG_NS, 'svg');
  root.setAttribute('class', `${P}-svg`);
  root.setAttribute('viewBox', `0 0 ${DEMO_SIZE} ${DEMO_SIZE}`);
  root.setAttribute('width', String(DEMO_SIZE));
  root.setAttribute('height', String(DEMO_SIZE));
  host.appendChild(root);

  // Faint rim ticks: purely decorative framing just inside the lens edge.
  // Their lengths jitter deterministically so the ring does not read as a
  // machine-perfect dial.
  const rim = document.createElementNS(SVG_NS, 'g');
  const cx = DEMO_SIZE / 2;
  const cy = DEMO_SIZE / 2;
  for (let i = 0; i < TICK_COUNT; i++) {
    const angle = (i / TICK_COUNT) * Math.PI * 2;
    const outer = 224;
    const inner = outer - rand(rng, 6, 16);
    const tick = document.createElementNS(SVG_NS, 'line');
    tick.setAttribute('class', `${P}-tick`);
    tick.setAttribute('x1', (cx + Math.cos(angle) * inner).toFixed(2));
    tick.setAttribute('y1', (cy + Math.sin(angle) * inner).toFixed(2));
    tick.setAttribute('x2', (cx + Math.cos(angle) * outer).toFixed(2));
    tick.setAttribute('y2', (cy + Math.sin(angle) * outer).toFixed(2));
    tick.setAttribute('opacity', rand(rng, 0.35, 1).toFixed(2));
    rim.appendChild(tick);
  }
  root.appendChild(rim);

  // Circuit A - the visible, animated track.
  const circuitA = document.createElementNS(SVG_NS, 'path');
  circuitA.setAttribute('class', `${P}-circuit`);
  circuitA.setAttribute('d', CIRCUIT_A);
  circuitA.setAttribute('stroke', accent);
  root.appendChild(circuitA);

  // Circuit B - hidden; exists only so morphTo() has a real target element.
  const circuitB = document.createElementNS(SVG_NS, 'path');
  circuitB.setAttribute('class', `${P}-circuit`);
  circuitB.setAttribute('d', CIRCUIT_B);
  circuitB.setAttribute('stroke', accent);
  circuitB.setAttribute('opacity', '0');
  root.appendChild(circuitB);

  // The travelling arrow. Points are centred on the origin so the motion path
  // translation places its nose correctly and rotation spins about its centre.
  const arrow = document.createElementNS(SVG_NS, 'polygon');
  arrow.setAttribute('points', '0,-9 16,0 0,9');
  arrow.setAttribute('fill', accent);
  root.appendChild(arrow);

  // ------------------------------------------------------------- animations
  const anims: Anim[] = [];
  let running = false;

  /** Built once, on the first play() call, then reused. */
  function build(): void {
    // 1. Arrow laps the circuit at a constant rate.
    anims.push(
      animate(arrow, {
        ...svg.createMotionPath(circuitA),
        duration: 4000,
        loop: true,
        ease: 'linear',
      }),
    );

    // 2. The stroke draws itself on and off.
    anims.push(
      animate(svg.createDrawable(circuitA), {
        draw: ['0 0', '0 1'],
        duration: 2400,
        loop: true,
        ease: 'inOutQuad',
        alternate: true,
      }),
    );

    // 3. The track shape blends between the two variants.
    anims.push(
      animate(circuitA, {
        d: svg.morphTo(circuitB),
        duration: 3000,
        loop: true,
        alternate: true,
        ease: 'inOutQuad',
      }),
    );
  }

  return {
    play(): void {
      if (running) return;
      running = true;
      if (anims.length === 0) build();
      else anims.forEach((a) => a.play());
    },

    pause(): void {
      if (!running) return;
      running = false;
      anims.forEach((a) => a.pause());
    },

    destroy(): void {
      running = false;
      anims.forEach((a) => {
        a.pause();
        a.revert();
      });
      anims.length = 0;
      host.innerHTML = '';
    },
  };
};
