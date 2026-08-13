/**
 * Entry point: wires the DOM page, the persistent WebGL stage, the nine in-lens
 * demos and the scroll controller together.
 *
 * The whole page is a pure function of one number - the scroll progress through
 * the stage track - so scrolling up retraces exactly and there are no one-shot
 * transitions to get out of sync.
 */

import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono';
import './styles.css';

import { Vector3 } from 'three';

import {
  ACCENTS, BUNDLE_BEATS, BUNDLE_MODULES, PART_LABELS,
} from './content';
import { createStage, observeSize } from './scene/createScene';
import { projectLens, type LensProjection } from './scene/loadModel';
import { ModelController } from './scene/modelController';
import { TwinManager } from './scene/twins/TwinManager';
import { createTwinLabels } from './scene/twins/twinLabels';
import {
  ScrollController, clamp01, prefersReducedMotion, startLoop,
} from './scene/scrollController';
import {
  REDUCED_MOTION_P, buildTimeline, resolveState, type SceneState,
} from './scene/sceneStates';
import { LensOverlay } from './ui/lensOverlay';
import { buildPage, type PageRefs } from './ui/sectionLayout';
import { currentPage, routesFor } from './pages/pages';

import type { DemoFactory, DemoHandle } from './demos/types';
import { heroDisplay } from './demos/heroDisplay';
import { intuitiveApi } from './demos/intuitiveApi';
import { transformsDemo } from './demos/transformsDemo';
import { scrollObserverDemo } from './demos/scrollObserverDemo';
import { staggeringDemo } from './demos/staggeringDemo';
import { svgDemo } from './demos/svgDemo';
import { draggableDemo } from './demos/draggableDemo';
import { clockDemo } from './demos/clockDemo';
import { responsiveDemo } from './demos/responsiveDemo';

const DEMOS: Record<string, DemoFactory> = {
  heroDisplay, intuitiveApi, transformsDemo, scrollObserverDemo,
  staggeringDemo, svgDemo, draggableDemo, clockDemo, responsiveDemo,
};

/* Model URLs live in scene/twins/twinManifest.ts; TwinManager resolves them
   against the app base for both dev and the build. */

/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const app = document.getElementById('app');
  const canvas = document.getElementById('stage-canvas') as HTMLCanvasElement | null;
  const loader = document.getElementById('loading');
  if (!app || !canvas) throw new Error('Missing #app or #stage-canvas');

  // The stage heights are viewport-relative, so a restored scroll offset from a
  // previous visit lands on a different beat than it did before. Own the scroll
  // position explicitly instead.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const reduced = prefersReducedMotion();
  document.documentElement.classList.toggle('reduced-motion', reduced);

  const pageDef = currentPage();
  const stages = pageDef.stages;
  const page = buildPage(app, pageDef);
  const stage = createStage(canvas);
  const overlay = new LensOverlay(document.getElementById('lens-layer') ?? app);

  // ---- twins ------------------------------------------------------------
  // The hero's engine loads up front; every other machine is fetched lazily,
  // a section ahead of where it is needed.
  // Each page owns exactly one machine, so only that asset is fetched here -
  // no page pays for the rest of the family.
  const twins = new TwinManager(stage.orient);
  const heroTwin = await twins.request(pageDef.twin);
  if (!heroTwin) {
    if (loader) {
      loader.classList.add('is-error');
      loader.textContent = 'Could not load the model for this page.';
    }
    throw new Error(`twin "${pageDef.twin}" failed to load`);
  }
  twins.setActive(pageDef.twin);
  const model = heroTwin.model;
  const controller = new ModelController(stage, twins);
  const labels = createTwinLabels(page.toolboxLabels);

  // ---- lens demos -------------------------------------------------------
  // The in-lens demos live on the engine's circular display. Machines without
  // one (the drone) get no overlay at all - otherwise the slot renders at its
  // default transform in the corner, because there is nothing to project onto.
  const hasLens = model.display !== null;
  const slotIds = hasLens ? ['hero', ...pageDef.features.map((f) => f.id)] : [];
  const demoFor: Record<string, { factory: DemoFactory; accent: string }> = {
    hero: { factory: DEMOS.heroDisplay, accent: ACCENTS.red },
  };
  for (const f of pageDef.features) {
    demoFor[f.id] = { factory: DEMOS[f.demo], accent: ACCENTS[f.accent] };
  }
  const handles = new Map<string, DemoHandle>();
  for (const id of slotIds) {
    const spec = demoFor[id];
    if (!spec?.factory) continue;
    const slot = overlay.slot(id);
    const handle = spec.factory(slot.host, spec.accent);
    slot.setDemo(handle);
    handles.set(id, handle);
  }

  // ---- scroll -----------------------------------------------------------
  const scroll = new ScrollController(stages, page.track);
  const typewriter = createTypewriter(page.typedTarget, pageDef.hero.typed, reduced);
  const partLabelViews = collectPartLabels(page, model);

  const stopResize = observeSize(document.documentElement, (w, h) => {
    stage.setSize(w, h);
    scroll.measure();
  });

  // Deterministic screenshot routes: /?state=stagger
  const requested = new URLSearchParams(location.search).get('state');
  const routes = routesFor(pageDef);
  const forcedP = requested && requested in routes ? routes[requested] : null;

  if (loader) {
    loader.classList.add('is-done');
    window.setTimeout(() => loader.remove(), 420);
  }
  document.documentElement.classList.add('is-ready');

  requestAnimationFrame(() => {
    scroll.measure();
    // Wait a frame so sticky offsets are final, then take the requested state
    // (screenshot routes) or start cleanly at the top.
    if (requested === 'footer') {
      // The footer sits below the stage track, so progress alone cannot reach
      // it - both `docs` and `footer` resolve to p = 1.
      window.scrollTo(0, document.documentElement.scrollHeight);
    } else if (forcedP !== null) {
      scroll.scrollToProgress(forcedP);
    } else if (!location.hash) {
      window.scrollTo(0, 0);
    }
  });

  // ---- render loop ------------------------------------------------------
  const timeline = buildTimeline(pageDef);
  const state: SceneState = resolveState(timeline, 0);
  const proj: { current: LensProjection | null } = { current: null };
  let activeSlot: string | null = null;

  startLoop((dt) => {
    const frame = scroll.read();
    const p = reduced ? (forcedP ?? REDUCED_MOTION_P) : (forcedP ?? frame.progress);

    resolveState(timeline, p, state);

    // ---- active machine -------------------------------------------------
    // Each stage declares its twin. The next stage's asset is prefetched so a
    // machine is already in memory by the time you scroll into its section.
    const stageDef = stages[frame.activeIndex];
    if (stageDef) {
      twins.setActive(stageDef.twin);
      const next = stages[frame.activeIndex + 1];
      if (next) twins.prefetch(next.twin);
    }
    twins.update(reduced ? 0 : dt);
    // Responsive framing: the keyframed camera distances are authored for the
    // desktop reference width. On narrower viewports pull back so the engine
    // still fits horizontally instead of being cropped by the screen edges.
    const vw = canvas.clientWidth || window.innerWidth;
    state.radius *= fitFactor(vw);
    // Nudge the engine right of centre so it clears the left text column. Only
    // on the two-column layout - below the stacking breakpoint the model is
    // already on its own row and should stay centred.
    const stacked = vw <= STACK_BREAKPOINT;
    controller.screenShiftX = stacked ? 0 : 0.07;
    // On the stacked layout the text block sits above the engine. Push the
    // engine down so a tall heading + lead + bullet list on a short viewport
    // cannot run into the lens.
    controller.screenShiftY = stacked ? stackedDrop(canvas.clientHeight || window.innerHeight) : 0;
    controller.apply(state, dt, !reduced);

    // Background + theme follow the scene so the DOM and WebGL never disagree.
    document.body.style.backgroundColor = state.bg;
    document.documentElement.classList.toggle('is-scrolled', frame.scrollY > 40);
    const isLight = state.material === 'line';
    document.documentElement.classList.toggle('is-light', isLight);

    // ---- lens overlay ---------------------------------------------------
    if (model.display) {
      stage.camera.updateMatrixWorld();
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      proj.current = projectLens(model.display, model.displayRadius, stage.camera, w, h);
      overlay.update(proj.current, state.lens);
      // Published so the visual suite can assert the overlay really is welded
      // to the projected display rather than to a hard-coded screen position.
      window.__lens = {
        x: proj.current.x, y: proj.current.y,
        radius: proj.current.radius, visible: proj.current.visible,
      };
    }

    // ---- which demo is on screen ---------------------------------------
    const wantSlot = !hasLens ? null :
      stageDef?.kind === 'feature' ? stageDef.id
        : stageDef?.kind === 'hero' ? 'hero'
          : null;
    if (wantSlot !== activeSlot) {
      activeSlot = wantSlot;
      overlay.setActive(wantSlot);
    }
    // Some demos are genuinely scroll-driven rather than looping (the vibration
    // spectra one draws with scroll). Drive whichever active demo opts in.
    if (wantSlot) {
      const active = handles.get(wantSlot);
      active?.setProgress?.(frame.sectionEnter);
    }

    // ---- scrubbers ------------------------------------------------------
    for (let i = 0; i < page.stages.length; i++) {
      const s = page.stages[i];
      if (!s.scrubber) continue;
      s.scrubber.setProgress(
        i === frame.activeIndex ? frame.sectionProgress : i < frame.activeIndex ? 1 : 0,
      );
    }

    // ---- toolbox leader labels + modular part labels --------------------
    // Leader labels are anchored to real components on the active machine and
    // reprojected every frame, so they survive explode and camera moves.
    labels.setTwin(state.labels > 0.02 ? twins.active : null);
    labels.update(
      stage.camera,
      canvas.clientWidth || window.innerWidth,
      canvas.clientHeight || window.innerHeight,
      state.labels,
    );

    page.partLabels.style.opacity = String(state.partLabels);
    page.partLabels.style.visibility = state.partLabels < 0.02 ? 'hidden' : 'visible';
    if (state.partLabels > 0.02) updatePartLabels(partLabelViews, stage, canvas);

    // ---- bundle card ----------------------------------------------------
    if (stageDef?.kind === 'modular') updateBundle(page, frame.sectionProgress);

    stage.renderer.render(stage.scene, stage.camera);
  });

  window.addEventListener('beforeunload', () => {
    typewriter.stop();
    stopResize();
    overlay.destroy();
    controller.dispose();
    stage.dispose();
  }, { once: true });
}

/**
 * Width at which the two-column composition gives way to a stacked one.
 * Must stay in sync with the `max-width: 1100px` block in styles.css.
 */
const STACK_BREAKPOINT = 1100;

/**
 * Camera pull-back multiplier for narrow viewports.
 *
 * The keyframes are authored against the ~1728px reference width; below about
 * 1100px the lens would be wider than the screen, so the distance is scaled up
 * to keep the whole engine on screen. Capped so it never becomes a dot.
 */
function fitFactor(width: number): number {
  return Math.min(1.9, Math.max(1, STACK_BREAKPOINT / Math.max(1, width)));
}

/**
 * How far down to push the engine on a stacked layout, as a fraction of
 * viewport height. The text block above it is a fixed pixel height, so the
 * shorter the viewport the larger a share it takes and the further the engine
 * has to move to stay clear.
 */
function stackedDrop(height: number): number {
  if (height >= 1000) return 0.06;
  if (height <= 600) return 0.16;
  // Linear between the two anchors.
  return 0.16 - ((height - 600) / 400) * 0.10;
}

/* -------------------------------------------------------------------------- */
/* hero typewriter                                                             */
/* -------------------------------------------------------------------------- */

function createTypewriter(
  target: HTMLElement, words: readonly string[], reduced: boolean,
): { stop(): void } {
  if (reduced) {
    target.textContent = words[0];
    return { stop(): void { /* nothing scheduled */ } };
  }
  let word = 0;
  let chars = 0;
  let deleting = false;
  let timer = 0;

  const step = (): void => {
    const current = words[word % words.length];
    chars += deleting ? -1 : 1;
    target.textContent = current.slice(0, chars);

    let delay = deleting ? 42 : 78;
    if (!deleting && chars === current.length) {
      delay = 1500;
      deleting = true;
    } else if (deleting && chars === 0) {
      deleting = false;
      word++;
      delay = 320;
    }
    timer = window.setTimeout(step, delay);
  };
  timer = window.setTimeout(step, 700);
  return { stop(): void { window.clearTimeout(timer); } };
}

/* -------------------------------------------------------------------------- */
/* modular section: floating per-part KB labels                                */
/* -------------------------------------------------------------------------- */

interface PartLabelView {
  el: HTMLElement;
  target: import('three').Object3D | null;
  world: Vector3;
  /** fixed screen-space nudge so labels sit clear of the part and each other */
  offset: [number, number];
}

/** Radial fan so the six labels never stack on top of one another. */
const LABEL_OFFSETS: [number, number][] = [
  [74, -30], [86, 14], [-96, -34], [92, 46], [-90, 30], [78, -62],
];

function collectPartLabels(
  page: PageRefs,
  model: import('./scene/loadModel').EngineModel,
): PartLabelView[] {
  return PART_LABELS.map((spec, i) => ({
    el: page.partLabels.querySelector<HTMLElement>(`[data-part="${spec.part}"]`)!,
    target: model.byName.get(spec.part)?.object ?? null,
    world: new Vector3(),
    offset: LABEL_OFFSETS[i % LABEL_OFFSETS.length],
  })).filter((v) => v.el);
}

function updatePartLabels(
  views: PartLabelView[],
  stage: ReturnType<typeof createStage>,
  canvas: HTMLCanvasElement,
): void {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  for (const v of views) {
    if (!v.target) { v.el.style.opacity = '0'; continue; }
    v.target.updateWorldMatrix(true, false);
    v.world.setFromMatrixPosition(v.target.matrixWorld).project(stage.camera);
    const x = (v.world.x * 0.5 + 0.5) * w + v.offset[0];
    const y = (-v.world.y * 0.5 + 0.5) * h + v.offset[1];
    const onScreen = v.world.z < 1 && x > -80 && x < w + 80 && y > -40 && y < h + 40;
    v.el.style.opacity = onScreen ? '1' : '0';
    v.el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }
}

/* -------------------------------------------------------------------------- */
/* modular section: bundle-size card                                           */
/* -------------------------------------------------------------------------- */

const BEAT_EDGES = [0.42, 0.72];

function updateBundle(page: PageRefs, sectionProgress: number): void {
  const beat = sectionProgress < BEAT_EDGES[0] ? 0
    : sectionProgress < BEAT_EDGES[1] ? 1 : 2;
  const included = new Set(BUNDLE_BEATS[beat]);

  let total = 0;
  for (const m of BUNDLE_MODULES) if (included.has(m.name)) total += m.kb;

  page.bundle.total.textContent = `${total.toFixed(2)} KB`;

  for (const m of BUNDLE_MODULES) {
    const on = included.has(m.name);
    const seg = page.bundle.segments.get(m.name);
    if (seg) {
      seg.style.flexGrow = on ? String(m.kb) : '0';
      seg.style.opacity = on ? '1' : '0';
    }
    const li = page.bundle.legend.get(m.name);
    if (li) li.classList.toggle('is-off', !on);
  }
}

/* -------------------------------------------------------------------------- */

main().catch((err) => {
  console.error('[anime-recreation] fatal', err);
});

/** Exposed so the Playwright suite can wait for a settled frame. */
declare global {
  interface Window {
    __sceneReady?: boolean;
    __lens?: { x: number; y: number; radius: number; visible: boolean };
  }
}
window.requestAnimationFrame(() => {
  window.setTimeout(() => { window.__sceneReady = true; }, 60);
});

export { clamp01 };
