/**
 * The timeline scrubber that repeats at the lower right of every stage.
 *
 * Measured from the reference (REFERENCE_NOTES.md section 5.3): a 336 x 40
 * rounded box filled #2f2e2d, holding ~46 fine grey ticks with a 2px red
 * playhead that tracks the current stage's scroll progress.
 */

const TICKS = 46;
const PLAYHEAD = '#ff4b4b';

export interface ProgressIndicator {
  el: HTMLElement;
  /** 0..1 within the owning stage */
  setProgress(t: number): void;
  destroy(): void;
}

export function createProgressIndicator(): ProgressIndicator {
  const el = document.createElement('div');
  el.className = 'scrubber';
  el.setAttribute('role', 'progressbar');
  el.setAttribute('aria-label', 'Section progress');
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '100');

  const track = document.createElement('div');
  track.className = 'scrubber__track';

  for (let i = 0; i < TICKS; i++) {
    const tick = document.createElement('i');
    tick.className = 'scrubber__tick';
    // Every 8th tick reads a touch brighter, as in the reference.
    if (i % 8 === 0) tick.classList.add('is-major');
    track.appendChild(tick);
  }

  const head = document.createElement('span');
  head.className = 'scrubber__head';
  head.style.background = PLAYHEAD;

  track.appendChild(head);
  el.appendChild(track);

  let last = -1;
  return {
    el,
    setProgress(t: number): void {
      const v = t < 0 ? 0 : t > 1 ? 1 : t;
      if (Math.abs(v - last) < 0.0015) return;
      last = v;
      // Inset slightly so the head never clips the rounded corners.
      head.style.left = `${3 + v * 94}%`;
      el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    },
    destroy(): void {
      el.remove();
    },
  };
}
