/**
 * One loaded machine.
 *
 * Wraps the existing loader + MaterialManager so every twin gets the same
 * graphite matcap treatment, the same hidden-line technical mode and the same
 * scroll-driven explode - rather than each machine growing its own shading
 * system.
 *
 * Explode is deliberately not a baked clip: it is applied every frame from each
 * part's `explode` vector, so it stays a pure function of scroll progress and
 * reverses exactly. Baked clips are reserved for continuous local motion
 * (propeller spin, gimbal scan) that scroll should not have to author.
 */

import {
  AnimationMixer, type AnimationAction, Group, MathUtils, Object3D, Vector3,
} from 'three';
import type { EngineModel } from '../loadModel';
import { MaterialManager, type MaterialMode } from '../materials';
import type { TwinDef } from './twinManifest';

const _offset = new Vector3();

export class TwinInstance {
  readonly def: TwinDef;
  readonly model: EngineModel;
  readonly materials: MaterialManager;
  /** wrapper carrying presentation scale + per-section placement */
  readonly root: Group;

  private mixer: AnimationMixer | null = null;
  private actions: AnimationAction[] = [];
  /** the twin's baked teardown, held paused and scrubbed by scroll */
  private scrubAction: AnimationAction | null = null;
  private scrubT = -1;
  private explode = -1;
  private spin = 0;
  private active = false;

  constructor(def: TwinDef, model: EngineModel) {
    this.def = def;
    this.model = model;

    this.root = new Group();
    this.root.name = `twin:${def.id}`;
    this.root.scale.setScalar(def.presentationScale);
    // The stage's `orient` group turns the engine so its barrel faces the
    // camera. That is right for a turbofan and wrong for everything else - it
    // stands an upright machine on its nose. Each twin cancels or keeps it.
    this.root.rotation.set(
      MathUtils.degToRad(def.baseRotation[0]),
      MathUtils.degToRad(def.baseRotation[1]),
      MathUtils.degToRad(def.baseRotation[2]),
    );
    this.root.add(model.root);

    this.materials = new MaterialManager(model.root);
    this.materials.buildStylised();
    this.materials.buildEdges();

    if (model.clips.length) {
      this.mixer = new AnimationMixer(model.root);
      for (const clip of model.clips) {
        if (def.explodeClip && clip.name === def.explodeClip) {
          // Held at time 0 and driven by setExplodeT. It has to be playing for
          // the mixer to evaluate it at all, but paused so it never advances
          // on its own - scroll is the only thing that moves it.
          const action = this.mixer.clipAction(clip);
          action.play();
          action.paused = true;
          action.clampWhenFinished = true;
          this.scrubAction = action;
          continue;
        }
        const wanted = def.idleClips.some((p) => clip.name.startsWith(p));
        if (!wanted) continue;
        const action = this.mixer.clipAction(clip);
        action.play();
        this.actions.push(action);
      }
    }

    // Hide explicitly rather than via setVisible(false): that setter guards on
    // `active`, which already starts false, so it would early-return and leave
    // the group visible - a prefetched twin would then render on top of the
    // active one.
    this.root.visible = false;
    this.root.traverse((o) => { o.matrixAutoUpdate = false; });
    this.root.matrixAutoUpdate = true;
    for (const a of this.actions) a.paused = true;
  }

  /** World-space node for a label, or null if this asset lacks that anchor. */
  anchor(label: string): Object3D | null {
    return this.model.anchors.get(label) ?? null;
  }

  get anchorLabels(): string[] {
    return [...this.def.labelsRight, ...this.def.labelsLeft]
      .filter((l) => this.model.anchors.has(l));
  }

  setVisible(visible: boolean): void {
    if (this.active === visible) return;
    this.active = visible;
    this.root.visible = visible;
    // An offscreen twin must cost nothing: stop its clips and take it out of
    // matrix/raycast work.
    for (const a of this.actions) {
      if (visible) a.paused = false;
      else a.paused = true;
    }
    this.root.traverse((o) => { o.matrixAutoUpdate = visible; });
    this.root.matrixAutoUpdate = true;
  }

  get isVisible(): boolean {
    return this.active;
  }

  setMode(mode: MaterialMode): void {
    this.materials.setMode(mode);
  }

  setLineBackground(hex: string): void {
    this.materials.setLineBackground(hex);
  }

  setAccent(primary: string): void {
    this.materials.setTickColor(primary);
  }

  setOpacity(v: number): void {
    this.materials.setOpacity(v);
    this.root.visible = this.active && v > 0.01;
  }

  /**
   * @param amount  explode distance in model units, applied along each part's
   *                authored direction
   * @param groups  optional per-group multipliers, so a section can open the
   *                shell without fanning the whole machine apart
   */
  setExploded(amount: number, groups?: Record<string, number>): void {
    if (amount === this.explode && !groups) return;
    this.explode = amount;
    for (const part of this.model.parts) {
      const k = groups ? (groups[part.group] ?? 0) : 1;
      // Group amounts are absolute model-unit travel, shared across the family,
      // so the same number reads as a wide separation on a 1.1 m drone and as
      // almost nothing on a 4.4 m car. Each twin declares its own multiplier.
      const d = amount * k * (this.def.explodeScale ?? 1);
      const p = part.object.position;
      if (d === 0) {
        if (!p.equals(part.restPosition)) p.copy(part.restPosition);
        continue;
      }
      _offset.copy(part.explode).multiplyScalar(d);
      p.copy(part.restPosition).add(_offset);
    }
  }

  /**
   * Scrub the baked teardown to `t` (0..1). No-op for twins without one, which
   * use the per-part explode vectors instead.
   */
  setExplodeT(t: number): void {
    if (!this.scrubAction || !this.mixer) return;
    const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
    if (Math.abs(clamped - this.scrubT) < 1e-4) return;
    this.scrubT = clamped;
    this.scrubAction.time = clamped * this.scrubAction.getClip().duration;
    // The mixer only writes the pose on update, and a paused action is skipped
    // by the idle tick, so nudge it here.
    this.mixer.update(0);
  }

  /** Continuous spin of the whole machine about its own up axis, in degrees. */
  setSpin(deg: number): void {
    if (deg === this.spin) return;
    this.spin = deg;
    this.model.root.rotation.y = MathUtils.degToRad(deg);
  }

  /**
   * Per-group spin about each part's own up axis - the GE9X's gear rings and
   * LED arcs turning independently of the body.
   */
  setGroupSpin(groups: Record<string, number> | undefined): void {
    for (const part of this.model.parts) {
      const deg = groups?.[part.group] ?? 0;
      const rad = MathUtils.degToRad(deg);
      if (part.object.rotation.y !== rad) part.object.rotation.y = rad;
    }
  }

  update(dt: number): void {
    if (!this.active) return;
    this.mixer?.update(dt);
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    this.materials.dispose();
    this.root.removeFromParent();
  }
}
