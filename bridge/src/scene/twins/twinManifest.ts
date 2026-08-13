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
  /**
   * Degrees applied to the twin wrapper to correct its base orientation.
   *
   * The stage's `orient` group turns the engine so its barrel faces the camera.
   * That is right for a turbofan and wrong for everything else - it stands an
   * upright machine on its nose. The engine keeps it; every other twin cancels
   * it with -90 about X so it sits on its wheels, feet or landing gear.
   */
  baseRotation: [number, number, number];
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
    baseRotation: [0, 0, 0],
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
    baseRotation: [-90, 0, 0],
  },
  vehicle: {
    id: 'vehicle',
    url: 'models/twins/vehicle.glb',
    // 4.55 m long vs the engine's ~11 m: scaled up so it reads at a comparable
    // size on screen and in the fleet composition.
    presentationScale: 2.4,
    accent: { primary: '#6495F5', secondary: '#FF8A42' },
    labelsRight: [
      'lidar', 'camera', 'radar', 'battery pack',
      'front drive unit', 'rear drive unit', 'inverter',
    ],
    labelsLeft: ['chassis', 'suspension', 'brake', 'steering', 'thermal loop'],
    idleClips: ['CAR_LidarSpin', 'CAR_WheelSpin'],
    baseRotation: [-90, 0, 0],
  },
  quadruped: {
    id: 'quadruped',
    url: null,
    presentationScale: 4.4,
    accent: { primary: '#A8FF5A', secondary: '#FFD84C' },
    labelsRight: [],
    labelsLeft: [],
    idleClips: [],
    baseRotation: [-90, 0, 0],
  },
  humanoid: {
    id: 'humanoid',
    url: null,
    presentationScale: 3.6,
    accent: { primary: '#F05A50', secondary: '#A26BF2' },
    labelsRight: [],
    labelsLeft: [],
    idleClips: [],
    baseRotation: [-90, 0, 0],
  },
};

export interface CamPreset {
  tilt: number;
  roll: number;
  radius: number;
  camRoll?: number;
}

/**
 * Camera framing per machine.
 *
 * `tilt` is the angle away from the model's own up axis, so a single set of
 * numbers cannot serve the family: tilt 7 reads as "down the barrel" on the
 * turbofan but "straight down from above" on a car. Each twin declares how it
 * wants to be framed in a hero shot and in its technical section.
 */
export const TWIN_CAM: Record<TwinId, { hero: CamPreset; technical: CamPreset }> = {
  ge9x: {
    hero: { tilt: 7, roll: 4, radius: 17.0 },
    technical: { tilt: 44, roll: 20, radius: 27.0, camRoll: 26 },
  },
  drone: {
    hero: { tilt: 32, roll: 22, radius: 19.5 },
    technical: { tilt: 36, roll: 20, radius: 19.0 },
  },
  vehicle: {
    // Front three-quarter, slightly above the beltline.
    hero: { tilt: 58, roll: 68, radius: 21.0 },
    technical: { tilt: 56, roll: 62, radius: 23.0 },
  },
  quadruped: {
    hero: { tilt: 76, roll: 30, radius: 18.0 },
    technical: { tilt: 70, roll: 26, radius: 20.0 },
  },
  humanoid: {
    hero: { tilt: 82, roll: 22, radius: 20.0 },
    technical: { tilt: 78, roll: 24, radius: 22.0 },
  },
};

/** Twins whose assets exist today. Sections for the rest stay on the GE9X. */
export const AVAILABLE_TWINS: TwinId[] = (Object.keys(TWINS) as TwinId[])
  .filter((id) => TWINS[id].url !== null);

export const isAvailable = (id: TwinId): boolean => TWINS[id].url !== null;
