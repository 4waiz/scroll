import { test, expect, type Page } from '@playwright/test';

/**
 * Responsive audit across the real device range.
 *
 * For every size the page must:
 *   - not overflow horizontally
 *   - keep the header nav inside the viewport
 *   - keep the text column clear of the projected engine on wide layouts
 *   - keep the code card and scrubber on screen and inside the container
 *   - give interactive controls a usable touch target on coarse pointers
 *   - stack the footer cleanly when there is no room for columns
 */

const DEVICES = [
  { name: '2560x1440-desktop-xl', width: 2560, height: 1440, touch: false },
  { name: '1920x1080-desktop', width: 1920, height: 1080, touch: false },
  { name: '1512x982-macbook14', width: 1512, height: 982, touch: false },
  { name: '1440x900-laptop', width: 1440, height: 900, touch: false },
  { name: '1366x768-laptop-sm', width: 1366, height: 768, touch: false },
  { name: '1280x800-laptop-xs', width: 1280, height: 800, touch: false },
  { name: '1024x1366-ipadpro-portrait', width: 1024, height: 1366, touch: true },
  { name: '1024x768-tablet-landscape', width: 1024, height: 768, touch: true },
  { name: '834x1194-ipadair-portrait', width: 834, height: 1194, touch: true },
  { name: '768x1024-tablet-portrait', width: 768, height: 1024, touch: true },
  { name: '430x932-iphone-max', width: 430, height: 932, touch: true },
  { name: '393x852-iphone', width: 393, height: 852, touch: true },
  { name: '390x844-iphone-12', width: 390, height: 844, touch: true },
  { name: '360x800-android', width: 360, height: 800, touch: true },
  { name: '320x568-iphone-se', width: 320, height: 568, touch: true },
];

/** Routes that exercise every distinct layout the page has. */
const ROUTES = ['hero', 'telemetry', 'modular', 'docs', 'footer'];

async function settle(page: Page, frames = 10): Promise<void> {
  await page.waitForFunction(
    () => document.documentElement.classList.contains('is-ready'),
    null,
    { timeout: 60_000 },
  );
  await page.evaluate(
    (n) => new Promise<void>((resolve) => {
      let i = 0;
      const tick = (): void => { if (++i >= n) resolve(); else requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }),
    frames,
  );
  await page.waitForTimeout(220);
}

interface Probe {
  overflow: number;
  vw: number;
  navRight: number;
  containerRight: number;
  /** right edge of the widest text block, and left edge of the lens */
  textRight: number | null;
  textBottom: number | null;
  lensLeft: number | null;
  lensTop: number | null;
  cardBox: { x: number; right: number; bottom: number; w: number } | null;
  scrubBox: { x: number; right: number; bottom: number } | null;
  tinyTargets: string[];
  footerCols: number;
}

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const box = (el: Element | null): DOMRect | null => el ? el.getBoundingClientRect() : null;

    const nav = box(document.querySelector('.site-nav'));
    const container = box(document.querySelector('.stage__sticky .container'));

    // The visible stage's text block, if any.
    const stage = [...document.querySelectorAll('.stage')].find((s) => {
      const r = s.getBoundingClientRect();
      return r.top <= 1 && r.bottom > 1;
    });
    const text = stage ? box(stage.querySelector('.text-block')) : null;
    const card = stage ? box(stage.querySelector('.code-card, .bundle-card')) : null;
    const scrub = stage ? box(stage.querySelector('.scrubber')) : null;

    const lens = window.__lens && window.__lens.visible
      ? {
        left: window.__lens.x - window.__lens.radius,
        top: window.__lens.y - window.__lens.radius,
      }
      : null;

    // Interactive controls that are too small to hit on a touch screen.
    const tiny: string[] = [];
    for (const el of document.querySelectorAll(
      'a, button, input, .doc-card, .sponsor-card, .footer-col a',
    )) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom < 0 || r.top > vh) continue;
      if (r.height < 24) {
        tiny.push(`${el.tagName}.${(el.className || '').toString().split(' ')[0]}@${Math.round(r.height)}`);
      }
    }

    const footerColsEl = document.querySelector('.footer-cols');
    const footerCols = footerColsEl
      ? getComputedStyle(footerColsEl).gridTemplateColumns.split(' ').length
      : 0;

    return {
      overflow: document.documentElement.scrollWidth - vw,
      vw,
      navRight: nav ? nav.right : 0,
      containerRight: container ? container.right : vw,
      textRight: text ? text.right : null,
      textBottom: text ? text.bottom : null,
      lensLeft: lens ? lens.left : null,
      lensTop: lens ? lens.top : null,
      cardBox: card ? { x: card.x, right: card.right, bottom: card.bottom, w: card.width } : null,
      scrubBox: scrub ? { x: scrub.x, right: scrub.right, bottom: scrub.bottom } : null,
      tinyTargets: [...new Set(tiny)].slice(0, 6),
      footerCols,
    };
  });
}

for (const d of DEVICES) {
  test(`responsive: ${d.name}`, async ({ page }) => {
    const problems: string[] = [];
    await page.setViewportSize({ width: d.width, height: d.height });

    for (const route of ROUTES) {
      await page.goto(`/aerospace.html?state=${route}`, { waitUntil: 'load' });
      await settle(page);
      const p = await probe(page);

      if (p.overflow > 1) problems.push(`${route}: horizontal overflow ${p.overflow}px`);
      if (p.navRight > p.vw + 1) problems.push(`${route}: nav overflows by ${Math.round(p.navRight - p.vw)}px`);

      // Two-column layout: the text column sits beside the engine, so they must
      // not collide horizontally. Stacked layout: the text sits above it, so
      // the meaningful check is vertical clearance instead.
      const TWO_COLUMN = 1100;
      if (d.width > TWO_COLUMN) {
        if (p.textRight !== null && p.lensLeft !== null && p.textRight > p.lensLeft + 4) {
          problems.push(
            `${route}: text overlaps lens by ${Math.round(p.textRight - p.lensLeft)}px`,
          );
        }
      } else if (p.textBottom !== null && p.lensTop !== null) {
        // Allow the text to reach a little into the lens's bounding box - the
        // circle's top corners are empty - but not past its upper quarter.
        const slack = (p.lensLeft !== null ? 0 : 0) + 90;
        // 2px tolerance: a sub-pixel overlap is not a layout defect.
        if (p.textBottom > p.lensTop + slack + 2) {
          problems.push(
            `${route}: stacked text runs ${Math.round(p.textBottom - p.lensTop - slack)}px into the lens`,
          );
        }
      }

      if (p.cardBox) {
        if (p.cardBox.right > p.vw + 1) problems.push(`${route}: card off right edge`);
        if (p.cardBox.x < -1) problems.push(`${route}: card off left edge`);
        if (p.cardBox.bottom > d.height + 1) problems.push(`${route}: card below fold`);
      }
      if (p.scrubBox) {
        if (p.scrubBox.right > p.vw + 1) problems.push(`${route}: scrubber off right edge`);
        if (p.scrubBox.bottom > d.height + 1) problems.push(`${route}: scrubber below fold`);
      }
      if (d.touch && p.tinyTargets.length) {
        problems.push(`${route}: touch targets under 24px -> ${p.tinyTargets.join(', ')}`);
      }
      if (route === 'footer' && d.width < 900 && p.footerCols > 1) {
        problems.push(`${route}: footer still ${p.footerCols} columns`);
      }
    }

    await page.goto('/aerospace.html?state=telemetry', { waitUntil: 'load' });
    await settle(page);
    await page.screenshot({ path: `screenshots/responsive/${d.name}.png` });

    expect(problems, `${d.name}\n  - ${problems.join('\n  - ')}`).toEqual([]);
  });
}
