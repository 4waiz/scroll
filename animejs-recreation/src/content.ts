/**
 * Single source of truth for every string, colour and section on the page.
 *
 * Product: BRIDGE Twin - a real-time digital twin of a large commercial
 * turbofan. The engine referenced is the GE9X, the powerplant of the Boeing
 * 777X. BRIDGE is the vendor; the aircraft and engine manufacturers are named
 * only to identify the equipment being modelled (see FOOTER.disclaimer).
 */

/* -------------------------------------------------------------------------- */
/* palette                                                                     */
/* -------------------------------------------------------------------------- */

export const PALETTE = {
  bg1: '#252423',
  bg2: '#2a2928',
  bg3: '#2f2e2d',
  bg4: '#353433',
  light: '#DAD5D0',
  fg1: '#f6f4f2',
  fg2: '#d5d3d1',
  fg3: '#b4b1af',
  fg4: '#93908e',
  fg5: '#625d5b',
  fg6: '#474543',
  fg7: '#393735',
  fg8: '#2c2a28',
  rim: '#ffc7a8',
} as const;

export const ACCENTS = {
  red: '#ff4b4b',
  corail: '#ff7d36',
  orange: '#ffa828',
  yellow: '#ffcc2a',
  citrus: '#f9f640',
  lime: '#b7ff54',
  green: '#8dff55',
  turquoise: '#00ffaa',
  cyan: '#26f2d5',
  sky: '#05dbe9',
  sega: '#33b3f1',
  king: '#4d9cff',
  indigo: '#7c85ff',
  lavender: '#a369ff',
  purple: '#c06ddf',
  magenta: '#e962bf',
  pink: '#ff718b',
} as const;

export type AccentName = keyof typeof ACCENTS;

/** LED arc hues, clockwise from 12 o'clock, matching the Blender material names. */
export const LED_ORDER: AccentName[] = [
  'red', 'corail', 'orange', 'yellow', 'citrus', 'lime',
  'green', 'turquoise', 'cyan', 'sky', 'sega', 'king',
];

/* -------------------------------------------------------------------------- */
/* brand                                                                       */
/* -------------------------------------------------------------------------- */

export const BRAND = {
  name: 'BRIDGE',
  productName: 'BRIDGE Twin',
  logo: 'bridge-logo.svg',
  color: '#FF4713',
  tagline: 'Real-Time Digital Twin Platform',
} as const;

export const NAV_LINKS = [
  'Platform', 'Docs', 'Fleet', 'Research', 'GitHub', 'Contact',
] as const;

export const HERO = {
  heading: ['Digital twin', 'of the', 'GE9X.'],
  lead: 'A live physics twin of the turbofan that powers the 777X. Streaming',
  typed: [
    'every sensor',
    'thermal fields',
    'rotor dynamics',
    'the full gas path',
    'an entire fleet',
  ],
  install: 'npm i @bridge/twin',
  cta: 'Read the docs',
  sponsoredBy: 'Deployed with',
} as const;

/* -------------------------------------------------------------------------- */
/* light "teardown" section                                                    */
/* -------------------------------------------------------------------------- */

export const TOOLBOX = {
  heading: 'Every component, digitally paired',
  lead: 'From the fan case to the tail bearing, each part carries its own live state, tolerances and service history.',
  /** leader-line labels, drawn bottom-left and top-right of the model */
  labelsLeft: ['fan', 'booster', 'gearbox', 'bearings', 'nacelle'],
  labelsRight: ['exhaust', 'turbine', 'combustor', 'hpc', 'bleed', 'inlet'],
} as const;

/* -------------------------------------------------------------------------- */
/* the eight dark feature sections                                             */
/* -------------------------------------------------------------------------- */

export interface FeatureSection {
  id: string;
  heading: string;
  lead: string;
  bullets: [string, string, string];
  accent: AccentName;
  /** module name in src/demos */
  demo: string;
  code: string;
}

export const FEATURES: FeatureSection[] = [
  {
    id: 'telemetry',
    heading: 'Live telemetry',
    lead: 'Stream twelve thousand sensor channels from the test cell to the browser with sub-frame latency.',
    bullets: ['Per-channel sample rates', 'Lossless replay buffer', 'Built-in unit conversion'],
    accent: 'red',
    demo: 'intuitiveApi',
    code: `subscribe('engine.n1', {
  rate: 200,
  units: 'rpm',
  onSample: pushToRotor,
});`,
  },
  {
    id: 'thermal',
    heading: 'Thermal fields',
    lead: 'Resolve combustor and turbine temperatures across the full annulus, blended from sparse probes.',
    bullets: ['Sparse probe interpolation', 'Transient soak modelling', 'Hot-spot detection'],
    accent: 'orange',
    demo: 'transformsDemo',
    code: `solveThermal(annulus, {
  probes: egt.channels,
  method: 'rbf',
  transient: true,
  horizon: 900,
  detect: 'hotspot',
});`,
  },
  {
    id: 'vibration',
    heading: 'Vibration spectra',
    lead: 'Track shaft orders and blade-pass harmonics as the spool sweeps through its operating range.',
    bullets: ['Order tracking', 'Waterfall spectrograms', 'Resonance margins'],
    accent: 'turquoise',
    demo: 'scrollObserverDemo',
    code: `orderTrack(accel.hp, {
  orders: [1, 2, 22, 44],
  window: 'hann',
  sweep: 'n2',
  emit: onSpectrum({ live: true }),
});`,
  },
  {
    id: 'sensors',
    heading: 'Sensor grid',
    lead: 'Every instrumented station on one plate, so drift and dropout are obvious at a glance.',
    bullets: ['Station mapping', 'Drift detection', 'Redundancy voting'],
    accent: 'king',
    demo: 'staggeringDemo',
    code: `const plate = {
  grid: [13, 13],
  from: 'core',
};

createPlate()
  .bind('.probe', {
    health: score([1.1, .75], plate),
    mode: 'voting',
  }, sweep(200, plate));`,
  },
  {
    id: 'gaspath',
    heading: 'Gas-path tracing',
    lead: 'Follow a single streamline from the inlet lip through the core and out the nozzle.',
    bullets: ['Streamline solver', 'Stage-by-stage totals', 'Efficiency deltas'],
    accent: 'cyan',
    demo: 'svgDemo',
    code: `trace('.particle', {
  ...alongPath('.streamline'),
});

draw(streamline('.core'), {
  progress: '0 1',
});

morphStage('.stage-a', {
  to: shapeOf('.stage-b'),
});`,
  },
  {
    id: 'teardown',
    heading: 'Interactive teardown',
    lead: 'Grab any module, pull it clear of the stack and inspect its state without leaving the twin.',
    bullets: ['Grab and release physics', 'Snap-back to station', 'Service-history overlay'],
    accent: 'lime',
    demo: 'draggableDemo',
    code: `makeDetachable('.module', {
  restore: spring({
    stiffness: 120,
    damping: 6,
  })
});`,
  },
  {
    id: 'cycles',
    heading: 'Flight-cycle replay',
    lead: 'Scrub a complete cycle — taxi, takeoff, climb, cruise, descent — and keep every channel in step.',
    bullets: ['Synchronised channels', 'Phase markers', 'Variable-rate playback'],
    accent: 'yellow',
    demo: 'clockDemo',
    code: `createCycle()
  .phase('.takeoff', {
    egt: '+=180',
    duration: 50,
  }, ramp(10))
  .phase('.cruise', {
    n1: 360,
    duration: 1920,
  }, '<');`,
  },
  {
    id: 'fleet',
    heading: 'Fleet-wide scope',
    lead: 'Roll one engine up to a whole fleet and the same queries answer across every tail number.',
    bullets: ['Tail-number scoping', 'Cross-fleet baselines', 'Deviation ranking'],
    accent: 'green',
    demo: 'responsiveDemo',
    code: `createScope({
  fleet: {
    widebody: 'family = 777X',
  }
})
.query(({ matches }) => {
  const wide = matches.widebody;
  compareBaseline('.engine', {
    egtMargin: wide ? 0 : [-50, 50, -50],
    fuelBurn: wide ? [-50, 50, -50] : 0,
  }, rank(100));
});`,
  },
];

/* -------------------------------------------------------------------------- */
/* light "modular SDK" section                                                 */
/* -------------------------------------------------------------------------- */

export const MODULAR = {
  heading: 'Ship only the subsystems you need',
  lead: 'The runtime is modular. A cockpit dashboard does not pay for the full physics solver.',
  cardTitle: 'Runtime size',
} as const;

/**
 * Per-module weights are chosen so the three captured beats total exactly
 * 27.13 KB, 18.80 KB and 11.50 KB.
 */
export const BUNDLE_MODULES: { name: string; kb: number; accent: AccentName }[] = [
  { name: 'Telemetry', kb: 5.6, accent: 'corail' },
  { name: 'Solver', kb: 5.2, accent: 'orange' },
  { name: 'Replay', kb: 0.7, accent: 'yellow' },
  { name: 'Alerts', kb: 0.4, accent: 'citrus' },
  { name: 'Physics', kb: 6.41, accent: 'lime' },
  { name: 'Thermal', kb: 4.3, accent: 'turquoise' },
  { name: 'Scope', kb: 0.22, accent: 'green' },
  { name: 'Geometry', kb: 0.35, accent: 'cyan' },
  { name: 'Spectra', kb: 0.4, accent: 'sega' },
  { name: 'Fleet', kb: 1.63, accent: 'king' },
  { name: 'Export', kb: 1.92, accent: 'lavender' },
];

/** Which modules are included at each of the three captured beats. */
export const BUNDLE_BEATS: string[][] = [
  // 27.13 KB - the full runtime
  BUNDLE_MODULES.map((m) => m.name),
  // 18.80 KB - drop the physics solver and the exporter
  ['Telemetry', 'Solver', 'Replay', 'Alerts', 'Thermal', 'Scope', 'Geometry', 'Spectra', 'Fleet'],
  // 11.50 KB - a read-only dashboard
  ['Telemetry', 'Solver', 'Replay'],
];

/** Floating per-part labels seen in the exploded view. */
export const PART_LABELS: { part: string; kb: string; accent: AccentName }[] = [
  { part: 'Gear_Ring_01', kb: 'HPC · 11 st', accent: 'turquoise' },
  { part: 'Gear_Ring_02', kb: 'LPT · 6 st', accent: 'green' },
  { part: 'Internal_Module_03', kb: 'FADEC A', accent: 'king' },
  { part: 'Detail_Ring_05', kb: 'VBV ring', accent: 'cyan' },
  { part: 'Internal_Module_05', kb: 'Oil scav.', accent: 'yellow' },
  { part: 'Shell_Panel_01', kb: 'Fan cowl', accent: 'lavender' },
];

/* -------------------------------------------------------------------------- */
/* integrations / docs / footer                                                */
/* -------------------------------------------------------------------------- */

export const SPONSORS = {
  heading: 'Fits your hangar stack',
  lead: 'BRIDGE Twin reads the formats your maintenance and design systems already speak.',
  cta: 'View integration',
  items: ['STEP AP242', 'ARINC 429', 'OPC UA', 'MQTT Sparkplug', 'Parquet', 'S1000D'],
} as const;

export const DOCS = {
  heading: 'Start modelling',
  lead: 'Stand up your first twin in an afternoon with our reference guides.',
  /** 3 columns x 4 rows, read row-wise. */
  items: [
    { label: 'Getting started', accent: 'red' },
    { label: 'Telemetry', accent: 'corail' },
    { label: 'Solver', accent: 'orange' },
    { label: 'Replay', accent: 'yellow' },
    { label: 'Alerts', accent: 'citrus' },
    { label: 'Physics', accent: 'lime' },
    { label: 'Scope', accent: 'green' },
    { label: 'Thermal', accent: 'turquoise' },
    { label: 'Geometry', accent: 'cyan' },
    { label: 'Spectra', accent: 'sega' },
    { label: 'Fleet', accent: 'king' },
    { label: 'API reference', accent: 'lavender' },
  ] as { label: string; accent: AccentName }[],
} as const;

export const FOOTER = {
  columns: [
    { title: 'Platform', links: ['Overview', 'Telemetry', 'Simulation', 'Fleet'], external: false },
    { title: 'Resources', links: ['Documentation', 'API reference', 'Changelog', 'Status'], external: false },
    { title: 'Company', links: ['About BRIDGE', 'Careers', 'Contact', 'LinkedIn'], external: true },
  ],
  newsletterTitle: 'Engineering notes',
  newsletterPlaceholder: 'Enter your work email',
  newsletterButton: 'Subscribe',
  copyright: '© 2026 BRIDGE',
  disclaimer:
    'BRIDGE is an independent software vendor. Aircraft and engine designations are used only to identify the equipment being modelled and do not imply any affiliation with, or endorsement by, their manufacturers.',
} as const;

/* -------------------------------------------------------------------------- */
/* page structure                                                              */
/* -------------------------------------------------------------------------- */

export type StageKind = 'hero' | 'toolbox' | 'feature' | 'modular' | 'sponsors' | 'docs';

export interface StageDef {
  id: string;
  kind: StageKind;
  /** height in viewport units - sticky stages are taller than 1 */
  vh: number;
  theme: 'dark' | 'light';
}

/** 3 + 4 + 8x1 + 4 + 1 + 1 = 21 viewports. */
export const STAGES: StageDef[] = [
  { id: 'hero', kind: 'hero', vh: 3, theme: 'dark' },
  { id: 'toolbox', kind: 'toolbox', vh: 4, theme: 'light' },
  ...FEATURES.map((f): StageDef => ({
    id: f.id, kind: 'feature', vh: 1, theme: 'dark',
  })),
  { id: 'modular', kind: 'modular', vh: 4, theme: 'light' },
  { id: 'sponsors', kind: 'sponsors', vh: 1, theme: 'dark' },
  { id: 'docs', kind: 'docs', vh: 1, theme: 'dark' },
];

/**
 * Deterministic screenshot routes used by the Playwright suite.
 *
 * The stage track is 21 viewports tall and 20 of them are scrollable, so a
 * stage beginning at S viewports sits at p = S / 20.
 */
export const STATE_ROUTES: Record<string, number> = {
  hero: 0.0,
  'hero-side': 0.05,
  'hero-open': 0.10,
  toolbox: 0.15,
  'toolbox-vertical': 0.21,
  'toolbox-exploded': 0.30,
  telemetry: 0.35,
  thermal: 0.40,
  vibration: 0.45,
  sensors: 0.50,
  gaspath: 0.55,
  teardown: 0.60,
  cycles: 0.65,
  fleet: 0.70,
  modular: 0.755,
  'modular-exploded': 0.83,
  'modular-minimal': 0.895,
  sponsors: 0.95,
  docs: 1.0,
  footer: 1.0,
};
