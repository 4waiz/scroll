/**
 * Material modes for the engine.
 *
 * `solid` - stylised matte graphite. The housing is NOT rendered with PBR; each
 *           group gets a procedural matcap (see matcap.ts) with
 *           `toneMapped = false`, so the authored palette survives the renderer
 *           untouched and shading stays stable as the model rotates. Emissive
 *           elements (LED arcs, tick ring, display) keep their own unlit
 *           materials and are deliberately excluded from the graphite pass.
 *
 * `line`  - the technical-drawing look used by the two light sections. A real
 *           hidden-line render: every mesh is swapped to an unlit material
 *           painted the same colour as the background and pushed back with a
 *           polygon offset, while pre-built feature edges draw on top.
 *
 * In solid mode a *subset* of the same edge geometry is reused as dark mechanical
 * creases, which is what gives the reference its readable seams without an
 * expensive screen-space pass.
 */

import {
  BackSide, BufferGeometry, Color, EdgesGeometry, Group, LineBasicMaterial,
  LineSegments, Mesh, MeshBasicMaterial, MeshMatcapMaterial, MeshStandardMaterial,
  Object3D, Texture,
} from 'three';
import { MATCAPS, createMatcap, groupForMaterial } from './matcap';

export type MaterialMode = 'solid' | 'line';

/** Feature-edge threshold. 30 deg keeps silhouettes + hard steps, drops bevels. */
const EDGE_ANGLE = 30;

/** Crease colour and strength for solid mode. */
const CREASE_COLOR = '#181818';
const CREASE_OPACITY = 0.82;

/**
 * Parts small enough that outlining them turns the model into noise. The
 * reference keeps creases on panels, housings, rings and modules only.
 */
const NO_CREASE = /Tick|LED|Fastener|Vent|Glass|Display|Ribbed/;

interface MeshRecord {
  mesh: Mesh;
  /** the material that shipped in the GLB */
  original: MeshStandardMaterial | MeshStandardMaterial[];
  matName: string;
  /** graphite matcap for solid mode, null for emissive/glass parts */
  matcap: MeshMatcapMaterial | null;
  /** flat background-coloured fill for line mode */
  flat: MeshBasicMaterial | null;
  /** unlit replacement for emissive parts in solid mode */
  unlit: MeshBasicMaterial | null;
  edges: LineSegments | null;
}

export class MaterialManager {
  private records: MeshRecord[] = [];
  private textures = new Map<string, Texture>();
  private edgeMaterial = new LineBasicMaterial({
    color: new Color('#3a3735'),
    transparent: true,
    opacity: 0.95,
  });
  private creaseMaterial = new LineBasicMaterial({
    color: new Color(CREASE_COLOR),
    transparent: true,
    opacity: CREASE_OPACITY,
  });
  private edgesBuilt = false;
  private mode: MaterialMode = 'solid';
  private tickColor = new Color('#ff4b4b');
  private ledIntensity = 1;

  constructor(root: Object3D) {
    root.traverse((o) => {
      if (!(o as Mesh).isMesh) return;
      const mesh = o as Mesh;
      const material = mesh.material as MeshStandardMaterial | MeshStandardMaterial[];
      const matName = (Array.isArray(material) ? material[0] : material)?.name ?? '';
      this.records.push({
        mesh, original: material, matName,
        matcap: null, flat: null, unlit: null, edges: null,
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* solid (stylised graphite) mode                                          */
  /* ---------------------------------------------------------------------- */

  private matcapFor(group: keyof typeof MATCAPS): Texture {
    const cached = this.textures.get(group);
    if (cached) return cached;
    const tex = createMatcap(MATCAPS[group]);
    tex.name = `matcap-${group}`;
    this.textures.set(group, tex);
    return tex;
  }

  /**
   * Build the stylised materials. Replaces every PBR housing material with a
   * matcap and every emissive material with an unlit basic material, so the
   * scene's lights no longer influence the engine's colour at all.
   */
  buildStylised(): void {
    for (const rec of this.records) {
      const name = rec.matName;

      if (name.includes('LED')) {
        const src = firstMat(rec.original);
        rec.unlit = new MeshBasicMaterial({
          color: new Color().copy(src.emissive ?? new Color('#ffffff')),
          toneMapped: false,
        });
        continue;
      }
      if (name.includes('Tick')) {
        rec.unlit = new MeshBasicMaterial({ color: this.tickColor.clone(), toneMapped: false });
        continue;
      }
      if (name.includes('Display')) {
        rec.unlit = new MeshBasicMaterial({ color: new Color('#111010'), toneMapped: false });
        continue;
      }
      if (name.includes('Glass')) {
        // Dark tinted glass, no clearcoat, no environment - it must not produce
        // the white specular streak the reference never shows.
        rec.unlit = new MeshBasicMaterial({
          color: new Color('#0d0c0c'),
          transparent: true,
          opacity: 0.55,
          toneMapped: false,
          depthWrite: false,
        });
        continue;
      }

      const group = groupForMaterial(name);
      if (!group) continue;
      rec.matcap = new MeshMatcapMaterial({
        matcap: this.matcapFor(group),
        toneMapped: false,
      });
      rec.matcap.name = `matcap:${group}`;
    }
    this.applyMode();
  }

  /* ---------------------------------------------------------------------- */
  /* edges: technical outlines (line mode) + mechanical creases (solid mode) */
  /* ---------------------------------------------------------------------- */

  buildEdges(): void {
    if (this.edgesBuilt) return;
    this.edgesBuilt = true;
    for (const rec of this.records) {
      const name = rec.matName;
      if (name.includes('LED') || name.includes('Tick')) continue;

      const eg = new EdgesGeometry(rec.mesh.geometry as BufferGeometry, EDGE_ANGLE);
      const ls = new LineSegments(eg, this.edgeMaterial);
      ls.name = `${rec.mesh.name}__edges`;
      ls.visible = false;
      ls.renderOrder = 2;
      ls.frustumCulled = false;
      rec.mesh.add(ls);
      rec.edges = ls;

      rec.flat = new MeshBasicMaterial({
        color: new Color('#DAD5D0'),
        polygonOffset: true,
        polygonOffsetFactor: 1.2,
        polygonOffsetUnits: 1.2,
      });
    }
    this.applyMode();
  }

  /** Repaint the hidden-line fill so it always matches the live background. */
  setLineBackground(hex: string): void {
    const c = new Color(hex);
    for (const rec of this.records) rec.flat?.color.copy(c);
  }

  setMode(mode: MaterialMode): void {
    if (mode === this.mode) return;
    if (mode === 'line') this.buildEdges();
    this.mode = mode;
    this.applyMode();
  }

  private applyMode(): void {
    const line = this.mode === 'line';
    for (const rec of this.records) {
      const name = rec.matName;
      const emissive = name.includes('LED') || name.includes('Tick');

      if (line) {
        rec.mesh.visible = !emissive;
        if (rec.flat) rec.mesh.material = rec.flat;
        if (rec.edges) {
          rec.edges.visible = true;
          rec.edges.material = this.edgeMaterial;
        }
      } else {
        rec.mesh.visible = true;
        const next = rec.unlit ?? rec.matcap ?? firstMat(rec.original);
        rec.mesh.material = next;
        if (rec.edges) {
          // In solid mode only the large mechanical parts get creases.
          const crease = !NO_CREASE.test(name) && !NO_CREASE.test(rec.mesh.name);
          rec.edges.visible = crease;
          rec.edges.material = this.creaseMaterial;
        }
      }
    }
  }

  getMode(): MaterialMode {
    return this.mode;
  }

  /* ---------------------------------------------------------------------- */
  /* emissive controls                                                       */
  /* ---------------------------------------------------------------------- */

  setTickColor(hex: string): void {
    this.tickColor.set(hex);
    for (const rec of this.records) {
      if (!rec.matName.includes('Tick')) continue;
      if (rec.unlit) rec.unlit.color.copy(this.tickColor);
    }
  }

  /**
   * LED brightness. With unlit materials there is no emissiveIntensity, so the
   * value scales the colour instead - clamped so nothing reaches white.
   */
  setLedIntensity(v: number): void {
    this.ledIntensity = v;
    const k = Math.min(1, Math.max(0, v));
    for (const rec of this.records) {
      if (!rec.matName.includes('LED') || !rec.unlit) continue;
      const src = firstMat(rec.original);
      rec.unlit.color.copy(src.emissive ?? new Color('#ffffff')).multiplyScalar(k);
    }
  }

  getLedIntensity(): number {
    return this.ledIntensity;
  }

  /** Whole-model fade, used before the docs grid. */
  setOpacity(v: number): void {
    const opaque = v >= 0.999;
    for (const rec of this.records) {
      const mats = [rec.matcap, rec.unlit, rec.flat].filter(Boolean) as {
        transparent: boolean; opacity: number; depthWrite: boolean; name?: string;
      }[];
      for (const m of mats) {
        const glassy = rec.matName.includes('Glass');
        m.transparent = !opaque || glassy;
        m.opacity = glassy ? 0.55 * v : v;
        m.depthWrite = glassy ? false : opaque;
      }
      if (rec.edges) {
        (rec.edges.material as LineBasicMaterial).opacity = CREASE_OPACITY * v;
      }
    }
  }

  dispose(): void {
    for (const rec of this.records) {
      rec.edges?.geometry.dispose();
      rec.edges?.removeFromParent();
      rec.matcap?.dispose();
      rec.unlit?.dispose();
      rec.flat?.dispose();
      for (const m of Array.isArray(rec.original) ? rec.original : [rec.original]) m?.dispose();
    }
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
    this.records.length = 0;
    this.edgeMaterial.dispose();
    this.creaseMaterial.dispose();
  }
}

function firstMat(
  m: MeshStandardMaterial | MeshStandardMaterial[],
): MeshStandardMaterial {
  return Array.isArray(m) ? m[0] : m;
}

/** Utility: dispose every geometry/material under a subtree. */
export function disposeTree(root: Object3D | Group): void {
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) mat?.dispose();
    }
  });
}

export { BackSide };
