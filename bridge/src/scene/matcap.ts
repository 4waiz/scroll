/**
 * Procedural matcap generation.
 *
 * The engine is shaded as a dark technical illustration, not as PBR metal. Each
 * material group gets its own 512x512 matcap built here from an explicit
 * palette, so the on-screen colour is exactly the authored colour: the texture
 * is tagged sRGB, the material is `toneMapped = false`, and the renderer writes
 * sRGB, which means a #413D3D texel lands on screen as #413D3D.
 *
 * A matcap is indexed by the view-space normal, so shading is stable while the
 * model rotates and the highlight direction stays locked to the camera - which
 * is what the reference does.
 *
 * Disc layout (matcap convention):
 *   centre    -> normals facing the camera        -> broad flat midtone
 *   rim       -> normals perpendicular to view    -> bevels and silhouettes
 *   upper-left-> lit side                         -> narrow warm peach edge
 *   lower-right-> unlit side                      -> charcoal falloff
 */

import { CanvasTexture, LinearFilter, LinearMipMapLinearFilter, SRGBColorSpace } from 'three';

export interface MatcapSpec {
  /** broad lit midtone - most of the visible surface lands here */
  base: string;
  /** transition between base and shadow */
  mid: string;
  /** lower-right shadow */
  shadow: string;
  /** deepest edge shadow, also fills outside the disc */
  deep: string;
  /** upper-left highlight core */
  highlight: string;
  /** transition into the highlight */
  highlightSoft: string;
  /** where the rim band starts, 0..1 of disc radius. Higher = narrower edge. */
  rimStart?: number;
  /** 0..1 multiplier on the warm edge */
  highlightStrength?: number;
  /** broad lift on the lit side, kept small to avoid a peach-washed front */
  lift?: number;
}

/** Camera-space light direction: upper-left, slightly toward the viewer. */
const LIGHT: [number, number, number] = [-0.55, 0.72, 0.42];

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Render one matcap into an ImageData buffer.
 *
 * Exported separately from the texture wrapper so the same maths can be reused
 * by the offline dump that writes public/matcap-*.png.
 */
export function paintMatcap(spec: MatcapSpec, size: number): ImageData {
  const base = hexToRgb(spec.base);
  const midC = hexToRgb(spec.mid);
  const shadow = hexToRgb(spec.shadow);
  const deep = hexToRgb(spec.deep);
  const hi = hexToRgb(spec.highlight);
  const hiSoft = hexToRgb(spec.highlightSoft);

  const rimStart = spec.rimStart ?? 0.88;
  const hiStrength = spec.highlightStrength ?? 0.9;
  const lift = spec.lift ?? 0.05;

  const img = new ImageData(size, size);
  const data = img.data;
  const half = size / 2;

  const [lx, ly, lz] = LIGHT;
  const llen = Math.hypot(lx, ly, lz);
  const Lx = lx / llen;
  const Ly = ly / llen;
  const Lz = lz / llen;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // View-space normal from the disc position.
      const nx = (x + 0.5 - half) / half;
      const ny = -(y + 0.5 - half) / half;
      const r2 = nx * nx + ny * ny;

      if (r2 > 1) {
        // Outside the disc is never sampled by a well-formed normal, but fill
        // it with the deepest value so any edge bleed stays dark.
        data[i] = deep[0]; data[i + 1] = deep[1]; data[i + 2] = deep[2]; data[i + 3] = 255;
        continue;
      }

      const nz = Math.sqrt(1 - r2);
      const ndotl = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
      const radius = Math.sqrt(r2);

      // --- tonal ramp: deep -> shadow -> mid -> base -------------------
      // A surface facing straight at the camera has n.L = Lz ~= 0.42, so the
      // base plateau has to be reached at or below that value - otherwise the
      // broad front-facing panels sit in the mid tone and the whole model
      // reads too dark. The plateau is wide and flat on purpose: the target is
      // a technical illustration, not a shaded sphere.
      let col: RGB;
      const tShadow = smoothstep(-0.10, 0.06, ndotl);
      const tMid = smoothstep(0.02, 0.22, ndotl);
      const tBase = smoothstep(0.16, 0.40, ndotl);
      col = mix(deep, shadow, tShadow);
      col = mix(col, midC, tMid);
      col = mix(col, base, tBase);

      // --- small broad lift on the lit side ----------------------------
      // Keeps the upper-left of large panels from reading as flat as the
      // lower-right without turning the whole front peach.
      col = mix(col, hiSoft, lift * smoothstep(0.55, 1.0, ndotl));

      // --- narrow warm edge on upper-left-facing bevels ----------------
      // The rim band must stay genuinely narrow. A large curved shell panel
      // seen at a grazing angle occupies the outer disc too, so a wide band
      // floods whole panels with peach instead of catching only the bevels.
      // Squaring the rim term concentrates it hard against the silhouette.
      const rim = smoothstep(rimStart, 0.999, radius);
      const lit = smoothstep(0.42, 0.86, ndotl);
      const edge = rim * rim * lit * hiStrength;
      col = mix(col, hiSoft, Math.min(1, edge * 0.75));
      col = mix(col, hi, edge * edge);

      data[i] = Math.round(col[0]);
      data[i + 1] = Math.round(col[1]);
      data[i + 2] = Math.round(col[2]);
      data[i + 3] = 255;
    }
  }
  return img;
}

export function createMatcap(spec: MatcapSpec, size = 512): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable - cannot build matcap');
  ctx.putImageData(paintMatcap(spec, size), 0, 0);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipMapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/* -------------------------------------------------------------------------- */
/* per-group palettes                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Value hierarchy. Outer shell panels are the brightest graphite; ribbed grips
 * and fasteners sit well down the ramp so hundreds of small features never
 * become visual noise.
 */
export const MATCAPS: Record<string, MatcapSpec> = {
  // Away-facing surfaces bottom out at the palette's "dark surface" value
  // (#212121-ish) rather than the cavity value (#181818), which is reserved for
  // recesses and creases. Without that floor the whole right-facing half of the
  // barrel crushes to near-black and the mechanical detail disappears.
  shell: {
    base: '#413D3D', mid: '#363333', shadow: '#262424', deep: '#1E1E1E',
    highlight: '#F5C9AC', highlightSoft: '#D0AB93',
    rimStart: 0.90, highlightStrength: 0.95, lift: 0.06,
  },
  housing: {
    base: '#3B3838', mid: '#312E2E', shadow: '#232222', deep: '#1C1C1C',
    highlight: '#E8BEA2', highlightSoft: '#C9A48D',
    rimStart: 0.90, highlightStrength: 0.85, lift: 0.05,
  },
  ribbed: {
    base: '#292828', mid: '#242323', shadow: '#1D1D1D', deep: '#171717',
    highlight: '#C7A48A', highlightSoft: '#9C8474',
    rimStart: 0.94, highlightStrength: 0.40, lift: 0.03,
  },
  gear: {
    base: '#2B2929', mid: '#262424', shadow: '#1F1F1F', deep: '#181818',
    highlight: '#D8B296', highlightSoft: '#A88F7C',
    rimStart: 0.92, highlightStrength: 0.55, lift: 0.04,
  },
  detail: {
    base: '#302D2D', mid: '#292727', shadow: '#222121', deep: '#1A1A1A',
    highlight: '#DDB79B', highlightSoft: '#B0947F',
    rimStart: 0.91, highlightStrength: 0.60, lift: 0.04,
  },
  module: {
    base: '#252424', mid: '#212020', shadow: '#1D1D1D', deep: '#161616',
    highlight: '#C2A18B', highlightSoft: '#96806F',
    rimStart: 0.93, highlightStrength: 0.48, lift: 0.03,
  },
  fastener: {
    base: '#1D1D1D', mid: '#1A1A1A', shadow: '#161616', deep: '#121212',
    highlight: '#B5967F', highlightSoft: '#8A7666',
    rimStart: 0.94, highlightStrength: 0.42, lift: 0.02,
  },
  recess: {
    base: '#181818', mid: '#161616', shadow: '#131313', deep: '#101010',
    highlight: '#8A7666', highlightSoft: '#6E5F53',
    rimStart: 0.96, highlightStrength: 0.25, lift: 0.01,
  },
  bezel: {
    base: '#242323', mid: '#1F1E1E', shadow: '#191919', deep: '#141414',
    highlight: '#D0AB93', highlightSoft: '#A08872',
    rimStart: 0.92, highlightStrength: 0.65, lift: 0.04,
  },
};

/** Map a Blender material name onto a matcap group. */
export function groupForMaterial(name: string): keyof typeof MATCAPS | null {
  if (!name) return 'housing';
  if (name.includes('Shell')) return 'shell';
  if (name.includes('Ribbed')) return 'ribbed';
  if (name.includes('Gear')) return 'gear';
  if (name.includes('Detail')) return 'detail';
  if (name.includes('Internal') || name.includes('Module')) return 'module';
  if (name.includes('Fastener')) return 'fastener';
  if (name.includes('Recess')) return 'recess';
  if (name.includes('Bezel')) return 'bezel';
  if (name.includes('Housing')) return 'housing';
  // LED / Tick / Glass / Display are handled separately and must not be
  // replaced by a graphite matcap.
  if (/LED|Tick|Glass|Display/.test(name)) return null;

  // Supplied assets arrive with foreign material names - Maya lamberts and
  // blinns, V-Ray, "Chrome", "car_paint". Falling through to null left those
  // meshes on their source PBR, so the twin rendered in its original paint
  // instead of the family's graphite. Map what is recognisable and send the
  // rest to the neutral body matcap.
  const n = name.toLowerCase();
  if (/chrome|metal|steel|alu/.test(n)) return 'fastener';
  if (/paint|body|kuzov/.test(n)) return 'shell';
  if (/rubber|rezin|tire|tyre|resin/.test(n)) return 'recess';
  if (/light|lamp|faraz/.test(n)) return 'bezel';
  if (/interior|salon|seat/.test(n)) return 'module';
  return 'housing';
}
