/**
 * "Responsive animations" lens demo.
 *
 * Five flat accent circles sit on a shallow diagonal inside a dotted rounded
 * boundary. A real motion `Scope` with an `(orientation: portrait)` media
 * query rebuilds the travelling timeline whenever the viewport flips, so the
 * same declarative code produces a different motion axis per orientation -
 * which is the whole point the card is making.
 *
 * Everything is authored against the fixed 600 x 600 design box; the lens
 * overlay handles scaling.
 */

import {
  animate,
  createScope,
  createTimeline,
  stagger,
  type JSAnimation,
  type Scope,
  type Timeline,
} from '../lib/motion';

import { DEMO_SIZE, type DemoFactory, type DemoHandle } from './types';
import { makeRng, rand } from './rand';

/* ------------------------------------------------------------------ */
/* Design constants (all values are 600 x 600 design pixels)          */
/* ------------------------------------------------------------------ */

/** Fixed PRNG seed - the visual suite needs byte-identical frames. */
const SEED = 9;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Centre of the design box. */
const CENTRE = DEMO_SIZE / 2;

/** Dotted boundary: 420 x 300, centred, generous corner radius. */
const BOUNDARY_W = 420;
const BOUNDARY_H = 300;
const BOUNDARY_RX = 60;
/** Dimmed green so the boundary reads as scaffolding, not as a shape. */
const BOUNDARY_STROKE = '#4a7a35';

const CIRCLE_COUNT = 5;
const CIRCLE_SIZE = 76;

/** Half-width / half-height of the diagonal the circles rest on. */
const SPREAD_X = 150;
const SPREAD_Y = 30;

/** Travel amplitude of the main loop, on whichever axis the scope picks. */
const TRAVEL = 50;
const TRAVEL_DURATION = 2400;
const TRAVEL_STAGGER = 100;

/** Barely-there breathing pulse layered under the travel. */
const PULSE_SCALE = 0.94;

/** Anything with `play()` / `pause()` that the handle drives. */
type Tickable = Timeline | JSAnimation;

/** One circle plus its deterministic pulse timing. */
interface CircleSpec {
  readonly el: HTMLDivElement;
  readonly pulseDuration: number;
  readonly pulseDelay: number;
}

export const responsiveDemo: DemoFactory = (host, accent): DemoHandle => {
  const rng = makeRng(SEED);

  /* ---------------------------------------------------------------- */
  /* DOM - built immediately, animated only on play()                  */
  /* ---------------------------------------------------------------- */

  host.innerHTML = '';
  host.style.position = 'relative';
  host.style.width = `${DEMO_SIZE}px`;
  host.style.height = `${DEMO_SIZE}px`;

  // Dotted boundary. Drawn as a single rect with a 1-unit dash and round caps,
  // which renders as evenly spaced dots along the rounded outline.
  const svgEl = document.createElementNS(SVG_NS, 'svg');
  svgEl.setAttribute('viewBox', `0 0 ${DEMO_SIZE} ${DEMO_SIZE}`);
  svgEl.setAttribute('width', `${DEMO_SIZE}`);
  svgEl.setAttribute('height', `${DEMO_SIZE}`);
  svgEl.style.position = 'absolute';
  svgEl.style.left = '0';
  svgEl.style.top = '0';
  svgEl.style.pointerEvents = 'none';

  const boundary = document.createElementNS(SVG_NS, 'rect');
  boundary.setAttribute('x', `${CENTRE - BOUNDARY_W / 2}`);
  boundary.setAttribute('y', `${CENTRE - BOUNDARY_H / 2}`);
  boundary.setAttribute('width', `${BOUNDARY_W}`);
  boundary.setAttribute('height', `${BOUNDARY_H}`);
  boundary.setAttribute('rx', `${BOUNDARY_RX}`);
  boundary.setAttribute('fill', 'none');
  boundary.setAttribute('stroke', BOUNDARY_STROKE);
  boundary.setAttribute('stroke-width', '3');
  boundary.setAttribute('stroke-dasharray', '1 12');
  boundary.setAttribute('stroke-linecap', 'round');
  svgEl.appendChild(boundary);
  host.appendChild(svgEl);

  // Five circles laid on a shallow diagonal that descends to the right.
  // Their resting place lives in left/top so anime only ever tweens x/y
  // around zero, which keeps the two orientations symmetrical.
  const specs: CircleSpec[] = [];
  const step = CIRCLE_COUNT - 1;

  for (let i = 0; i < CIRCLE_COUNT; i++) {
    const t = i / step;
    const offsetX = -SPREAD_X + t * SPREAD_X * 2;
    const offsetY = -SPREAD_Y + t * SPREAD_Y * 2;

    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.left = `${CENTRE + offsetX - CIRCLE_SIZE / 2}px`;
    el.style.top = `${CENTRE + offsetY - CIRCLE_SIZE / 2}px`;
    el.style.width = `${CIRCLE_SIZE}px`;
    el.style.height = `${CIRCLE_SIZE}px`;
    el.style.borderRadius = '50%';
    el.style.backgroundColor = accent;
    el.style.willChange = 'transform';
    host.appendChild(el);

    // Consume the PRNG once, here, so the pulse timings stay identical no
    // matter how many times the scope rebuilds on orientation changes.
    specs.push({
      el,
      pulseDuration: Math.round(rand(rng, 2600, 3400)),
      pulseDelay: Math.round(rand(rng, 0, 600)),
    });
  }

  const circles = specs.map((spec) => spec.el);

  /* ---------------------------------------------------------------- */
  /* Animation                                                        */
  /* ---------------------------------------------------------------- */

  let scope: Scope | null = null;
  let tickables: Tickable[] = [];
  let playing = false;

  /**
   * Scope constructor. Runs once at creation and again on every media query
   * flip; anime reverts the previous run's instances before re-entering.
   */
  const build = (self?: Scope): (() => void) => {
    const isPortrait = self?.matches.portrait === true;

    const timeline = createTimeline({ loop: true }).add(
      circles,
      {
        // Portrait travels along x, landscape along y - same code, two shapes.
        y: isPortrait ? 0 : [-TRAVEL, TRAVEL, -TRAVEL],
        x: isPortrait ? [-TRAVEL, TRAVEL, -TRAVEL] : 0,
        duration: TRAVEL_DURATION,
        ease: 'inOutQuad',
      },
      stagger(TRAVEL_STAGGER),
    );

    // Independent transform property, so it layers cleanly over the travel.
    const pulses = specs.map((spec) => animatePulse(spec));

    tickables = [timeline, ...pulses];
    if (!playing) tickables.forEach((tickable) => tickable.pause());

    return () => {
      tickables = [];
    };
  };

  const play = (): void => {
    if (playing) return;
    playing = true;
    if (scope === null) {
      scope = createScope({
        root: host,
        mediaQueries: { portrait: '(orientation: portrait)' },
      }).add(build);
    } else {
      tickables.forEach((tickable) => tickable.play());
    }
  };

  const pause = (): void => {
    playing = false;
    tickables.forEach((tickable) => tickable.pause());
  };

  const destroy = (): void => {
    playing = false;
    // Reverts every instance the scope registered and drops its media
    // query listeners.
    scope?.revert();
    scope = null;
    tickables = [];
    host.innerHTML = '';
  };

  return { play, pause, destroy };
};

/**
 * Slow, deterministic scale breathe for a single circle. Kept tiny so the
 * circles still read as flat, uniform discs.
 */
function animatePulse(spec: CircleSpec): JSAnimation {
  return animate(spec.el, {
    scale: [1, PULSE_SCALE, 1],
    duration: spec.pulseDuration,
    delay: spec.pulseDelay,
    ease: 'inOutSine',
    loop: true,
  });
}
