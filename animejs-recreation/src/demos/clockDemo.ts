/**
 * "Runs like clockwork" lens demo.
 *
 * A dial of sixty radial tick marks fills the lens. One long hand sweeps a full
 * revolution from the centre while a thinner arc, set just inside the ticks,
 * draws itself from 0 to 1 over the same period. Each tick kicks outward along
 * its own radius in sequence, the wave running slightly ahead of the hand.
 *
 * Everything is one anime.js v4 timeline; the only per-tick trick is that the
 * rotation lives on a wrapper <g>, so the inner element's translateY reads as a
 * radial displacement rather than a screen-vertical one.
 */

import { createTimeline, stagger, svg } from 'animejs';
import { DEMO_SIZE, type DemoFactory, type DemoHandle } from './types';
import { makeRng, rand } from './rand';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Deterministic seed for the tick ring's opacity texture. */
const SEED = 8;

/** Unique-ish class prefix so the injected stylesheet cannot leak. */
const P = 'clockdemo';

/** Centre of the design box. */
const C = DEMO_SIZE / 2;

/** Dial geometry, all in 600x600 design px. */
const TICK_COUNT = 60;
const TICK_W = 2;
const TICK_H = 18;
/** Radius of a tick's inner edge; the outer edge lands at 223, inside the lens. */
const TICK_RADIUS = 205;
/** How far a tick travels outward when it fires. */
const TICK_KICK = 6;
/** Duration of one leg of the kick (out, then back via `alternate`). */
const TICK_KICK_MS = 50;

const HAND_LENGTH = 190;
/** Side of the square block riding the outer end of the hand. */
const BLOCK = 12;
/** Rounded corners on squares are ~12% of their size. */
const BLOCK_RADIUS = BLOCK * 0.12;

const ARC_RADIUS = 168;
/** Degrees of dial covered by the partial arc. */
const ARC_SWEEP = 330;

/** One full revolution of the hand, and of the arc's draw. */
const CYCLE = 1920;

/**
 * Delay between successive tick kicks.
 *
 * Sixty ticks at 30ms span 1800ms - 120ms short of a full revolution - so the
 * wave of kicks drifts progressively ahead of the hand instead of trailing it,
 * and still lands back at twelve o'clock before the timeline loops.
 */
const TICK_STEP = 30;

/**
 * Point on a circle centred in the design box.
 *
 * @param radius distance from the centre
 * @param deg    angle in degrees, measured clockwise from twelve o'clock
 */
function polar(radius: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)];
}

export const clockDemo: DemoFactory = (host, accent): DemoHandle => {
  const rng = makeRng(SEED);

  // ---------------------------------------------------------------- host box
  host.style.position = 'relative';
  host.style.width = `${DEMO_SIZE}px`;
  host.style.height = `${DEMO_SIZE}px`;

  const style = document.createElement('style');
  style.textContent = `
    .${P}-svg { position: absolute; inset: 0; overflow: visible; }
    .${P}-tick { fill: ${accent}; }
    .${P}-hand-line { stroke: ${accent}; stroke-width: 2; stroke-linecap: butt; }
    .${P}-hand-block { fill: ${accent}; }
    .${P}-arc { fill: none; stroke: ${accent}; stroke-opacity: 0.45;
                stroke-width: 6; stroke-linecap: butt; }
  `;
  host.appendChild(style);

  // ----------------------------------------------------------------- the svg
  const root = document.createElementNS(SVG_NS, 'svg');
  root.setAttribute('class', `${P}-svg`);
  root.setAttribute('viewBox', `0 0 ${DEMO_SIZE} ${DEMO_SIZE}`);
  root.setAttribute('width', String(DEMO_SIZE));
  root.setAttribute('height', String(DEMO_SIZE));
  host.appendChild(root);

  // ------------------------------------------------------------- tick ring
  // Each tick is two nested groups:
  //   outer <g>  carries the rotation as an SVG transform attribute, so it is
  //              never clobbered by the CSS transform anime writes;
  //   inner <g>  is the animated element. It has no `y` attribute of its own,
  //              so anime resolves `y` to translateY - a local, and therefore
  //              radial, displacement inside the already-rotated frame.
  const ring = document.createElementNS(SVG_NS, 'g');
  const tickInners: SVGGElement[] = [];

  for (let i = 0; i < TICK_COUNT; i++) {
    const pivot = document.createElementNS(SVG_NS, 'g');
    pivot.setAttribute('transform', `rotate(${i * (360 / TICK_COUNT)} ${C} ${C})`);

    const inner = document.createElementNS(SVG_NS, 'g');

    const bar = document.createElementNS(SVG_NS, 'rect');
    bar.setAttribute('class', `${P}-tick`);
    bar.setAttribute('x', String(C - TICK_W / 2));
    bar.setAttribute('y', String(C - TICK_RADIUS - TICK_H));
    bar.setAttribute('width', String(TICK_W));
    bar.setAttribute('height', String(TICK_H));
    // Narrow, deterministic opacity band: reads as machined texture rather than
    // noise, and keeps the ring from looking printed.
    bar.setAttribute('opacity', rand(rng, 0.78, 1).toFixed(3));

    inner.appendChild(bar);
    pivot.appendChild(inner);
    ring.appendChild(pivot);
    tickInners.push(inner);
  }
  root.appendChild(ring);

  // ------------------------------------------------------------- filling arc
  const [ax0, ay0] = polar(ARC_RADIUS, 0);
  const [ax1, ay1] = polar(ARC_RADIUS, ARC_SWEEP);
  const arcPath = document.createElementNS(SVG_NS, 'path');
  arcPath.setAttribute('class', `${P}-arc`);
  arcPath.setAttribute(
    'd',
    `M ${ax0.toFixed(2)} ${ay0.toFixed(2)} ` +
      `A ${ARC_RADIUS} ${ARC_RADIUS} 0 ${ARC_SWEEP > 180 ? 1 : 0} 1 ` +
      `${ax1.toFixed(2)} ${ay1.toFixed(2)}`,
  );
  root.appendChild(arcPath);

  // -------------------------------------------------------------- the hand
  // The group rotates about the design-box centre. `transform-box: view-box`
  // pins transform-origin to the viewBox rather than the group's own bounds,
  // which is what makes the literal 300px 300px origin correct.
  const hand = document.createElementNS(SVG_NS, 'g');
  hand.style.transformBox = 'view-box';
  hand.style.transformOrigin = `${C}px ${C}px`;

  const handLine = document.createElementNS(SVG_NS, 'line');
  handLine.setAttribute('class', `${P}-hand-line`);
  handLine.setAttribute('x1', String(C));
  handLine.setAttribute('y1', String(C));
  handLine.setAttribute('x2', String(C));
  handLine.setAttribute('y2', String(C - HAND_LENGTH));
  hand.appendChild(handLine);

  const handBlock = document.createElementNS(SVG_NS, 'rect');
  handBlock.setAttribute('class', `${P}-hand-block`);
  handBlock.setAttribute('x', String(C - BLOCK / 2));
  handBlock.setAttribute('y', String(C - HAND_LENGTH));
  handBlock.setAttribute('width', String(BLOCK));
  handBlock.setAttribute('height', String(BLOCK));
  handBlock.setAttribute('rx', String(BLOCK_RADIUS));
  hand.appendChild(handBlock);

  root.appendChild(hand);

  // ------------------------------------------------------------- animation
  // Reference card:
  //   createTimeline({ loop: true })
  //     .add(tickInners, { y: '-=6', duration: 50, alternate: true }, stagger(10))
  //     .add(hand,  { rotate: 360, duration: 1920, ease: 'linear' }, '<');
  // Two deliberate departures, both required by anime 4.5 semantics:
  //   - `alternate` only flips on the *second* iteration, so the kick needs
  //     `loop: 1` to travel out and come back rather than sticking outward;
  //   - after a staggered `.add()`, '<' resolves to the end of the last
  //     staggered child, which would start the hand after the whole tick wave.
  //     The hand and the arc are therefore pinned to absolute position 0.
  const timeline = createTimeline({ loop: true, autoplay: false })
    .add(
      tickInners,
      { y: `-=${TICK_KICK}`, duration: TICK_KICK_MS, alternate: true, loop: 1 },
      stagger(TICK_STEP),
    )
    .add(hand, { rotate: 360, duration: CYCLE, ease: 'linear' }, 0)
    .add(
      svg.createDrawable(arcPath),
      { draw: ['0 0', '0 1'], duration: CYCLE, ease: 'linear' },
      0,
    );

  let running = false;

  return {
    play(): void {
      if (running) return;
      running = true;
      timeline.play();
    },

    pause(): void {
      if (!running) return;
      running = false;
      timeline.pause();
    },

    destroy(): void {
      running = false;
      timeline.pause();
      timeline.revert();
      host.innerHTML = '';
    },
  };
};
