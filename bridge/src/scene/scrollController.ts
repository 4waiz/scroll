/**
 * Master scroll controller.
 *
 * Native scrolling only - the wheel is never hijacked. The controller reads
 * window.scrollY once per frame and turns it into:
 *
 *   - `progress`        global 0..1 through the sticky stage track (drives the scene)
 *   - `sectionProgress` 0..1 within the active stage (drives scrubbers + demos)
 *   - `activeIndex`     which stage owns the viewport right now
 *
 * Because every consumer is a pure function of these numbers, scrolling upward
 * retraces the exact same states.
 */

import type { PageStage } from '../pages/pages';

export interface ScrollFrame {
  /** 0..1 across the whole stage track */
  progress: number;
  /** index into the stage list */
  activeIndex: number;
  /** 0..1 within the active stage */
  sectionProgress: number;
  /**
   * 0..1 across the stage's whole on-screen life: 0 as its top edge reaches the
   * viewport bottom, 0.5 when it is aligned to the viewport, 1 once it has
   * fully scrolled past. This is the right driver for scroll-linked drawing,
   * because a section that fills the viewport should be mid-animation rather
   * than at zero.
   */
  sectionEnter: number;
  /** raw scrollY, CSS px */
  scrollY: number;
  /** viewport height, CSS px */
  vh: number;
}

export interface StageMetrics {
  def: PageStage;
  /** document offset of the stage's top edge, CSS px */
  top: number;
  /** total height of the stage, CSS px */
  height: number;
  /** scroll range over which the stage is pinned (0 for 1vh stages) */
  pinned: number;
}

export class ScrollController {
  private metrics: StageMetrics[] = [];
  private trackHeight = 0;
  private vh = 0;
  readonly frame: ScrollFrame = {
    progress: 0, activeIndex: 0, sectionProgress: 0, sectionEnter: 0,
    scrollY: 0, vh: 0,
  };

  constructor(
    private stages: PageStage[],
    private track: HTMLElement,
  ) {
    this.measure();
  }

  /** Recompute layout-dependent metrics. Call on resize. */
  measure(): void {
    this.vh = window.innerHeight;
    const trackTop = this.track.offsetTop;
    let y = trackTop;
    this.metrics = this.stages.map((def) => {
      const height = def.vh * this.vh;
      const m: StageMetrics = {
        def, top: y, height,
        pinned: Math.max(0, (def.vh - 1) * this.vh),
      };
      y += height;
      return m;
    });
    this.trackHeight = y - trackTop;
  }

  /** Total scrollable distance across the track. */
  get scrollable(): number {
    return Math.max(1, this.trackHeight - this.vh);
  }

  /** Read the current scroll position into `this.frame`. Allocation-free. */
  read(): ScrollFrame {
    const f = this.frame;
    const trackTop = this.metrics.length ? this.metrics[0].top : 0;
    const y = window.scrollY || window.pageYOffset || 0;
    f.scrollY = y;
    f.vh = this.vh;
    f.progress = clamp01((y - trackTop) / this.scrollable);

    // Active stage: the one whose band contains the viewport's top edge.
    let idx = 0;
    for (let i = 0; i < this.metrics.length; i++) {
      const m = this.metrics[i];
      if (y + 1 >= m.top && y < m.top + m.height) { idx = i; break; }
      if (y >= m.top) idx = i;
    }
    f.activeIndex = idx;

    const m = this.metrics[idx];
    if (m) {
      const span = m.pinned > 0 ? m.pinned : m.height;
      f.sectionProgress = clamp01((y - m.top) / Math.max(1, span));
      f.sectionEnter = clamp01((y - (m.top - this.vh)) / Math.max(1, m.height + this.vh));
    } else {
      f.sectionProgress = 0;
      f.sectionEnter = 0;
    }
    return f;
  }

  /** Scroll so that global progress equals `p`. Used by the ?state= routes. */
  scrollToProgress(p: number, behavior: ScrollBehavior = 'auto'): void {
    const trackTop = this.metrics.length ? this.metrics[0].top : 0;
    window.scrollTo({ top: trackTop + clamp01(p) * this.scrollable, behavior });
  }

  getMetrics(): readonly StageMetrics[] {
    return this.metrics;
  }

  /** Total height the track occupies, so the spacer can be sized. */
  get height(): number {
    return this.trackHeight;
  }
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/* -------------------------------------------------------------------------- */
/* render loop                                                                 */
/* -------------------------------------------------------------------------- */

export interface LoopHandle {
  stop(): void;
  /** force one frame even while paused (used after a programmatic scroll) */
  tick(): void;
}

/**
 * rAF loop with visibility gating: when the tab is hidden the loop stops
 * entirely, and it also idles when nothing has changed and no demo needs a
 * frame, which keeps the page off the GPU while the visitor reads.
 */
export function startLoop(
  onFrame: (dt: number) => void,
): LoopHandle {
  let raf = 0;
  let last = performance.now();
  let running = true;

  const step = (now: number): void => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    onFrame(dt);
    raf = requestAnimationFrame(step);
  };

  const onVisibility = (): void => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  raf = requestAnimationFrame(step);

  return {
    stop(): void {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    },
    tick(): void {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      onFrame(dt);
    },
  };
}

export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
