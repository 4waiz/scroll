/**
 * Applies a resolved SceneState to whichever machine is currently on stage.
 *
 * Everything here is allocation-free in the hot path: scratch objects are
 * module-level and reused every frame.
 */

import { Color, MathUtils } from 'three';
import type { Stage } from './createScene';
import { placeCamera } from './createScene';
import type { TwinManager } from './twins/TwinManager';
import type { TwinId } from './twins/twinManifest';
import type { SceneState } from './sceneStates';

const _bgColor = new Color();

/** Continuous idle spin per twin, degrees per second. */
const IDLE_SPIN: Partial<Record<TwinId, number>> = {
  ge9x: 0,
  drone: 7,
};

export class ModelController {
  screenShiftX = 0;
  screenShiftY = 0;

  private idleTime = 0;
  private lastTickColor = '';
  private lastBg = '';
  private opacityApplied = 1;

  constructor(
    private stage: Stage,
    readonly twins: TwinManager,
  ) {}

  /**
   * @param state   resolved scene state
   * @param dt      seconds since the previous frame
   * @param animate whether idle motion advances (false = reduced motion)
   */
  apply(state: SceneState, dt: number, animate: boolean): void {
    if (animate) this.idleTime += dt;

    const { stage } = this;
    const twin = this.twins.active;

    placeCamera(
      stage.camera, state.tilt, state.roll, state.radius,
      state.target, state.fov, state.camRoll,
      this.screenShiftX, this.screenShiftY,
    );

    stage.pivot.rotation.set(
      MathUtils.degToRad(state.rot[0]),
      MathUtils.degToRad(state.rot[1]),
      MathUtils.degToRad(state.rot[2]),
    );
    stage.pivot.position.set(state.pos[0], state.pos[1], state.pos[2]);
    stage.pivot.scale.setScalar(state.scale);

    if (state.bg !== this.lastBg) {
      this.lastBg = state.bg;
      _bgColor.set(state.bg);
      stage.setBackground(state.bg);
      this.twins.setLineBackground(state.bg);
      document.documentElement.style.setProperty('--stage-bg', state.bg);
    }

    if (!twin) return;

    twin.setMode(state.material);

    if (state.tickColor !== this.lastTickColor) {
      this.lastTickColor = state.tickColor;
      twin.setAccent(state.tickColor);
    }
    twin.materials.setLedIntensity(state.ledIntensity);

    // Explode is applied from each part's authored direction, so it stays a
    // pure function of scroll progress and reverses exactly.
    twin.setExploded(1, state.explode as Record<string, number>);
    // Per-group spin (the GE9X's gear rings and LED arcs) is authored in the
    // keyframes; the whole-model idle turn is per-twin.
    twin.setGroupSpin(state.spin as Record<string, number>);
    twin.setSpin(animate ? (IDLE_SPIN[twin.def.id] ?? 0) * this.idleTime : 0);

    if (Math.abs(state.modelOpacity - this.opacityApplied) > 0.005) {
      this.opacityApplied = state.modelOpacity;
      twin.setOpacity(state.modelOpacity);
    }
    stage.pivot.visible = state.modelOpacity > 0.01;
  }

  dispose(): void {
    this.twins.dispose();
  }
}
