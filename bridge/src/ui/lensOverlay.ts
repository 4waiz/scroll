/**
 * The in-lens demo overlay.
 *
 * The nine feature animations are DOM/SVG rather than textures on the model,
 * because crisp vector shapes and a genuinely draggable element are what the
 * reference shows. To keep them welded to the glass, the overlay is positioned
 * from a live screen-space projection of the `Front_Display` object every frame
 * - never from a hard-coded desktop pixel value.
 *
 * Each demo authors against a fixed 600 x 600 design box (see demos/types.ts);
 * this layer supplies the single `translate + scale` that maps that box onto
 * the projected lens, and a circular clip so nothing spills onto the housing.
 */

import { DEMO_SIZE, type DemoHandle } from '../demos/types';
import type { LensProjection } from '../scene/loadModel';

/** Design radius that should land on the lens edge (the dark glass, not the LEDs). */
const DESIGN_RADIUS = 268;

export interface LensSlot {
  /** the 600x600 host handed to a demo factory */
  host: HTMLElement;
  /** clipped, transformed wrapper */
  wrapper: HTMLElement;
  demo: DemoHandle | null;
  setDemo(demo: DemoHandle | null): void;
  show(): void;
  hide(): void;
  destroy(): void;
}

export class LensOverlay {
  readonly root: HTMLElement;
  private slots = new Map<string, LensSlot>();
  private active: string | null = null;
  private lastX = -1;
  private lastY = -1;
  private lastR = -1;
  private opacity = 1;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'lens-overlay';
    parent.appendChild(this.root);
  }

  /** Create (or fetch) the slot for a given section id. */
  slot(id: string): LensSlot {
    const existing = this.slots.get(id);
    if (existing) return existing;

    const wrapper = document.createElement('div');
    wrapper.className = 'lens-slot';
    wrapper.dataset.lens = id;

    const host = document.createElement('div');
    host.className = 'lens-host';
    host.style.width = `${DEMO_SIZE}px`;
    host.style.height = `${DEMO_SIZE}px`;
    wrapper.appendChild(host);
    this.root.appendChild(wrapper);

    const slot: LensSlot = {
      host,
      wrapper,
      demo: null,
      setDemo(demo): void {
        slot.demo?.destroy();
        slot.demo = demo;
      },
      show(): void {
        wrapper.classList.add('is-active');
        slot.demo?.play();
      },
      hide(): void {
        wrapper.classList.remove('is-active');
        slot.demo?.pause();
      },
      destroy(): void {
        slot.demo?.destroy();
        wrapper.remove();
      },
    };
    this.slots.set(id, slot);
    return slot;
  }

  /** Make exactly one slot active; everything else pauses. */
  setActive(id: string | null): void {
    if (this.active === id) return;
    if (this.active) this.slots.get(this.active)?.hide();
    this.active = id;
    if (id) this.slots.get(id)?.show();
  }

  getActive(): LensSlot | null {
    return this.active ? this.slots.get(this.active) ?? null : null;
  }

  /**
   * Position the overlay onto the projected lens.
   *
   * Called once per frame. The transform is written only when it actually
   * changed, so a still page does no layout work at all.
   */
  update(proj: LensProjection, stateOpacity: number): void {
    const visible = proj.visible && stateOpacity > 0.02;
    const nextOpacity = visible ? stateOpacity * fadeByFacing(proj.facing) : 0;

    if (Math.abs(nextOpacity - this.opacity) > 0.004) {
      this.opacity = nextOpacity;
      this.root.style.opacity = String(nextOpacity);
      this.root.style.visibility = nextOpacity < 0.01 ? 'hidden' : 'visible';
    }
    if (nextOpacity < 0.01) return;

    const dx = Math.abs(proj.x - this.lastX);
    const dy = Math.abs(proj.y - this.lastY);
    const dr = Math.abs(proj.radius - this.lastR);
    if (dx < 0.25 && dy < 0.25 && dr < 0.25) return;

    this.lastX = proj.x;
    this.lastY = proj.y;
    this.lastR = proj.radius;

    const scale = proj.radius / DESIGN_RADIUS;
    this.root.style.transform =
      `translate3d(${proj.x}px, ${proj.y}px, 0) scale(${scale})`;
  }

  destroy(): void {
    for (const s of this.slots.values()) s.destroy();
    this.slots.clear();
    this.root.remove();
  }
}

/**
 * Fade the overlay out as the lens turns away from camera. A flat DOM plane
 * cannot foreshorten, so rather than showing an obviously-flat demo on a
 * steeply angled lens we dissolve it, which is what the reference does too.
 */
function fadeByFacing(facing: number): number {
  const start = 0.34;
  const full = 0.82;
  if (facing >= full) return 1;
  if (facing <= start) return 0;
  const t = (facing - start) / (full - start);
  return t * t * (3 - 2 * t);
}
