/**
 * Builds the whole scrolling document from src/content.ts.
 *
 * The page is a single "stage track" of sticky stages sitting above a normal
 * footer. Every stage pins its content for as long as its scene beat lasts, so
 * scrolling drives the WebGL state while the text scrolls naturally past it -
 * which is exactly why the supplied screenshots show the heading at a different
 * height in each capture.
 */

import {
  ACCENTS, BRAND, BUNDLE_MODULES, DOCS, FEATURES, FOOTER, HERO, MODULAR,
  NAV_LINKS, PART_LABELS, SPONSORS, STAGES, TOOLBOX,
  type AccentName, type StageDef,
} from '../content';
import { createCodeCard, createInstallButton, type CodeCard } from './codeCards';
import { createProgressIndicator, type ProgressIndicator } from './progressIndicator';

export interface StageRefs {
  def: StageDef;
  el: HTMLElement;
  sticky: HTMLElement;
  scrubber: ProgressIndicator | null;
  card: CodeCard | null;
}

export interface PageRefs {
  stages: StageRefs[];
  track: HTMLElement;
  typedTarget: HTMLElement;
  toolboxLabels: HTMLElement;
  partLabels: HTMLElement;
  bundle: BundleCardRefs;
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** The supplied BRIDGE wordmark, served from public/. */
function brandMark(size: 'header' | 'footer' = 'header'): HTMLImageElement {
  const img = new Image();
  img.src = `${import.meta.env.BASE_URL}${BRAND.logo}`;
  img.alt = BRAND.name;
  img.className = `brand__mark brand__mark--${size}`;
  img.decoding = 'async';
  return img;
}

const ARROW = `<svg class="arrow" viewBox="0 0 12 10" aria-hidden="true"><polygon points="0,0 12,5 0,10"></polygon></svg>`;
const LINK_ARROW = `<svg class="ext" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 9L9 1M9 1H3.5M9 1v5.5"></path></svg>`;

/* -------------------------------------------------------------------------- */
/* shared pieces                                                               */
/* -------------------------------------------------------------------------- */

function bulletList(items: readonly string[]): HTMLElement {
  const ul = el('ul', 'feature-links');
  for (const label of items) {
    const li = el('li');
    li.innerHTML = `${ARROW}<span>${label}</span>`;
    ul.appendChild(li);
  }
  return ul;
}

function textBlock(
  heading: string | string[], lead: string, accent?: string,
  bullets?: readonly string[], size: 'hero' | 'feature' | 'light' = 'feature',
): HTMLElement {
  const block = el('div', `text-block text-block--${size}`);
  const h = el('h2');
  if (Array.isArray(heading)) {
    h.innerHTML = heading.map((line) => `<span>${line}</span>`).join('');
  } else {
    h.textContent = heading;
  }
  if (accent) h.style.color = accent;
  block.appendChild(h);

  const p = el('p', 'lead', lead);
  block.appendChild(p);

  if (bullets) {
    block.appendChild(el('hr', 'rule'));
    block.appendChild(bulletList(bullets));
  }
  return block;
}

/* -------------------------------------------------------------------------- */
/* header                                                                      */
/* -------------------------------------------------------------------------- */

function buildHeader(): HTMLElement {
  const header = el('header', 'site-header');
  const inner = el('div', 'container site-header__inner');

  const brand = el('a', 'brand');
  brand.href = '#top';
  brand.appendChild(brandMark());
  brand.setAttribute('aria-label', `${BRAND.name} home`);

  const nav = el('nav', 'site-nav');
  const ul = el('ul');
  for (const link of NAV_LINKS) {
    const li = el('li');
    const a = el('a', undefined, link);
    a.href = '#';
    li.appendChild(a);
    ul.appendChild(li);
  }
  nav.appendChild(ul);

  inner.append(brand, nav);
  header.appendChild(inner);
  return header;
}

/* -------------------------------------------------------------------------- */
/* stages                                                                      */
/* -------------------------------------------------------------------------- */

function buildHero(sticky: HTMLElement): HTMLElement {
  const c = el('div', 'container stage-grid');

  const block = el('div', 'text-block text-block--hero');
  const h = el('h2');
  h.innerHTML = HERO.heading.map((line) => `<span>${line}</span>`).join('');
  block.appendChild(h);

  const p = el('p', 'lead');
  p.innerHTML = `${HERO.lead} <span class="typed"></span><i class="caret"></i>`;
  block.appendChild(p);

  const actions = el('div', 'hero-actions');
  actions.appendChild(createInstallButton(HERO.install));
  const learn = el('button', 'ghost-btn');
  learn.type = 'button';
  learn.innerHTML = `<span>${HERO.cta}</span><svg viewBox="0 0 10 12" aria-hidden="true"><path d="M5 0v10M1 6.5L5 11l4-4.5"></path></svg>`;
  actions.appendChild(learn);
  block.appendChild(actions);

  const sponsor = el('div', 'hero-sponsor');
  sponsor.innerHTML = `<span>${HERO.sponsoredBy}</span><div class="sponsor-chip" aria-label="Sponsor logo placeholder"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="15"></circle><circle cx="22" cy="22" r="7"></circle><circle cx="22" cy="22" r="1.8"></circle></svg></div>`;

  c.append(block, sponsor);
  sticky.appendChild(c);
  return block.querySelector('.typed') as HTMLElement;
}

function buildToolbox(sticky: HTMLElement): HTMLElement {
  const c = el('div', 'container stage-grid');
  c.appendChild(textBlock(TOOLBOX.heading.split('\n'), TOOLBOX.lead,
                          undefined, undefined, 'light'));
  // Leader labels are no longer static markup: they are driven by
  // scene/twins/twinLabels.ts from the active machine's 3D anchors, so they
  // track the model through explode and camera moves. This element is kept as
  // the mount point for that layer.
  const labels = el('div', 'toolbox-labels');
  c.appendChild(labels);
  sticky.appendChild(c);
  return labels;
}

function buildFeature(sticky: HTMLElement, index: number): { card: CodeCard } {
  const f = FEATURES[index];
  const c = el('div', 'container stage-grid');
  c.appendChild(textBlock(f.heading, f.lead, ACCENTS[f.accent], f.bullets, 'feature'));

  const corner = el('div', 'corner-stack');
  const card = createCodeCard(f.code, `${f.heading} code example`);
  corner.appendChild(card.el);
  c.appendChild(corner);

  sticky.appendChild(c);
  sticky.dataset.accent = ACCENTS[f.accent];
  return { card };
}

export interface BundleCardRefs {
  el: HTMLElement;
  total: HTMLElement;
  bar: HTMLElement;
  segments: Map<string, HTMLElement>;
  legend: Map<string, HTMLElement>;
}

function buildBundleCard(): BundleCardRefs {
  const card = el('aside', 'bundle-card');

  const head = el('div', 'bundle-card__head');
  head.appendChild(el('h3', undefined, MODULAR.cardTitle));
  const total = el('span', 'bundle-card__total', '0.00 KB');
  head.appendChild(total);

  const bar = el('div', 'bundle-card__bar');
  const segments = new Map<string, HTMLElement>();
  for (const m of BUNDLE_MODULES) {
    const seg = el('i', 'bundle-seg');
    seg.style.background = ACCENTS[m.accent];
    seg.dataset.module = m.name;
    bar.appendChild(seg);
    segments.set(m.name, seg);
  }

  const legend = el('ul', 'bundle-card__legend');
  const legendMap = new Map<string, HTMLElement>();
  for (const m of BUNDLE_MODULES) {
    const li = el('li');
    li.innerHTML = `<i class="dot" style="background:${ACCENTS[m.accent]}"></i><span>${m.name}</span>`;
    legend.appendChild(li);
    legendMap.set(m.name, li);
  }

  card.append(head, bar, legend);
  return { el: card, total, bar, segments, legend: legendMap };
}

function buildModular(sticky: HTMLElement): { bundle: BundleCardRefs; partLabels: HTMLElement } {
  const c = el('div', 'container stage-grid');
  c.appendChild(textBlock(MODULAR.heading, MODULAR.lead, undefined, undefined, 'light'));

  const partLabels = el('div', 'part-labels');
  for (const p of PART_LABELS) {
    const tag = el('span', 'part-label');
    tag.dataset.part = p.part;
    tag.innerHTML = `<i class="dot" style="background:${ACCENTS[p.accent]}"></i><span>${p.kb}</span>`;
    partLabels.appendChild(tag);
  }
  c.appendChild(partLabels);

  const bundle = buildBundleCard();
  const corner = el('div', 'corner-stack');
  corner.appendChild(bundle.el);
  c.appendChild(corner);

  sticky.appendChild(c);
  return { bundle, partLabels };
}

function buildSponsors(sticky: HTMLElement): void {
  const c = el('div', 'container stage-centre');
  const h = el('h2', 'centre-heading', SPONSORS.heading);
  const p = el('p', 'centre-lead', SPONSORS.lead);
  const grid = el('div', 'sponsor-grid');
  for (const name of SPONSORS.items) {
    const a = el('a', 'sponsor-card');
    a.href = '#';
    a.setAttribute('aria-label', `${SPONSORS.cta}: ${name}`);
    a.innerHTML =
      `<div class="sponsor-chip"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="15"></circle><circle cx="22" cy="22" r="7"></circle><circle cx="22" cy="22" r="1.8"></circle></svg></div>` +
      `<span>${name}</span>${LINK_ARROW}`;
    grid.appendChild(a);
  }
  c.append(h, p, grid);
  sticky.appendChild(c);
}

function buildDocs(sticky: HTMLElement): void {
  const c = el('div', 'container stage-centre');
  c.appendChild(el('h2', 'centre-heading', DOCS.heading));
  c.appendChild(el('p', 'centre-lead', DOCS.lead));

  const grid = el('div', 'docs-grid');
  for (const item of DOCS.items) {
    const a = el('a', 'doc-card');
    a.href = '#';
    a.innerHTML =
      `<i class="dot" style="background:${ACCENTS[item.accent as AccentName]}"></i>` +
      `<span>${item.label}</span>` +
      `<svg class="doc-card__arrow" viewBox="0 0 14 10" aria-hidden="true"><path d="M0 5h12M8.5 1.5L12 5l-3.5 3.5"></path></svg>`;
    grid.appendChild(a);
  }
  c.appendChild(grid);
  sticky.appendChild(c);
}

/* -------------------------------------------------------------------------- */
/* footer                                                                      */
/* -------------------------------------------------------------------------- */

function buildFooter(): HTMLElement {
  const footer = el('footer', 'site-footer');
  const c = el('div', 'container');

  const cols = el('div', 'footer-cols');
  for (const col of FOOTER.columns) {
    const section = el('div', 'footer-col');
    section.appendChild(el('h4', undefined, col.title));
    const list = el('ul');
    for (const link of col.links) {
      const li = el('li');
      const a = el('a');
      a.href = '#';
      // Off-site columns get the diagonal arrow, in-site ones the straight one.
      a.innerHTML = `<span>${link}</span>${col.external
        ? LINK_ARROW
        : `<svg class="ext" viewBox="0 0 14 10" aria-hidden="true"><path d="M0 5h12M8.5 1.5L12 5l-3.5 3.5"></path></svg>`}`;
      li.appendChild(a);
      list.appendChild(li);
    }
    section.appendChild(list);
    cols.appendChild(section);
  }

  const bottom = el('div', 'footer-bottom');

  const brandCol = el('div', 'footer-brand');
  const footerBrand = el('div', 'brand brand--footer');
  footerBrand.appendChild(brandMark('footer'));
  brandCol.appendChild(footerBrand);
  brandCol.appendChild(el('p', 'copyright', FOOTER.copyright));
  brandCol.appendChild(el('p', 'disclaimer', FOOTER.disclaimer));

  const news = el('form', 'newsletter');
  news.addEventListener('submit', (e) => e.preventDefault());
  news.innerHTML =
    `<h4>${FOOTER.newsletterTitle}</h4>` +
    `<div class="newsletter__row">` +
    `<input type="email" placeholder="${FOOTER.newsletterPlaceholder}" aria-label="${FOOTER.newsletterPlaceholder}" />` +
    `<button type="submit">${FOOTER.newsletterButton}</button>` +
    `</div>`;

  bottom.append(brandCol, news);
  c.append(cols, bottom);
  footer.appendChild(c);
  return footer;
}

/* -------------------------------------------------------------------------- */
/* entry point                                                                 */
/* -------------------------------------------------------------------------- */

export function buildPage(root: HTMLElement): PageRefs {
  root.appendChild(buildHeader());

  const track = el('div', 'stage-track');
  track.id = 'top';

  const stages: StageRefs[] = [];
  let typedTarget!: HTMLElement;
  let toolboxLabels!: HTMLElement;
  let partLabels!: HTMLElement;
  let bundle!: BundleCardRefs;
  let featureIndex = 0;

  for (const def of STAGES) {
    const stage = el('section', `stage stage--${def.kind} theme-${def.theme}`);
    stage.dataset.stage = def.id;
    stage.style.height = `${def.vh * 100}vh`;

    const sticky = el('div', 'stage__sticky');
    stage.appendChild(sticky);

    let scrubber: ProgressIndicator | null = null;
    let card: CodeCard | null = null;

    switch (def.kind) {
      case 'hero':
        typedTarget = buildHero(sticky);
        break;
      case 'toolbox':
        toolboxLabels = buildToolbox(sticky);
        break;
      case 'feature': {
        const built = buildFeature(sticky, featureIndex++);
        card = built.card;
        break;
      }
      case 'modular': {
        const built = buildModular(sticky);
        bundle = built.bundle;
        partLabels = built.partLabels;
        break;
      }
      case 'sponsors':
        buildSponsors(sticky);
        break;
      case 'docs':
        buildDocs(sticky);
        break;
    }

    // The reference shows the scrubber on the animated stages only - the hero
    // and the two closing text sections do not carry one.
    if (def.kind !== 'docs' && def.kind !== 'sponsors' && def.kind !== 'hero') {
      scrubber = createProgressIndicator();
      const corner = sticky.querySelector('.corner-stack')
        ?? sticky.querySelector('.container')!;
      if (corner.classList.contains('corner-stack')) corner.appendChild(scrubber.el);
      else {
        const stack = el('div', 'corner-stack');
        stack.appendChild(scrubber.el);
        corner.appendChild(stack);
      }
    }

    track.appendChild(stage);
    stages.push({ def, el: stage, sticky, scrubber, card });
  }

  root.appendChild(track);
  root.appendChild(buildFooter());

  return { stages, track, typedTarget, toolboxLabels, partLabels, bundle };
}
