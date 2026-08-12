/**
 * "Springs and draggable" lens demo.
 *
 * A single acid-lime disc sits over a dashed circle that marks its home
 * position. The disc is a real `createDraggable()` instance - throw it and the
 * release spring pulls it back inside the lens:
 *
 *     createDraggable(circle, {
 *       container: host,
 *       releaseEase: createSpring({ stiffness: 120, damping: 6 }),
 *     })
 *
 * Pointer handling comes entirely from anime, so mouse, pen and touch all work
 * without a single listener of our own.
 *
 * Until someone grabs it the disc drifts through a slow figure-of-eight. That
 * idle motion is pushed through `draggable.setX/setY` rather than a plain
 * `animate()` on the element: the draggable owns the disc's translate, and
 * going through its setters keeps its internal coordinates in sync so a grab
 * mid-drift continues from exactly where the disc appears - no snap back to
 * the origin. The idle loop is killed on the first grab and never restarts,
 * because after that the section is no longer "untouched".
 */

import {
  createDraggable,
  createSpring,
  createTimer,
  type Draggable,
  type Timer,
} from 'animejs';
import { DEMO_SIZE, type DemoFactory, type DemoHandle } from './types';
import { makeRng, rand } from './rand';

/** Unique class prefix so the injected stylesheet cannot leak. */
const NS = 'drg';

/** Fixed stream - the visual suite needs byte-identical idle frames. */
const SEED = 6;

/** Home marker: dashed outline the disc rests inside. */
const HOME_RADIUS = 150;
const HOME_STROKE = '#625d5b';

/** The draggable disc (design px). */
const DISC_SIZE = 300;

/** Grip dots: 3 x 3, 10px each, 16px centre-to-centre. */
const DOT_COUNT = 3;
const DOT_SIZE = 10;
const DOT_PITCH = 16;
const DOT_COLOR = '#2c2a28';
const GRIP_SPAN = (DOT_COUNT - 1) * DOT_PITCH + DOT_SIZE;

/**
 * Lets the disc be thrown to the lens edge but never fully out of it. The
 * negative padding shrinks the drag area by half the disc, so the disc's
 * centre - not its edge - is what stops at the host boundary.
 */
const CONTAINER_PADDING = -150;

/** One full lap of the idle figure-of-eight. */
const IDLE_DURATION = 9000;

const TAU = Math.PI * 2;

export const draggableDemo: DemoFactory = (host, accent): DemoHandle => {
  // ---------------------------------------------------------------- host box
  host.style.position = 'relative';
  host.style.width = `${DEMO_SIZE}px`;
  host.style.height = `${DEMO_SIZE}px`;

  const style = document.createElement('style');
  style.textContent = `
    .${NS}-layer {
      position: absolute;
      inset: 0;
      width: ${DEMO_SIZE}px;
      height: ${DEMO_SIZE}px;
      pointer-events: none;
    }
    .${NS}-disc {
      position: absolute;
      left: ${(DEMO_SIZE - DISC_SIZE) / 2}px;
      top: ${(DEMO_SIZE - DISC_SIZE) / 2}px;
      width: ${DISC_SIZE}px;
      height: ${DISC_SIZE}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      -webkit-user-select: none;
      will-change: transform;
    }
    .${NS}-grip {
      display: grid;
      width: ${GRIP_SPAN}px;
      height: ${GRIP_SPAN}px;
      grid-template-columns: repeat(${DOT_COUNT}, ${DOT_SIZE}px);
      grid-template-rows: repeat(${DOT_COUNT}, ${DOT_SIZE}px);
      gap: ${DOT_PITCH - DOT_SIZE}px;
    }
    .${NS}-dot {
      width: ${DOT_SIZE}px;
      height: ${DOT_SIZE}px;
      border-radius: 50%;
      background: ${DOT_COLOR};
    }
  `;
  host.appendChild(style);

  // ----------------------------------------------------------- home marker
  const markerSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  markerSvg.setAttribute('class', `${NS}-layer`);
  markerSvg.setAttribute('viewBox', `0 0 ${DEMO_SIZE} ${DEMO_SIZE}`);
  markerSvg.setAttribute('aria-hidden', 'true');

  const homeCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  homeCircle.setAttribute('cx', String(DEMO_SIZE / 2));
  homeCircle.setAttribute('cy', String(DEMO_SIZE / 2));
  homeCircle.setAttribute('r', String(HOME_RADIUS));
  homeCircle.setAttribute('fill', 'none');
  homeCircle.setAttribute('stroke', HOME_STROKE);
  homeCircle.setAttribute('stroke-width', '2');
  homeCircle.setAttribute('stroke-dasharray', '4 8');
  markerSvg.appendChild(homeCircle);
  host.appendChild(markerSvg);

  // --------------------------------------------------------------- the disc
  const disc = document.createElement('div');
  disc.className = `${NS}-disc`;
  disc.style.backgroundColor = accent;

  const grip = document.createElement('div');
  grip.className = `${NS}-grip`;
  for (let i = 0; i < DOT_COUNT * DOT_COUNT; i++) {
    const dot = document.createElement('div');
    dot.className = `${NS}-dot`;
    grip.appendChild(dot);
  }
  disc.appendChild(grip);
  host.appendChild(disc);

  // ------------------------------------------------------------- draggable
  let interacted = false;

  const draggable: Draggable = createDraggable(disc, {
    container: host,
    containerPadding: CONTAINER_PADDING,
    releaseEase: createSpring({ stiffness: 120, damping: 6 }),
    onGrab: () => {
      // First contact wins: the idle drift is retired for good so it can never
      // fight the pointer or the release spring.
      interacted = true;
      idle?.pause();
    },
  });

  // ------------------------------------------------------------ idle motion
  // Gerono lemniscate - sin(t) across, sin(t)cos(t) down - gives a clean
  // figure-of-eight. Amplitudes, tilt and start phase are drawn from the fixed
  // stream so the shape is characterful but perfectly reproducible.
  const rng = makeRng(SEED);
  const ampX = rand(rng, 34, 46);
  const ampY = rand(rng, 22, 30);
  const tilt = rand(rng, -0.18, 0.18);
  const phase0 = rand(rng, 0, TAU);
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);

  let idle: Timer | null = null;
  let destroyed = false;

  const handle: DemoHandle = {
    play(): void {
      if (destroyed || interacted) return;

      // Idempotent: an existing timer is resumed instead of replaced, so a
      // second play() cannot stack two idle loops on the same disc.
      if (idle) {
        idle.play();
        return;
      }

      idle = createTimer({
        duration: IDLE_DURATION,
        loop: true,
        onUpdate: (self: Timer) => {
          const t = self.iterationProgress * TAU + phase0;
          const u = Math.sin(t) * ampX;
          // sin*cos peaks at 0.5, so double it to reach the full amplitude.
          const v = Math.sin(t) * Math.cos(t) * 2 * ampY;
          // Driving the draggable's own setters keeps its coordinates and the
          // disc's transform as a single source of truth.
          draggable.setX(u * cosTilt - v * sinTilt, true);
          draggable.setY(u * sinTilt + v * cosTilt, true);
        },
      });
    },

    pause(): void {
      idle?.pause();
    },

    destroy(): void {
      destroyed = true;
      idle?.revert();
      idle = null;
      // revert() detaches the draggable's listeners and resize observer and
      // restores every style it wrote before the DOM goes away.
      draggable.revert();
      host.innerHTML = '';
      host.style.position = '';
      host.style.width = '';
      host.style.height = '';
    },
  };

  return handle;
};
