/**
 * "Advanced staggering" lens demo.
 *
 * A 13 x 13 grid of accent dots rests at a small scale. A swell travels
 * outward from the centre of the grid: `stagger(200, { grid, from: 'center' })`
 * offsets each dot's start time by its distance from the middle, while
 * `stagger([1.1, 0.75], ...)` value-staggers how far each one swells - the
 * middle of the grid reaches 1.1 and packs into a dense disc cluster, the rim
 * barely grows past 0.75.
 *
 * The whole thing is authored against the fixed 600 x 600 design box; the lens
 * overlay handles the scaling, so no viewport measurement happens here.
 */

import { createTimeline, stagger, utils } from '../lib/motion';
import { DEMO_SIZE, type DemoFactory, type DemoHandle } from './types';

/** Dots per grid axis. */
const GRID = 13;
/** Centre-to-centre spacing between neighbouring dots, in design px. */
const PITCH = 34;
/** Unscaled diameter of a single dot, in design px. */
const DOT = 26;
/** Resting scale - small enough that the idle grid reads as fine dots. */
const BASE_SCALE = 0.32;
/** Duration of a single dot's swell, in ms. */
const SWELL_MS = 600;
/** Time offset per unit of grid distance from the centre, in ms. */
const WAVE_MS = 200;

/** Full width of the grid measured centre-to-centre: 408px. */
const SPAN = (GRID - 1) * PITCH;
/** Centre of the top-left dot so the whole grid sits in the middle of the box. */
const ORIGIN = (DEMO_SIZE - SPAN) / 2;

export const staggeringDemo: DemoFactory = (host, accent) => {
  // --- host box -------------------------------------------------------------
  host.style.position = 'relative';
  host.style.width = `${DEMO_SIZE}px`;
  host.style.height = `${DEMO_SIZE}px`;
  host.style.overflow = 'hidden';

  // --- 169 dots, laid out row-major ----------------------------------------
  // Row-major order matters: anime's grid stagger derives a dot's column from
  // `index % 13` and its row from `floor(index / 13)`, so the DOM order has to
  // match the visual grid for the wave to radiate correctly.
  const dots: HTMLDivElement[] = [];

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const dot = document.createElement('div');
      const style = dot.style;
      style.position = 'absolute';
      style.left = `${ORIGIN + col * PITCH - DOT / 2}px`;
      style.top = `${ORIGIN + row * PITCH - DOT / 2}px`;
      style.width = `${DOT}px`;
      style.height = `${DOT}px`;
      style.borderRadius = '50%';
      style.backgroundColor = accent;
      style.willChange = 'transform';
      dots.push(dot);
    }
  }

  const frag = document.createDocumentFragment();
  for (const dot of dots) frag.appendChild(dot);
  host.appendChild(frag);

  // Resting state, applied immediately so the first painted frame is correct
  // even before play() is called.
  utils.set(dots, { scale: BASE_SCALE });

  // --- animation ------------------------------------------------------------
  let timeline: ReturnType<typeof createTimeline> | null = null;

  /** Grid descriptor shared by the delay stagger and the value stagger. */
  const options = { grid: [GRID, GRID] as [number, number], from: 'center' as const };

  /** Built once, on the first play(), so repeated play() calls never re-stack it. */
  const build = (): ReturnType<typeof createTimeline> =>
    createTimeline({ loop: true }).add(
      dots,
      {
        // Value staggering: 1.1 at the centre of the grid, 0.75 at the corners.
        scale: stagger([1.1, 0.75], options),
        ease: 'inOutQuad',
        duration: SWELL_MS,
        // Two iterations - out, then back to BASE_SCALE - so the looping
        // timeline rejoins its own start without a snap.
        alternate: true,
        loop: 1,
      },
      // Position staggering: the swell departs the centre and rolls outward.
      stagger(WAVE_MS, options),
    );

  const handle: DemoHandle = {
    play() {
      if (!timeline) timeline = build();
      timeline.play();
    },

    pause() {
      timeline?.pause();
    },

    destroy() {
      // revert() cancels the timeline and restores the pre-animation inline
      // values; utils.remove() clears anything still tracked by the engine.
      timeline?.revert();
      timeline = null;
      utils.remove(dots);
      dots.length = 0;
      host.innerHTML = '';
    },
  };

  return handle;
};
