/**
 * Owns every machine in the scene.
 *
 * One renderer, one scene, one canvas - twins are added to a shared pivot and
 * only one is visible at a time. Loading is lazy and speculative: each asset is
 * requested a little before the section that needs it, so the hero never waits
 * on the whole family.
 */

import type { Group } from 'three';
import { loadEngine } from '../loadModel';
import type { MaterialMode } from '../materials';
import { TwinInstance } from './TwinInstance';
import { TWINS, isAvailable, type TwinId } from './twinManifest';

export class TwinManager {
  private instances = new Map<TwinId, TwinInstance>();
  private pending = new Map<TwinId, Promise<TwinInstance | null>>();
  private activeId: TwinId | null = null;

  constructor(private parent: Group) {}

  /**
   * Load a twin if it is not already loaded or in flight. Safe to call every
   * frame - repeat calls return the same promise.
   */
  request(id: TwinId): Promise<TwinInstance | null> {
    const existing = this.instances.get(id);
    if (existing) return Promise.resolve(existing);

    const inFlight = this.pending.get(id);
    if (inFlight) return inFlight;

    const def = TWINS[id];
    if (!isAvailable(id) || !def.url) return Promise.resolve(null);

    const url = `${import.meta.env.BASE_URL}${def.url}`;
    const p = loadEngine(url)
      .then((model) => {
        const inst = new TwinInstance(def, model);
        this.parent.add(inst.root);
        this.instances.set(id, inst);
        this.pending.delete(id);
        return inst;
      })
      .catch((err) => {
        console.error(`[twins] failed to load ${id}`, err);
        this.pending.delete(id);
        return null;
      });

    this.pending.set(id, p);
    return p;
  }

  /** Prefetch without caring about the result. */
  prefetch(id: TwinId): void {
    void this.request(id);
  }

  get(id: TwinId): TwinInstance | null {
    return this.instances.get(id) ?? null;
  }

  get active(): TwinInstance | null {
    return this.activeId ? this.instances.get(this.activeId) ?? null : null;
  }

  get activeTwinId(): TwinId | null {
    return this.activeId;
  }

  isLoaded(id: TwinId): boolean {
    return this.instances.has(id);
  }

  /**
   * Make one twin the visible machine. Falls back to keeping the current one on
   * screen while the requested asset is still loading, so a section never shows
   * an empty stage.
   */
  setActive(id: TwinId): void {
    if (this.activeId === id) return;
    const next = this.instances.get(id);
    if (!next) {
      void this.request(id);
      return;
    }
    for (const [key, inst] of this.instances) {
      inst.setVisible(key === id);
    }
    this.activeId = id;
  }

  setMode(mode: MaterialMode): void {
    this.active?.setMode(mode);
  }

  setLineBackground(hex: string): void {
    for (const inst of this.instances.values()) inst.setLineBackground(hex);
  }

  update(dt: number): void {
    // Only the visible twin costs anything; the rest have their mixers paused.
    this.active?.update(dt);
  }

  dispose(): void {
    for (const inst of this.instances.values()) inst.dispose();
    this.instances.clear();
    this.pending.clear();
  }
}
