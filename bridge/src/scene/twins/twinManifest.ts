/**
 * The BRIDGE digital-twin asset family.
 *
 * One entry per machine. `presentationScale` is a composition value, not a
 * real-world one: a 1 m quadruped next to an 11 m turbofan at literal scale
 * would be invisible, so each asset is scaled to read at a comparable size on
 * screen and the fleet section leans on this rather than physical dimensions.
 */

export type TwinId =
  | 'ge9x' | 'drone' | 'vehicle' | 'quadruped' | 'sidearm' | 'launcher';

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
   * A baked teardown clip that scroll scrubs instead of the procedural
   * explode. Assets that ship one are better served by it: the author knew
   * which way each part should travel, which a derived radial vector can only
   * approximate. Twins without one fall back to per-part explode vectors.
   */
  explodeClip?: string;
  /**
   * Degrees applied to the twin wrapper to correct its base orientation.
   *
   * The stage's `orient` group turns the engine so its barrel faces the camera.
   * That is right for a turbofan and wrong for everything else - it stands an
   * upright machine on its nose. The engine keeps it; every other twin cancels
   * it with -90 about X so it sits on its wheels, feet or landing gear.
   */
  baseRotation: [number, number, number];
  /**
   * Multiplier on the shared per-group explode amounts.
   *
   * Those amounts are absolute travel in the twin's own units, so one table
   * cannot serve machines an order of magnitude apart in size: 0.14 units opens
   * a 1 m quadruped visibly and does nothing at all to a 9 m launcher.
   * Defaults to 1.
   */
  explodeScale?: number;
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
    url: 'models/twins/drone-uav.glb',
    // ~1.2 m across vs the engine's ~11 m: scaled up hard so it reads at the
    // same on-screen size in its own section.
    presentationScale: 6.6,
    accent: { primary: '#65EDC0', secondary: '#59D6E8' },
    labelsRight: [
      'propeller', 'motor', 'electronic speed controller', 'flight computer',
      'GNSS', 'LiDAR', 'gimbal', 'battery',
    ],
    labelsLeft: ['airframe', 'powertrain', 'navigation', 'payload', 'telemetry'],
    idleClips: ['hover'],
    // This asset ships an authored teardown; scroll scrubs it rather than
    // fanning the parts along derived vectors.
    explodeClip: 'exploded_view',
    baseRotation: [-90, 0, 0],
  },
  vehicle: {
    id: 'vehicle',
    url: 'models/twins/car.glb',
    // Supplied asset, normalised to 4.4 m by the converter so it shares the
    // family's units. Scaled up like the rest to read against the engine.
    presentationScale: 1.8,
    accent: { primary: '#6495F5', secondary: '#FF8A42' },
    labelsRight: [
      'lidar', 'camera', 'radar', 'battery pack',
      'front drive unit', 'rear drive unit', 'inverter',
    ],
    labelsLeft: ['chassis', 'suspension', 'brake', 'steering', 'thermal loop'],
    idleClips: [],
    // The supplied asset ships nose-toward -Y; that yaw is baked into the
    // converted GLB rather than added here, because a third Euler term on top
    // of the -90 rolls the car onto its roof instead of turning it around.
    baseRotation: [-90, 0, 0],
    // 4.4 m nose to tail, four times the quadruped: the shared amounts need
    // scaling up to give the engine's wide, readable separation.
    explodeScale: 4,
  },
  quadruped: {
    id: 'quadruped',
    url: 'models/twins/quadruped-field.glb',
    presentationScale: 7.7,
    accent: { primary: '#A8FF5A', secondary: '#FFD84C' },
    labelsRight: [
      'stereo cameras', 'LiDAR', 'compute module', 'battery', 'payload rail',
    ],
    labelsLeft: [
      'hip actuator', 'upper-leg actuator', 'knee actuator', 'foot force sensor', 'IMU',
    ],
    idleClips: [],
    baseRotation: [-90, 0, 0],
  },
  sidearm: {
    id: 'sidearm',
    url: 'models/twins/sidearm.glb',
    presentationScale: 7.9,
    accent: { primary: '#FFD84C', secondary: '#F05A50' },
    labelsRight: ['optic', 'receiver', 'barrel', 'magazine tube', 'muzzle device'],
    labelsLeft: ['stock', 'forend', 'trigger group', 'sling mount'],
    idleClips: [],
    baseRotation: [-90, 0, 0],
  },
  launcher: {
    id: 'launcher',
    url: 'models/twins/launcher.glb',
    // 9.3 m long, close to the engine already, so barely scaled.
    presentationScale: 0.85,
    accent: { primary: '#59D6E8', secondary: '#A8FF5A' },
    labelsRight: ['search radar', 'track radar', 'missile canister', 'elevation ram'],
    labelsLeft: ['chassis', 'power unit', 'crew cab', 'stabiliser'],
    idleClips: [],
    baseRotation: [-90, 0, 0],
    // 9.3 m end to end: the widest machine in the family needs the largest
    // multiplier to separate at all.
    explodeScale: 8,
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
 *
 * Roll is an azimuth, but negating it to swing round to a machine's other side
 * flips the frame's up vector and puts the camera underneath. Where an asset
 * faces the wrong way, turn the geometry in the converter instead.
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
    // +180 rather than -118: adding to the azimuth swings round to the head
    // end, while negating it would flip the frame's up vector and put the
    // camera under the robot.
    hero: { tilt: 62, roll: 242, radius: 18.0 },
    technical: { tilt: 58, roll: 236, radius: 20.0 },
  },
  sidearm: {
    // Long and thin: viewed close to side-on so it reads as a profile.
    hero: { tilt: 66, roll: 78, radius: 19.0 },
    technical: { tilt: 62, roll: 70, radius: 21.0 },
  },
  launcher: {
    hero: { tilt: 60, roll: 64, radius: 22.0 },
    technical: { tilt: 56, roll: 58, radius: 24.0 },
  },
};

/** Twins whose assets exist today. Sections for the rest stay on the GE9X. */
export const AVAILABLE_TWINS: TwinId[] = (Object.keys(TWINS) as TwinId[])
  .filter((id) => TWINS[id].url !== null);

export const isAvailable = (id: TwinId): boolean => TWINS[id].url !== null;
