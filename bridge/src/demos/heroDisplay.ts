/**
 * heroDisplay - the animation that lives inside the engine's circular lens on
 * the hero section.
 *
 * Motif: an abstract "audio scope". Five lens/eye shaped bands are stacked on
 * the vertical centreline, each one filled with dense horizontal scan lines in
 * the accent colour. The stack breathes horizontally (a centre-out staggered
 * scaleX), a trail of dots ripples along an S-curve over the right half, and
 * the whole group drifts a couple of degrees back and forth.
 *
 * Authored entirely against the fixed 600 x 600 design box; the lens overlay
 * scales it to whatever the screen needs.
 */

import { animate, stagger } from '../lib/motion';
import { DEMO_SIZE, type DemoFactory, type DemoHandle } from './types';
import { makeRng, rand } from './rand';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Centre of the design box - also the centre of the circular lens. */
const CENTER = DEMO_SIZE / 2;

/** Fixed seed: the visual suite compares frames byte for byte. */
const SEED = 1337;

/** Vertical pitch of the scan lines, in design px. */
const SCAN_PITCH = 4;
/** Thickness of a single scan line, in design px. */
const SCAN_WEIGHT = 1.5;
/** Opacity of the scan lines - the bands read as a muted wash, never solid. */
const SCAN_OPACITY = 0.55;

/** Unique id counter so several instances can coexist without clashing defs. */
let instanceCount = 0;

interface BandSpec {
  /** Centre y in design space. */
  readonly cy: number;
  /** Half width. */
  readonly rx: number;
  /** Half height. */
  readonly ry: number;
}

/** Widths 70/150/470/150/70, heights 34/60/120/60/34, at y = 300, +/-96, +/-190. */
const BANDS: readonly BandSpec[] = [
  { cy: CENTER - 190, rx: 35, ry: 17 },
  { cy: CENTER - 96, rx: 75, ry: 30 },
  { cy: CENTER, rx: 235, ry: 60 },
  { cy: CENTER + 96, rx: 75, ry: 30 },
  { cy: CENTER + 190, rx: 35, ry: 17 },
];

/**
 * Horizontal squash each band breathes down to. Hard-coded (rather than a value
 * stagger) so the stack stays exactly symmetrical about the centre band.
 */
const BAND_SQUASH: readonly number[] = [0.88, 0.74, 0.62, 0.74, 0.88];

/** Number of dots in the trail. */
const DOT_COUNT = 14;

/**
 * Cubic S-curve for the dot trail, in design-space coordinates. Every control
 * point sits inside the safe circle (r ~230) so nothing is clipped by the lens.
 */
const CURVE: readonly [number, number][] = [
  [375, 130],
  [505, 225],
  [325, 375],
  [430, 472],
];

/** Point on the cubic Bezier defined by CURVE at parameter `t` in [0, 1]. */
function bezierAt(t: number): { x: number; y: number } {
  const u = 1 - t;
  const b0 = u * u * u;
  const b1 = 3 * t * u * u;
  const b2 = 3 * t * t * u;
  const b3 = t * t * t;
  const [p0, p1, p2, p3] = CURVE;
  return {
    x: b0 * p0[0] + b1 * p1[0] + b2 * p2[0] + b3 * p3[0],
    y: b0 * p0[1] + b1 * p1[1] + b2 * p2[1] + b3 * p3[1],
  };
}

/** Small typed helper for building SVG nodes. */
function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

export const heroDisplay: DemoFactory = (host, accent) => {
  const rng = makeRng(SEED);
  const prefix = `hero-display-${++instanceCount}`;

  // ---------------------------------------------------------------- structure
  host.style.position = 'relative';
  host.style.width = `${DEMO_SIZE}px`;
  host.style.height = `${DEMO_SIZE}px`;
  host.innerHTML = '';

  const svgRoot = svgEl('svg', {
    viewBox: `0 0 ${DEMO_SIZE} ${DEMO_SIZE}`,
    width: DEMO_SIZE,
    height: DEMO_SIZE,
  });
  svgRoot.style.position = 'absolute';
  svgRoot.style.left = '0';
  svgRoot.style.top = '0';
  svgRoot.style.display = 'block';
  host.appendChild(svgRoot);

  const defs = svgEl('defs');
  svgRoot.appendChild(defs);

  // The one group everything hangs off; it gets the slow rotation. Children use
  // absolute view-box coordinates, so an explicit transform-origin at the lens
  // centre keeps the CSS transform pivot unambiguous.
  const group = svgEl('g');
  group.style.transformBox = 'view-box';
  group.style.transformOrigin = `${CENTER}px ${CENTER}px`;
  svgRoot.appendChild(group);

  // ------------------------------------------------------------------- bands
  const bandNodes: SVGGElement[] = [];

  BANDS.forEach((band, index) => {
    // One scan-line pattern per band, each nudged by a fraction of the pitch so
    // the stack does not look like a single ruled sheet.
    const patternId = `${prefix}-scan-${index}`;
    const phase = rand(rng, 0, SCAN_PITCH);
    const pattern = svgEl('pattern', {
      id: patternId,
      width: SCAN_PITCH * 2,
      height: SCAN_PITCH,
      patternUnits: 'userSpaceOnUse',
      patternTransform: `translate(0 ${phase.toFixed(3)})`,
    });
    pattern.appendChild(
      svgEl('rect', {
        x: 0,
        y: 0,
        width: SCAN_PITCH * 2,
        height: SCAN_WEIGHT,
        fill: accent,
        'fill-opacity': SCAN_OPACITY,
      }),
    );
    defs.appendChild(pattern);

    // Wrapper <g> is what anime scales; the ellipse keeps its own geometry.
    const wrap = svgEl('g');
    wrap.style.transformBox = 'view-box';
    wrap.style.transformOrigin = `${CENTER}px ${band.cy}px`;
    wrap.appendChild(
      svgEl('ellipse', {
        cx: CENTER,
        cy: band.cy,
        rx: band.rx,
        ry: band.ry,
        fill: `url(#${patternId})`,
      }),
    );

    group.appendChild(wrap);
    bandNodes.push(wrap);
  });

  // -------------------------------------------------------------------- dots
  const dotNodes: SVGCircleElement[] = [];

  for (let i = 0; i < DOT_COUNT; i++) {
    const { x, y } = bezierAt(i / (DOT_COUNT - 1));
    const dot = svgEl('circle', {
      cx: x.toFixed(2),
      cy: y.toFixed(2),
      // Barely-there size jitter keeps the trail from looking mechanical.
      r: rand(rng, 3.6, 4.4).toFixed(2),
      fill: accent,
      'fill-opacity': 0.9,
    });
    dot.style.opacity = '0.25';
    group.appendChild(dot);
    dotNodes.push(dot);
  }

  // --------------------------------------------------------------- animation
  type Anim = ReturnType<typeof animate>;
  const anims: Anim[] = [];
  let started = false;
  let destroyed = false;

  /** Builds the three looping animations. Only ever called once. */
  function build(): void {
    // Stack breathes: centre band compresses most, the ripple runs outward.
    // Each band gets its own call rather than a function-based value: anime's
    // per-property value union does not accept a (target, index) function for
    // arbitrary CSS/transform props, and a per-node call is equivalent here.
    // The delay reproduces stagger(90, { from: 'center' }) over 5 bands.
    const centre = (bandNodes.length - 1) / 2;
    bandNodes.forEach((band, index) => {
      anims.push(
        animate(band, {
          scaleX: BAND_SQUASH[index],
          duration: 2600,
          ease: 'inOutQuad',
          alternate: true,
          loop: true,
          delay: Math.abs(index - centre) * 90,
        }),
      );
    });

    // Dot trail ripples along the S-curve.
    anims.push(
      animate(dotNodes, {
        opacity: [0.25, 1],
        y: [6, -6],
        duration: 1100,
        ease: 'inOutSine',
        alternate: true,
        loop: true,
        delay: stagger(60),
      }),
    );

    // Whole scope drifts a couple of degrees.
    anims.push(
      animate(group, {
        rotate: [-3, 3],
        duration: 9000,
        ease: 'inOutSine',
        alternate: true,
        loop: true,
      }),
    );
  }

  const handle: DemoHandle = {
    play(): void {
      if (destroyed) return;
      if (!started) {
        started = true;
        build();
        return;
      }
      // Idempotent: a second play() just resumes what already exists.
      for (const anim of anims) anim.play();
    },

    pause(): void {
      for (const anim of anims) anim.pause();
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const anim of anims) {
        anim.pause();
        anim.revert();
      }
      anims.length = 0;
      bandNodes.length = 0;
      dotNodes.length = 0;
      host.innerHTML = '';
    },
  };

  return handle;
};
