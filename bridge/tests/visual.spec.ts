import { test, expect, type Page } from '@playwright/test';
import { PAGES, routesFor } from '../src/pages/pages';

/** Home-page states, derived from that page's own stage layout. */
const STATE_ROUTES = routesFor(PAGES.index);

/**
 * Deterministic state captures.
 *
 * Every scene state is addressable as /?state=<name>, so a capture is a plain
 * navigation rather than a scripted scroll - which keeps the frames stable
 * between runs and lets them be diffed against the reference screenshots.
 */

const SHOT_DIR = 'screenshots/actual';

/**
 * Reference viewport.
 *
 * The supplied screenshots are ~2000 x 1250 full-window captures, but their
 * *CSS* viewport is smaller: solving the measured content inset (heading left
 * edge at 9.5% of image width) against a 1500px container with 64px gutters
 * puts the device/CSS ratio at ~1.15, i.e. a CSS viewport of about 1728 x 912.
 * Composition is compared at that size; the raw pixel sizes from the brief are
 * exercised separately by the breakpoint sweep below.
 */
const REFERENCE = { width: 1728, height: 912 };

/** Breakpoints the brief asks to validate. */
const BREAKPOINTS = [
  { name: '2048x1279', width: 2048, height: 1279 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1536x864', width: 1536, height: 864 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];

/** Wait until the model has loaded and a few frames have settled. */
async function settle(page: Page, frames = 24): Promise<void> {
  await page.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, {
    timeout: 60_000,
  });
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const tick = (): void => {
          if (++i >= n) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    frames,
  );
  // Let the CSS opacity transitions on the lens slots finish.
  await page.waitForTimeout(450);
}

async function freezeAnimations(page: Page): Promise<void> {
  // Pin the looping demos to a fixed point so repeated runs match.
  await page.addStyleTag({
    content: `*, *::before, *::after { animation-play-state: paused !important; }`,
  });
}

test.describe('scene states', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(REFERENCE);
  });

  for (const state of Object.keys(STATE_ROUTES)) {
    test(`state: ${state}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });

      await page.goto(`/?state=${state}`, { waitUntil: 'load' });
      await settle(page);
      await freezeAnimations(page);
      await page.screenshot({ path: `${SHOT_DIR}/${state}.png` });

      expect(errors, `console/page errors on ?state=${state}`).toEqual([]);
    });
  }
});

test.describe('layout invariants', () => {
  test('no horizontal overflow at any breakpoint', async ({ page }) => {
    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/?state=telemetry', { waitUntil: 'load' });
      await settle(page, 12);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${bp.name}`).toBeLessThanOrEqual(1);

      await page.screenshot({ path: `${SHOT_DIR}/bp-${bp.name}.png` });
    }
  });

  test('lens overlay is centred on the projected display', async ({ page }) => {
    await page.setViewportSize(REFERENCE);
    await page.goto('/?state=sensors', { waitUntil: 'load' });
    await settle(page);

    const box = await page.evaluate(() => {
      const slot = document.querySelector('.lens-slot.is-active');
      if (!slot || !window.__lens) return null;
      const r = slot.getBoundingClientRect();
      return {
        cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width,
        lens: window.__lens,
      };
    });

    expect(box, 'an active lens slot and a published projection exist').not.toBeNull();

    // The real invariant: the overlay is welded to the projected Front_Display,
    // wherever that lands. The engine is panned right of centre to clear the
    // text column, so asserting a fixed screen position would only encode the
    // current composition.
    expect(box!.lens.visible).toBe(true);
    expect(Math.abs(box!.cx - box!.lens.x)).toBeLessThan(2);
    expect(Math.abs(box!.cy - box!.lens.y)).toBeLessThan(2);

    // And it is right of centre, as intended.
    expect(box!.lens.x).toBeGreaterThan(REFERENCE.width / 2);
    // Measured on the reference: dark glass diameter ~600px at this viewport.
    expect(box!.w).toBeGreaterThan(380);
    expect(box!.w).toBeLessThan(900);
  });

  test('scrubber sits at the measured corner offset', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/?state=thermal', { waitUntil: 'load' });
    await settle(page, 12);

    const box = await page.evaluate(() => {
      const stage = [...document.querySelectorAll('.stage--feature')].find((s) => {
        const r = s.getBoundingClientRect();
        return r.top <= 1 && r.bottom > 1;
      });
      const sc = stage?.querySelector('.scrubber');
      if (!sc) return null;
      const r = sc.getBoundingClientRect();
      return { w: r.width, h: r.height, fromBottom: window.innerHeight - r.bottom };
    });

    expect(box).not.toBeNull();
    // Reference: 336 x 40, 92px from the viewport bottom.
    expect(Math.abs(box!.w - 336)).toBeLessThan(3);
    expect(Math.abs(box!.h - 40)).toBeLessThan(3);
    expect(Math.abs(box!.fromBottom - 92)).toBeLessThan(6);
  });

  test('reduced motion still renders full content', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(REFERENCE);
    await page.goto('/', { waitUntil: 'load' });
    await settle(page, 12);

    const headings = await page.locator('h2').allTextContents();
    expect(headings.length).toBeGreaterThanOrEqual(12);
    await page.screenshot({ path: `${SHOT_DIR}/reduced-motion.png`, fullPage: false });
  });
});
