/**
 * glTF loading and the part registry.
 *
 * Every animatable component of the engine is its own named node in the GLB,
 * and each carries the custom properties written by blender/build_model.py:
 *
 *   explode : [x, y, z]  unit direction the part travels in an exploded view
 *   grp     : string     "front" | "housing" | "gear" | "pod" | "shell" |
 *                        "internal" | "detail" | "led" | "rear"
 *   order   : number     index within its group
 *
 * Reading the explode vectors straight off the glTF means the direction table
 * lives in exactly one place (the Blender script) instead of being duplicated
 * here and drifting.
 */

import { Box3, Mesh, Object3D, Sphere, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export type PartGroup =
  | 'front' | 'housing' | 'gear' | 'pod' | 'shell'
  | 'internal' | 'detail' | 'led' | 'rear';

export interface EnginePart {
  object: Object3D;
  name: string;
  group: PartGroup;
  order: number;
  /** exploded travel direction, in the model's own (glTF) space */
  explode: Vector3;
  /** authored rest transform, restored every frame before offsets are applied */
  restPosition: Vector3;
  restQuaternionSet: boolean;
}

export interface EngineModel {
  root: Object3D;
  parts: EnginePart[];
  byName: Map<string, EnginePart>;
  byGroup: Map<PartGroup, EnginePart[]>;
  /** the disc the DOM lens overlay is projected onto */
  display: Object3D | null;
  /** display radius in model units, from its bounding sphere */
  displayRadius: number;
  /** bounding sphere of the assembled model, used to frame the camera */
  bounds: Sphere;
}

/** Blender's Y-up conversion maps its +Z barrel axis onto glTF +Y. */
const FALLBACK_EXPLODE = new Vector3(0, 1, 0);

function readVec3(v: unknown): Vector3 | null {
  if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number')) {
    // Blender custom props are authored in Blender space (Z up); the exporter
    // does not rewrite extras, so convert here: (x, y, z)b -> (x, z, -y)gl
    return new Vector3(v[0] as number, v[2] as number, -(v[1] as number));
  }
  return null;
}

export async function loadEngine(url: string, onProgress?: (f: number) => void): Promise<EngineModel> {
  const loader = new GLTFLoader();

  // The GLB is Draco-compressed (3.79 MB -> 515 KB). The decoder is served from
  // public/draco/ rather than a CDN so the page has no external dependency, and
  // it is disposed as soon as the single model has been decoded.
  const draco = new DRACOLoader();
  draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  draco.setDecoderConfig({ type: 'js' });
  loader.setDRACOLoader(draco);

  const gltf = await loader.loadAsync(url, (e) => {
    if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total);
  });
  draco.dispose();

  const root = gltf.scene;
  root.name = 'Engine_Root';

  const parts: EnginePart[] = [];
  const byName = new Map<string, EnginePart>();
  const byGroup = new Map<PartGroup, EnginePart[]>();

  root.traverse((o) => {
    if (!(o as Mesh).isMesh) return;
    const extras = (o.userData ?? {}) as Record<string, unknown>;
    const group = (typeof extras.grp === 'string' ? extras.grp : 'detail') as PartGroup;
    const explode = readVec3(extras.explode) ?? FALLBACK_EXPLODE.clone();
    if (explode.lengthSq() < 1e-8) explode.copy(FALLBACK_EXPLODE);

    const part: EnginePart = {
      object: o,
      name: o.name,
      group,
      order: typeof extras.order === 'number' ? extras.order : 0,
      explode: explode.normalize(),
      restPosition: o.position.clone(),
      restQuaternionSet: true,
    };
    parts.push(part);
    byName.set(o.name, part);
    const list = byGroup.get(group);
    if (list) list.push(part);
    else byGroup.set(group, [part]);
  });

  for (const list of byGroup.values()) list.sort((a, b) => a.order - b.order);

  const display = byName.get('Front_Display')?.object ?? null;
  let displayRadius = 1.56;
  if (display && (display as Mesh).geometry) {
    const g = (display as Mesh).geometry;
    g.computeBoundingSphere();
    if (g.boundingSphere) displayRadius = g.boundingSphere.radius;
  }

  const box = new Box3().setFromObject(root);
  const bounds = new Sphere();
  box.getBoundingSphere(bounds);

  return { root, parts, byName, byGroup, display, displayRadius, bounds };
}

/* -------------------------------------------------------------------------- */
/* lens projection                                                             */
/* -------------------------------------------------------------------------- */

const _c = new Vector3();
const _r = new Vector3();
const _n = new Vector3();
const _camDir = new Vector3();
const _right = new Vector3();

export interface LensProjection {
  /** centre in CSS pixels, relative to the canvas */
  x: number;
  y: number;
  /** on-screen radius in CSS pixels */
  radius: number;
  /** 1 = lens dead-on to camera, 0 = edge-on, negative = facing away */
  facing: number;
  /** true when the lens is on screen and facing us enough to draw the overlay */
  visible: boolean;
}

/**
 * Project `Front_Display` into screen space so the DOM demo overlay can be
 * positioned and scaled to sit exactly on the glass - at any camera angle, any
 * viewport size, without a single hard-coded pixel value.
 */
export function projectLens(
  display: Object3D,
  modelRadius: number,
  camera: { matrixWorldInverse: unknown; projectionMatrix: unknown; position: Vector3 } & {
    updateMatrixWorld(): void;
  },
  width: number,
  height: number,
): LensProjection {
  display.updateWorldMatrix(true, false);
  const m = display.matrixWorld;

  _c.setFromMatrixPosition(m);

  // The disc's own normal is its local +Y (Blender +Z after the Y-up export).
  _n.set(0, 1, 0).transformDirection(m).normalize();

  // Camera right vector in world space, so the rim sample is always the widest
  // on-screen extent regardless of how the model is rolled.
  const cam = camera as unknown as {
    matrixWorld: { elements: number[] };
    position: Vector3;
  };
  _right.set(cam.matrixWorld.elements[0], cam.matrixWorld.elements[1], cam.matrixWorld.elements[2]).normalize();

  // World-space radius has to account for the pivot's scale.
  const scale = new Vector3().setFromMatrixScale(m).x;
  _r.copy(_c).addScaledVector(_right, modelRadius * scale);

  _camDir.copy(cam.position).sub(_c).normalize();
  const facing = _n.dot(_camDir);

  const proj = (v: Vector3): { x: number; y: number; z: number } => {
    const p = v.clone().project(camera as never);
    return {
      x: (p.x * 0.5 + 0.5) * width,
      y: (-p.y * 0.5 + 0.5) * height,
      z: p.z,
    };
  };

  const pc = proj(_c);
  const pr = proj(_r);
  const radius = Math.hypot(pr.x - pc.x, pr.y - pc.y);

  const onScreen =
    pc.z < 1 &&
    pc.x > -radius * 1.5 && pc.x < width + radius * 1.5 &&
    pc.y > -radius * 1.5 && pc.y < height + radius * 1.5;

  return {
    x: pc.x,
    y: pc.y,
    radius,
    facing,
    visible: onScreen && facing > 0.34 && radius > 8,
  };
}
