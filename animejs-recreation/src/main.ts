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
  ACCENTS, BUNDLE_BEATS, BUNDLE_MODULES, FEATURES, HERO, PART_LABELS,
  STAGES, STATE_ROUTES,
} from './content';
import { createStage, observeSize } from './scene/createScene';
import { loadEngine, projectLens, type EngineModel, type LensProjection } from './scene/loadModel';
import { ModelController } from './scene/modelController';
import {
  ScrollController, clamp01, prefersReducedMotion, startLoop,
} from './scene/scrollController';
import { REDUCED_MOTION_P, resolveState, type SceneState } from './scene/sceneStates';
import { LensOverlay } from './ui/lensOverlay';
import { buildPage, type PageRefs } from './ui/sectionLayout';

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

/* public/ is served at the app base, both in dev and in the build. */
const MODEL_URL = `${import.meta.env.BASE_URL}models/anime-engine.glb`;

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

  const page = buildPage(app);
  const stage = createStage(canvas);
  const overlay = new LensOverlay(document.getElementById('lens-layer') ?? app);

  // ---- model ------------------------------------------------------------
  let model: EngineModel;
  try {
    model = await loadEngine(MODEL_URL, (f) => {
      if (loader) loader.style.setProperty('--progress', String(f));
    });
  } catch (err) {
    if (loader) {
      loader.classList.add('is-error');
      loader.textContent = 'Could not load the engine model.';
    }
    throw err;
  }
  const controller = new ModelController(stage, model);

  // ---- lens demos -------------------------------------------------------
  const slotIds = ['hero', ...FEATURES.map((f) => f.id)];
  const demoFor: Record<string, { factory: DemoFactory; accent: string }> = {
    hero: { factory: DEMOS.heroDisplay, accent: ACCENTS.red },
  };
  for (const f of FEATURES) {
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
  const scroll = new ScrollController(STAGES, page.track);
  const typewriter = createTypewriter(page.typedTarget, HERO.typed, reduced);
  const partLabelViews = collectPartLabels(page, model);

  const stopResize = observeSize(document.documentElement, (w, h) => {
    stage.setSize(w, h);
    scroll.measure();
  });

  // Deterministic screenshot routes: /?state=stagger
  const requested = new URLSearchParams(location.search).get('state');
  const forcedP = requested && requested in STATE_ROUTES ? STATE_ROUTES[requested] : null;

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
  const state: SceneState = resolveState(0);
  const proj: { current: LensProjection | null } = { current: null };
  let activeSlot: string | null = null;

  startLoop((dt) => {
    const frame = scroll.read();
    const p = reduced ? (forcedP ?? REDUCED_MOTION_P) : (forcedP ?? frame.progress);

    resolveState(p, state);
    // Responsive framing: the keyframed camera distances are authored for the
    // desktop reference width. On narrower viewports pull back so the engine
    // still fits horizontally instead of being cropped by the screen edges.
    state.radius *= fitFactor(canvas.clientWidth || window.innerWidth);
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
    }

    // ---- which demo is on screen ---------------------------------------
    const stageDef = STAGES[frame.activeIndex];
    const wantSlot =
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
    page.toolboxLabels.style.opacity = String(state.labels);
    page.toolboxLabels.style.visibility = state.labels < 0.02 ? 'hidden' : 'visible';

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
 * Camera pull-back multiplier for narrow viewports.
 *
 * The keyframes are authored against the ~1728px reference width; below about
 * 1100px the lens would be wider than the screen, so the distance is scaled up
 * to keep the whole engine on screen. Capped so it never becomes a dot.
 */
function fitFactor(width: number): number {
  return Math.min(1.9, Math.max(1, 1100 / Math.max(1, width)));
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

function collectPartLabels(page: PageRefs, model: EngineModel): PartLabelView[] {
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
  interface Window { __sceneReady?: boolean }
}
window.requestAnimationFrame(() => {
  window.setTimeout(() => { window.__sceneReady = true; }, 60);
});

export { clamp01 };
