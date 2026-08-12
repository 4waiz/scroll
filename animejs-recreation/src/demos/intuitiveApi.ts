/**
 * "Intuitive API" lens demo.
 *
 * A static dotted grid fills the lens, and one large rounded square sits dead
 * centre, quarter-turning forever. The motion is deliberately the literal
 * result of the snippet shown on the section's code card:
 *
 *     animate(square, { rotate: '+=90', loop: true, ease: 'inOutExpo',
 *                       duration: 1400, loopDelay: 400 })
 *
 * The relative `'+=90'` value makes each iteration accumulate, so the square
 * never snaps back to its starting angle between loops.
 */

import { animate, type JSAnimation } from 'animejs';
import { DEMO_SIZE, type DemoFactory, type DemoHandle } from './types';

/** Unique class prefix so the injected stylesheet cannot leak. */
const NS = 'iapi';

/** Dotted grid geometry (design px). */
const GRID_COUNT = 13;
const GRID_SPACING = 34;
const DOT_RADIUS = 2;
const DOT_COLOR = '#474543';

/** Centre square geometry (design px). */
const SQUARE_SIZE = 200;
const SQUARE_RADIUS = 24;

/** Timing of one quarter turn, mirroring the on-screen code card. */
const TURN_DURATION = 1400;
const TURN_HOLD = 400;

export const intuitiveApi: DemoFactory = (host, accent): DemoHandle => {
  // ---------------------------------------------------------------- host box
  host.style.position = 'relative';
  host.style.width = `${DEMO_SIZE}px`;
  host.style.height = `${DEMO_SIZE}px`;
  host.style.overflow = 'hidden';

  // A single scoped stylesheet keeps the per-element inline styles minimal.
  const style = document.createElement('style');
  style.textContent = `
    .${NS}-layer {
      position: absolute;
      inset: 0;
      width: ${DEMO_SIZE}px;
      height: ${DEMO_SIZE}px;
    }
    .${NS}-square {
      position: absolute;
      width: ${SQUARE_SIZE}px;
      height: ${SQUARE_SIZE}px;
      left: ${(DEMO_SIZE - SQUARE_SIZE) / 2}px;
      top: ${(DEMO_SIZE - SQUARE_SIZE) / 2}px;
      border-radius: ${SQUARE_RADIUS}px;
      will-change: transform;
    }
  `;
  host.appendChild(style);

  // ------------------------------------------------------------- dotted grid
  // 13 x 13 dots, 34px apart, mathematically centred on the 600 box. The full
  // span is 12 * 34 = 408px, so the outermost dot sits 204px from centre and
  // stays comfortably inside the lens' ~230px visible radius.
  const gridSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  gridSvg.setAttribute('class', `${NS}-layer`);
  gridSvg.setAttribute('viewBox', `0 0 ${DEMO_SIZE} ${DEMO_SIZE}`);
  gridSvg.setAttribute('aria-hidden', 'true');

  const span = (GRID_COUNT - 1) * GRID_SPACING;
  const origin = (DEMO_SIZE - span) / 2;

  for (let row = 0; row < GRID_COUNT; row++) {
    for (let col = 0; col < GRID_COUNT; col++) {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', String(origin + col * GRID_SPACING));
      dot.setAttribute('cy', String(origin + row * GRID_SPACING));
      dot.setAttribute('r', String(DOT_RADIUS));
      dot.setAttribute('fill', DOT_COLOR);
      gridSvg.appendChild(dot);
    }
  }
  host.appendChild(gridSvg);

  // ----------------------------------------------------------- centre square
  const square = document.createElement('div');
  square.className = `${NS}-square`;
  square.style.backgroundColor = accent;
  host.appendChild(square);

  // ------------------------------------------------------------- animation
  let rotation: JSAnimation | null = null;
  let destroyed = false;

  const handle: DemoHandle = {
    play(): void {
      if (destroyed) return;

      // Idempotent: an existing instance is resumed rather than replaced, so a
      // second play() cannot stack a second rotation on the same element.
      if (rotation) {
        rotation.play();
        return;
      }

      rotation = animate(square, {
        // Relative value: every loop adds another 90deg to the current angle
        // instead of replaying 0 -> 90, which is what stops the snap-back.
        rotate: '+=90',
        duration: TURN_DURATION,
        loopDelay: TURN_HOLD,
        loop: true,
        ease: 'inOutExpo',
      });
    },

    pause(): void {
      rotation?.pause();
    },

    destroy(): void {
      destroyed = true;
      // revert() cancels the animation and restores the square's inline
      // transform to its pre-animation state before the DOM is torn down.
      rotation?.revert();
      rotation = null;
      host.innerHTML = '';
      host.style.position = '';
      host.style.width = '';
      host.style.height = '';
      host.style.overflow = '';
    },
  };

  return handle;
};
