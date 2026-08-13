/**
 * The BRIDGE digital-twin asset family.
 *
 * One entry per machine. `presentationScale` is a composition value, not a
 * real-world one: a 1.1 m drone next to an 11 m turbofan at literal scale
 * would be invisible, so each asset is scaled to read at a comparable size on
 * screen and the fleet section leans on this rather than physical dimensions.
 */

export type TwinId = 'ge9x' | 'drone' | 'vehicle' | 'quadruped' | 'humanoid';

export interface TwinAccent {
  primary: string;
  secondary: string;
}

export interface TwinDef {
  id: TwinId;
  /** path under the app base, or null while the asset is still being built */
  url: string | null;
  presentationScale: number;
  accent: TwinAccent;
  /**
   * Labels this twin exposes, in the order they should read. Each must match an
   * ANCHOR_* empty exported from Blender; missing anchors are skipped rather
   * than throwing, so a partially-built asset still renders.
   */
  labelsRight: string[];
  labelsLeft: string[];
  /** baked glTF clips to run continuously while the twin is on screen */
  idleClips: string[];
}

export const TWINS: Record<TwinId, TwinDef> = {
  ge9x: {
    id: 'ge9x',
    url: 'models/bridge-engine.glb',
    presentationScale: 1,
    accent: { primary: '#F05A50', secondary: '#FFD84C' },
    labelsRight: ['exhaust', 'turbine', 'combustor', 'hpc', 'bleed', 'inlet'],
    labelsLeft: ['fan', 'booster', 'gearbox', 'bearings', 'nacelle'],
    idleClips: [],
  },
  drone: {
    id: 'drone',
    url: 'models/twins/drone.glb',
    // ~1.1 m across vs the engine's ~11 m: scaled up hard so it reads at the
    // same on-screen size in its own section and in the fleet composition.
    presentationScale: 7.2,
    accent: { primary: '#65EDC0', secondary: '#59D6E8' },
    labelsRight: [
      'propeller', 'motor', 'electronic speed controller', 'flight computer',
      'GNSS', 'LiDAR', 'gimbal', 'battery',
    ],
    labelsLeft: ['airframe', 'powertrain', 'navigation', 'payload', 'telemetry'],
    idleClips: ['DRN_PropellerSpin', 'DRN_GimbalScan'],
  },
  vehicle: {
    id: 'vehicle',
    url: null,
    presentationScale: 1.7,
    accent: { primary: '#6495F5', secondary: '#FF8A42' },
    labelsRight: [],
    labelsLeft: [],
    idleClips: [],
  },
  quadruped: {
    id: 'quadruped',
    url: null,
    presentationScale: 4.4,
    accent: { primary: '#A8FF5A', secondary: '#FFD84C' },
    labelsRight: [],
    labelsLeft: [],
    idleClips: [],
  },
  humanoid: {
    id: 'humanoid',
    url: null,
    presentationScale: 3.6,
    accent: { primary: '#F05A50', secondary: '#A26BF2' },
    labelsRight: [],
    labelsLeft: [],
    idleClips: [],
  },
};

/** Twins whose assets exist today. Sections for the rest stay on the GE9X. */
export const AVAILABLE_TWINS: TwinId[] = (Object.keys(TWINS) as TwinId[])
  .filter((id) => TWINS[id].url !== null);

export const isAvailable = (id: TwinId): boolean => TWINS[id].url !== null;
