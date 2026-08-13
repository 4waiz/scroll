/**
 * The single persistent WebGL stage.
 *
 * One renderer, one canvas, one camera for the whole page. The canvas lives in
 * a fixed-position layer behind the scrolling content and is never recreated;
 * sections only change the *state* that drives it.
 */

import {
  Color, DirectionalLight, Group, HemisphereLight, NoToneMapping,
  PerspectiveCamera, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';

export interface Stage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  /** state-driven transform (rotation / position / scale) */
  pivot: Group;
  /** fixed correction turning the glTF Y-up model to face +Z */
  orient: Group;
  lights: {
    key: DirectionalLight;
    fill: DirectionalLight;
    hemi: HemisphereLight;
  };
  setSize(w: number, h: number): void;
  setBackground(hex: string): void;
  dispose(): void;
}

const MAX_DPR = 1.75;

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  // No tone mapping. The engine is shaded with matcaps whose palette is the
  // authored palette; ACES would push the neutral graphite toward brown and
  // crush the shadow detail, which is exactly the problem being corrected.
  renderer.toneMapping = NoToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(new Color('#252423'), 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));

  const scene = new Scene();
  scene.background = new Color('#252423');
  // Matcap shading must not pick up any environment reflection.
  scene.environment = null;

  const camera = new PerspectiveCamera(32, 1, 0.5, 200);
  camera.position.set(0, 0, 26);

  const pivot = new Group();
  const orient = new Group();
  // Blender +Z (the barrel axis, pointing out of the lens) becomes glTF +Y on
  // export. Rotating +90 deg about X maps +Y onto +Z, so the lens faces the
  // camera when the pivot is at identity.
  orient.rotation.x = Math.PI / 2;
  pivot.add(orient);
  scene.add(pivot);

  // --- lighting rig -------------------------------------------------------
  // The engine is matcap-shaded and needs no scene lighting at all. What
  // remains is a minimal rig only for materials that are not matcaps, kept
  // deliberately weak and neutral so it cannot reintroduce a specular streak
  // or a warm cast on the housing. The strong warm key/rim and the point light
  // that produced the bronze look are gone.
  const key = new DirectionalLight(new Color('#f5c9ac'), 0.55);
  key.position.set(-7.5, 8.5, 6.5);

  const fill = new DirectionalLight(new Color('#9a9a9a'), 0.18);
  fill.position.set(6.5, -4.0, 5.0);

  const hemi = new HemisphereLight(new Color('#3a3736'), new Color('#141414'), 0.30);

  scene.add(key, fill, hemi);

  function setSize(w: number, h: number): void {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  const bg = new Color();
  function setBackground(hex: string): void {
    bg.set(hex);
    (scene.background as Color).copy(bg);
  }

  function dispose(): void {
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return {
    renderer, scene, camera, pivot, orient,
    lights: { key, fill, hemi },
    setSize, setBackground, dispose,
  };
}

/* -------------------------------------------------------------------------- */
/* camera placement                                                            */
/* -------------------------------------------------------------------------- */

const _pos = new Vector3();
const _tgt = new Vector3();

/**
 * Place the camera in a *model-relative* spherical frame, the same convention
 * the Blender preview harness uses:
 *
 *   tilt  - angle away from the lens axis; 0 looks straight down the barrel
 *   roll  - which way the camera swings around the barrel
 *   radius- distance from the target
 */
export function placeCamera(
  camera: PerspectiveCamera,
  tilt: number, roll: number, radius: number,
  target: Vector3 | [number, number, number],
  fov: number,
  /** rotation about the camera's own view axis, i.e. the on-screen angle */
  camRoll = 0,
  /**
   * Screen-space pan, as a fraction of viewport width. Positive moves the
   * subject to the right. Applied as a camera dolly along its own local X after
   * the look-at, so the shift is a true 2D pan that holds at any camera angle
   * rather than a world-space offset that would swing around as the model
   * rotates.
   */
  shiftX = 0,
  /** Screen-space pan as a fraction of viewport height. Positive moves down. */
  shiftY = 0,
): void {
  const t = (tilt * Math.PI) / 180;
  const r = (roll * Math.PI) / 180;
  _tgt.set(
    Array.isArray(target) ? target[0] : target.x,
    Array.isArray(target) ? target[1] : target.y,
    Array.isArray(target) ? target[2] : target.z,
  );
  _pos.set(
    radius * Math.sin(t) * Math.sin(r),
    radius * Math.sin(t) * Math.cos(r),
    radius * Math.cos(t),
  ).add(_tgt);
  camera.position.copy(_pos);
  camera.lookAt(_tgt);
  // Roll about the view axis last, so it reads as a pure on-screen rotation of
  // the composition rather than an orbit. This is what lets a keyframe say
  // "the barrel runs diagonally across the frame" directly.
  if (camRoll !== 0) camera.rotateZ((camRoll * Math.PI) / 180);
  if (Math.abs(camera.fov - fov) > 0.001) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  if (shiftX !== 0 || shiftY !== 0) {
    const halfH = radius * Math.tan((fov * Math.PI) / 360);
    const halfW = halfH * camera.aspect;
    // Move the camera the opposite way to push the subject where we want it.
    if (shiftX !== 0) camera.translateX(-shiftX * 2 * halfW);
    if (shiftY !== 0) camera.translateY(shiftY * 2 * halfH);
  }
}

/* -------------------------------------------------------------------------- */
/* responsive canvas sizing                                                    */
/* -------------------------------------------------------------------------- */

export function observeSize(
  el: HTMLElement,
  onResize: (w: number, h: number) => void,
): () => void {
  const size = new Vector2();
  const apply = (): void => {
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;
    if (size.x === w && size.y === h) return;
    size.set(w, h);
    onResize(w, h);
  };
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(el);
  window.addEventListener('orientationchange', apply);
  return () => {
    ro.disconnect();
    window.removeEventListener('orientationchange', apply);
  };
}
