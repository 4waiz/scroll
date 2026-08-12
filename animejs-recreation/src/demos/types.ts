/**
 * Contract for the animations that play inside the engine's circular front
 * display ("the lens").
 *
 * Every demo authors against a fixed 600 x 600 design box. The lens overlay
 * projects `Front_Display` to screen space each frame and applies a single
 * `transform: scale()` to fit, so a demo never needs to know the real pixel
 * size, the camera, or the viewport.
 */

/** Design-space size every demo is authored against. */
export const DEMO_SIZE = 600;

export interface DemoHandle {
  /** Called when the demo's section becomes visible. Must be idempotent. */
  play(): void;
  /** Called when the section leaves the viewport. Must stop all work. */
  pause(): void;
  /** Release timers, animations and listeners. */
  destroy(): void;
  /**
   * Optional scroll hook, 0..1 through the owning section. Only demos that are
   * genuinely scroll-driven (the Scroll Observer one) need to implement it.
   */
  setProgress?(t: number): void;
}

/**
 * @param host   an empty 600x600 element the demo owns entirely
 * @param accent the section accent colour as a hex string, e.g. "#ff4b4b"
 */
export type DemoFactory = (host: HTMLElement, accent: string) => DemoHandle;
