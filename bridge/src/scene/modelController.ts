/**
 * Applies a resolved SceneState to the loaded engine.
 *
 * Everything here is allocation-free in the hot path: the vectors and colours
 * are module-level scratch objects reused every frame.
 */

import { Color, MathUtils, Vector3 } from 'three';
import type { Stage } from './createScene';
import { placeCamera } from './createScene';
import type { EngineModel, EnginePart, PartGroup } from './loadModel';
import { MaterialManager } from './materials';
import type { SceneState } from './sceneStates';

const _offset = new Vector3();
const _bgColor = new Color();

/** Groups that get a continuous idle spin even when scroll is still. */
const IDLE_SPIN: Partial<Record<PartGroup, number>> = {
  led: 2.4,     // degrees per second
  gear: -5.5,
  detail: 1.2,
};

export class ModelController {
  readonly materials: MaterialManager;
  /**
   * Screen-space pan applied to every state, as a fraction of viewport width.
   * Keeps the engine clear of the left-hand text column on wide layouts.
   */
  screenShiftX = 0;
  /**
   * Screen-space pan as a fraction of viewport height, positive downward. Used
   * on stacked layouts to keep the engine clear of the text block above it.
   */
  screenShiftY = 0;
  private idleTime = 0;
  private lastTickColor = '';
  private lastLed = -1;
  private lastBg = '';
  private opacityApplied = 1;

  constructor(
    private stage: Stage,
    private model: EngineModel,
  ) {
    this.materials = new MaterialManager(model.root);
    this.materials.buildStylised();
    // Edge geometry serves double duty: mechanical creases in solid mode and
    // the technical outline in line mode, so it is worth building up front.
    this.materials.buildEdges();
    stage.orient.add(model.root);
  }

  /** Pre-build the hidden-line geometry so the first light section is smooth. */
  warmLineArt(): void {
    this.materials.buildEdges();
  }

  /**
   * @param state  resolved scene state
   * @param dt     seconds since the previous frame, for the idle spin
   * @param animate whether the idle spin should advance (false = reduced motion)
   */
  apply(state: SceneState, dt: number, animate: boolean): void {
    if (animate) this.idleTime += dt;

    const { stage } = this;

    // ---- camera ---------------------------------------------------------
    placeCamera(
      stage.camera, state.tilt, state.roll, state.radius,
      state.target, state.fov, state.camRoll,
      this.screenShiftX, this.screenShiftY,
    );

    // ---- pivot ----------------------------------------------------------
    stage.pivot.rotation.set(
      MathUtils.degToRad(state.rot[0]),
      MathUtils.degToRad(state.rot[1]),
      MathUtils.degToRad(state.rot[2]),
    );
    stage.pivot.position.set(state.pos[0], state.pos[1], state.pos[2]);
    stage.pivot.scale.setScalar(state.scale);

    // ---- background -----------------------------------------------------
    if (state.bg !== this.lastBg) {
      this.lastBg = state.bg;
      _bgColor.set(state.bg);
      stage.setBackground(state.bg);
      this.materials.setLineBackground(state.bg);
      // The line-art edge colour has to stay readable on both themes.
      document.documentElement.style.setProperty('--stage-bg', state.bg);
    }

    // ---- material mode --------------------------------------------------
    this.materials.setMode(state.material);

    if (state.tickColor !== this.lastTickColor) {
      this.lastTickColor = state.tickColor;
      this.materials.setTickColor(state.tickColor);
    }
    if (Math.abs(state.ledIntensity - this.lastLed) > 0.01) {
      this.lastLed = state.ledIntensity;
      this.materials.setLedIntensity(state.ledIntensity);
    }

    // ---- per-part explode + spin ---------------------------------------
    for (const part of this.model.parts) {
      const amount = state.explode[part.group] ?? 0;
      const p = part.object.position;
      if (amount !== 0) {
        _offset.copy(part.explode).multiplyScalar(amount);
        p.copy(part.restPosition).add(_offset);
      } else if (!p.equals(part.restPosition)) {
        p.copy(part.restPosition);
      }

      const scrollSpin = state.spin[part.group] ?? 0;
      const idle = animate ? (IDLE_SPIN[part.group] ?? 0) * this.idleTime : 0;
      const total = scrollSpin + idle;
      if (total !== 0) part.object.rotation.y = MathUtils.degToRad(total);
      else if (part.object.rotation.y !== 0) part.object.rotation.y = 0;
    }

    // ---- whole-model fade ----------------------------------------------
    if (Math.abs(state.modelOpacity - this.opacityApplied) > 0.005) {
      this.opacityApplied = state.modelOpacity;
      this.materials.setOpacity(state.modelOpacity);
    }
    stage.pivot.visible = state.modelOpacity > 0.01;
  }

  dispose(): void {
    this.materials.dispose();
    this.model.root.removeFromParent();
  }
}

/** Convenience: does this part belong to a group the exploded views move? */
export function isExplodable(part: EnginePart): boolean {
  return part.group !== 'led';
}
