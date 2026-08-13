/**
 * Page registry.
 *
 * The site is a multi-page app, not one long scroll: each machine gets its own
 * route, its own copy and its own 3D asset, and the header links between them.
 * That keeps every page loading exactly one twin instead of the whole family,
 * and means no machine has to be re-used to fill a section it does not suit.
 *
 * Vite builds one HTML entry per page (see vite.config.ts). `<body data-page>`
 * tells main.ts which definition to render.
 */

import type { TwinId } from '../scene/twins/twinManifest';
import { FEATURES, type FeatureSection } from '../content';

export type PageSlug = 'index' | 'airborne' | 'automotive' | 'field' | 'humanoid' | 'fleet';

export interface PageStage {
  id: string;
  kind: 'hero' | 'technical' | 'feature' | 'modular' | 'sponsors' | 'docs';
  vh: number;
  theme: 'dark' | 'light';
  twin: TwinId;
}

export interface PageHero {
  heading: string[];
  lead: string;
  typed: string[];
  install: string;
  cta: string;
  eyebrow: string;
}

export interface PageTechnical {
  heading: string[];
  lead: string;
}

export interface PageDef {
  slug: PageSlug;
  href: string;
  /** header link text */
  navLabel: string;
  /** browser title + meta description */
  title: string;
  description: string;
  twin: TwinId;
  /** false while the machine is still being built - kept out of the nav */
  live: boolean;
  hero: PageHero;
  technical: PageTechnical | null;
  features: FeatureSection[];
  stages: PageStage[];
}

/* -------------------------------------------------------------------------- */
/* home - the GE9X                                                             */
/* -------------------------------------------------------------------------- */

const HOME: PageDef = {
  slug: 'index',
  href: 'index.html',
  navLabel: 'Aerospace',
  title: 'BRIDGE Twin | Real-Time Digital Twin Platform',
  description:
    'A live physics twin of a large commercial turbofan - telemetry, thermal fields, vibration spectra and fleet-wide analysis in the browser.',
  twin: 'ge9x',
  live: true,
  hero: {
    eyebrow: 'Aerospace',
    heading: ['Digital twin', 'of the', 'GE9X.'],
    lead: 'A live physics twin of the turbofan that powers the 777X. Streaming',
    typed: ['every sensor', 'thermal fields', 'rotor dynamics', 'the full gas path', 'an entire fleet'],
    install: 'npm i @bridge/twin',
    cta: 'Read the docs',
  },
  technical: null,
  features: FEATURES,
  stages: [
    { id: 'hero', kind: 'hero', vh: 3, theme: 'dark', twin: 'ge9x' },
    ...FEATURES.map((f): PageStage => ({
      id: f.id, kind: 'feature', vh: 1, theme: 'dark', twin: 'ge9x',
    })),
    { id: 'modular', kind: 'modular', vh: 4, theme: 'light', twin: 'ge9x' },
    { id: 'sponsors', kind: 'sponsors', vh: 1, theme: 'dark', twin: 'ge9x' },
    { id: 'docs', kind: 'docs', vh: 1, theme: 'dark', twin: 'ge9x' },
  ],
};

/* -------------------------------------------------------------------------- */
/* airborne - the inspection drone                                             */
/* -------------------------------------------------------------------------- */

const DRONE_FEATURES: FeatureSection[] = [
  {
    id: 'flight',
    heading: 'Flight state',
    lead: 'Attitude, altitude and control-surface demand resolved together, not as separate log streams.',
    bullets: ['Attitude and rate estimation', 'Control demand vs response', 'Wind and gust rejection'],
    accent: 'turquoise',
    demo: 'clockDemo',
    code: `const drone = bridge.twin('drone-07');

drone.stream([
  'imu.*',
  'baro.altitude',
  'motor.*.rpm'
]);`,
  },
  {
    id: 'propulsion',
    heading: 'Propulsion health',
    lead: 'Per-motor current, temperature and vibration signature, compared against the other three in real time.',
    bullets: ['Per-motor current draw', 'Bearing wear signature', 'Thrust asymmetry alerts'],
    accent: 'cyan',
    demo: 'staggeringDemo',
    code: `drone.compare('motor.*', {
  metric: 'vibration.rms',
  baseline: 'fleet',
  alertOn: 'deviation > 2σ'
});`,
  },
  {
    id: 'payload',
    heading: 'Payload and gimbal',
    lead: 'Camera pose, lens state and capture coverage tracked against the inspection plan.',
    bullets: ['Gimbal pose feedback', 'Coverage vs plan', 'Capture integrity checks'],
    accent: 'sky',
    demo: 'svgDemo',
    code: `drone.payload.observe({
  gimbal: 'pose',
  camera: 'state',
  coverage: 'plan-07'
});`,
  },
];

const AIRBORNE: PageDef = {
  slug: 'airborne',
  href: 'airborne.html',
  navLabel: 'Airborne',
  title: 'BRIDGE Twin | Airborne Systems',
  description:
    'A live digital twin of an industrial inspection quadcopter - flight state, propulsion health, payload and gimbal telemetry.',
  twin: 'drone',
  live: true,
  hero: {
    eyebrow: 'Airborne',
    heading: ['Every airborne', 'system,', 'digitally paired.'],
    lead: 'From the flight computer to each motor and sensor, every component carries',
    typed: ['live state', 'calibration', 'service history', 'wear signatures'],
    install: 'npm i @bridge/twin',
    cta: 'Read the docs',
  },
  technical: {
    heading: ['Every airborne', 'system', 'digitally paired'],
    lead: 'From the flight computer to each motor and sensor, every component carries live state, calibration and service history.',
  },
  features: DRONE_FEATURES,
  stages: [
    { id: 'hero', kind: 'hero', vh: 3, theme: 'dark', twin: 'drone' },
    { id: 'teardown', kind: 'technical', vh: 4, theme: 'light', twin: 'drone' },
    ...DRONE_FEATURES.map((f): PageStage => ({
      id: f.id, kind: 'feature', vh: 1, theme: 'dark', twin: 'drone',
    })),
    { id: 'docs', kind: 'docs', vh: 1, theme: 'dark', twin: 'drone' },
  ],
};

/* -------------------------------------------------------------------------- */
/* registry                                                                    */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* automotive - the autonomous crossover                                       */
/* -------------------------------------------------------------------------- */

const VEHICLE_FEATURES: FeatureSection[] = [
  {
    id: 'fusion',
    heading: 'Sensor fusion',
    lead: 'Camera, radar and LiDAR resolved onto one clock, so perception is a single state rather than four disagreeing feeds.',
    bullets: ['Camera and radar fusion', 'Synchronised timestamps', 'Occlusion-aware tracking'],
    accent: 'king',
    demo: 'staggeringDemo',
    code: `const vehicle = bridge.twin('vehicle-01');

vehicle.stream([
  'camera.*',
  'radar.*',
  'lidar.points'
]);

vehicle.fuse({ clock: 'synchronised' });`,
  },
  {
    id: 'energy',
    heading: 'Battery and thermal',
    lead: 'Pack temperature, cell balance and coolant loop state tracked module by module across the whole floor.',
    bullets: ['Per-module cell balance', 'Coolant loop state', 'Charge and discharge limits'],
    accent: 'orange',
    demo: 'transformsDemo',
    code: `vehicle.observe('battery', {
  modules: 'all',
  metric: 'temperature',
  window: '5m'
});`,
  },
  {
    id: 'chassis',
    heading: 'Chassis and wheels',
    lead: 'Steering angle, wheel speed and suspension travel at each corner, compared against the commanded path.',
    bullets: ['Per-corner wheel speed', 'Suspension travel', 'Steering vs path error'],
    accent: 'sky',
    demo: 'clockDemo',
    code: `vehicle.stream([
  'wheel.*.speed',
  'suspension.*.travel',
  'steering.angle'
]);`,
  },
];

const AUTOMOTIVE: PageDef = {
  slug: 'automotive',
  href: 'automotive.html',
  navLabel: 'Automotive',
  title: 'BRIDGE Twin | Automotive',
  description:
    'A live digital twin of an autonomous electric crossover — sensor fusion, battery and thermal state, chassis and wheel telemetry.',
  twin: 'vehicle',
  live: true,
  hero: {
    eyebrow: 'Automotive',
    heading: ['Vehicle', 'sensor', 'fusion.'],
    lead: 'Synchronise perception, powertrain and chassis data into one live operational model of',
    typed: ['every corner', 'the whole pack', 'the full sensor set', 'the entire fleet'],
    install: 'npm i @bridge/twin',
    cta: 'Read the docs',
  },
  technical: {
    heading: ['Every system', 'on the vehicle,', 'digitally paired'],
    lead: 'From the drive units to each wheel and sensor, every component carries live state, calibration and service history.',
  },
  features: VEHICLE_FEATURES,
  stages: [
    { id: 'hero', kind: 'hero', vh: 3, theme: 'dark', twin: 'vehicle' },
    { id: 'cutaway', kind: 'technical', vh: 4, theme: 'light', twin: 'vehicle' },
    ...VEHICLE_FEATURES.map((f): PageStage => ({
      id: f.id, kind: 'feature', vh: 1, theme: 'dark', twin: 'vehicle',
    })),
    { id: 'docs', kind: 'docs', vh: 1, theme: 'dark', twin: 'vehicle' },
  ],
};

/* -------------------------------------------------------------------------- */
/* field robotics - the inspection quadruped                                   */
/* -------------------------------------------------------------------------- */

const FIELD_FEATURES: FeatureSection[] = [
  {
    id: 'gait',
    heading: 'Gait and contact',
    lead: 'Foot placement, contact force and slip resolved per leg, so a lost foothold is visible the moment it happens.',
    bullets: ['Per-foot contact force', 'Slip and stumble detection', 'Gait phase tracking'],
    accent: 'lime',
    demo: 'clockDemo',
    code: `const robot = bridge.twin('field-04');

robot.stream([
  'foot.*.force',
  'gait.phase',
  'imu.orientation'
]);`,
  },
  {
    id: 'actuators',
    heading: 'Actuator health',
    lead: 'Torque, temperature and backlash across all twelve joints, compared leg to leg and against the fleet baseline.',
    bullets: ['Per-joint torque', 'Thermal derating', 'Backlash trend'],
    accent: 'yellow',
    demo: 'staggeringDemo',
    code: `robot.compare('joint.*', {
  metric: 'torque.rms',
  baseline: 'fleet',
  alertOn: 'deviation > 2σ'
});`,
  },
  {
    id: 'terrain',
    heading: 'Terrain response',
    lead: 'Body attitude against ground profile, so you can see how the machine reacts to what it walked onto.',
    bullets: ['Ground profile estimate', 'Body attitude response', 'Route replay'],
    accent: 'green',
    demo: 'scrollObserverDemo',
    code: `robot.observe('terrain', {
  window: 'route-12',
  align: 'body.attitude'
});`,
  },
];

const FIELD: PageDef = {
  slug: 'field',
  href: 'field.html',
  navLabel: 'Field robotics',
  title: 'BRIDGE Twin | Field Robotics',
  description:
    'A live digital twin of an industrial inspection quadruped — gait and contact forces, actuator health, terrain response.',
  twin: 'quadruped',
  live: true,
  hero: {
    eyebrow: 'Field robotics',
    heading: ['Every joint.', 'Every foothold.', 'Accounted for.'],
    lead: 'Track actuator health, contact forces and terrain response across',
    typed: ['all twelve joints', 'every foothold', 'the whole route', 'the entire fleet'],
    install: 'npm i @bridge/twin',
    cta: 'Read the docs',
  },
  technical: {
    heading: ['Every joint.', 'Every foothold.', 'Accounted for.'],
    lead: 'Track actuator health, contact forces and terrain response across the complete machine.',
  },
  features: FIELD_FEATURES,
  stages: [
    { id: 'hero', kind: 'hero', vh: 3, theme: 'dark', twin: 'quadruped' },
    { id: 'teardown', kind: 'technical', vh: 4, theme: 'light', twin: 'quadruped' },
    ...FIELD_FEATURES.map((f): PageStage => ({
      id: f.id, kind: 'feature', vh: 1, theme: 'dark', twin: 'quadruped',
    })),
    { id: 'docs', kind: 'docs', vh: 1, theme: 'dark', twin: 'quadruped' },
  ],
};

export const PAGES: Record<string, PageDef> = {
  index: HOME,
  airborne: AIRBORNE,
  automotive: AUTOMOTIVE,
  field: FIELD,
};

/** Header links - only pages whose machine actually exists. */
export const NAV_PAGES: PageDef[] = Object.values(PAGES).filter((p) => p.live);

/** Extra header links that are not machine pages. */
export const NAV_EXTRA = [
  { label: 'Docs', href: '#docs' },
  { label: 'GitHub', href: '#' },
];

export function currentPage(): PageDef {
  const slug = document.body.dataset.page ?? 'index';
  return PAGES[slug] ?? PAGES.index;
}

/**
 * Global scroll progress at a given point in a page's timeline.
 *
 * Stage layouts differ per page, so a fixed table of progress values cannot be
 * shared. Everything that needs a `p` derives it from the page's own stages:
 * `stage` names the beat and `at` is 0..1 through that stage's pinned range.
 */
export function progressAt(page: PageDef, stage: string, at = 0): number {
  const total = page.stages.reduce((s, st) => s + st.vh, 0);
  const scrollable = Math.max(1, total - 1);
  let y = 0;
  for (const st of page.stages) {
    if (st.id === stage) {
      const pinned = Math.max(0, st.vh - 1);
      return Math.min(1, (y + pinned * Math.min(1, Math.max(0, at))) / scrollable);
    }
    y += st.vh;
  }
  return 0;
}

/**
 * Addressable states for the visual suite: every stage, plus mid/end beats for
 * stages long enough to be pinned.
 */
export function routesFor(page: PageDef): Record<string, number> {
  const out: Record<string, number> = {};
  for (const st of page.stages) {
    out[st.id] = progressAt(page, st.id, 0);
    if (st.vh > 1) {
      out[`${st.id}-mid`] = progressAt(page, st.id, 0.5);
      out[`${st.id}-end`] = progressAt(page, st.id, 1);
    }
  }
  out.footer = 1;
  return out;
}
