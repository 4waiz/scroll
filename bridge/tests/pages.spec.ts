import { test, expect, type Page } from '@playwright/test';

/**
 * Multi-page checks.
 *
 * Every machine has its own route, its own copy and its own asset. These assert
 * that each page loads only its own twin, that the header links the family
 * together, and that no page renders another machine's content.
 */

const REFERENCE = { width: 1728, height: 912 };

const PAGES = [
  {
    slug: 'index',
    path: '/index.html',
    title: /Real-Time Digital Twin Platform/,
    heading: 'Every joint',
    eyebrow: 'Field robotics',
    model: 'quadruped-field.glb',
    forbidden: 'bridge-engine.glb',
  },
  {
    slug: 'aerospace',
    path: '/aerospace.html',
    title: /Aerospace/,
    heading: 'Digital twin',
    eyebrow: 'Aerospace',
    model: 'bridge-engine.glb',
    forbidden: 'quadruped-field.glb',
  },
  {
    slug: 'airborne',
    path: '/airborne.html',
    title: /Airborne Systems/,
    heading: 'Every airborne',
    eyebrow: 'Airborne',
    model: 'drone-uav.glb',
    forbidden: 'bridge-engine.glb',
  },
  {
    slug: 'automotive',
    path: '/automotive.html',
    title: /Automotive/,
    heading: 'Vehicle',
    eyebrow: 'Automotive',
    model: 'car.glb',
    forbidden: 'bridge-engine.glb',
  },
  {
    slug: 'defence',
    path: '/defence.html',
    title: /Defence Systems/,
    heading: 'Every round',
    eyebrow: 'Defence',
    model: 'sidearm.glb',
    forbidden: 'bridge-engine.glb',
  },
  {
    slug: 'airdefence',
    path: '/airdefence.html',
    title: /Air Defence/,
    heading: 'Radar to rail',
    eyebrow: 'Air defence',
    model: 'launcher.glb',
    forbidden: 'bridge-engine.glb',
  },
];

async function settle(page: Page, frames = 18): Promise<void> {
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
  await page.waitForTimeout(350);
}

for (const p of PAGES) {
  test(`page: ${p.slug}`, async ({ page }) => {
    const errors: string[] = [];
    const requested: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', (r) => requested.push(r.url()));

    await page.setViewportSize(REFERENCE);
    await page.goto(p.path, { waitUntil: 'load' });
    await settle(page);

    await expect(page).toHaveTitle(p.title);
    await expect(page.locator('h2').first()).toContainText(p.heading);
    await expect(page.locator('.eyebrow').first()).toHaveText(p.eyebrow);

    // Only this page's machine is fetched.
    const glbs = requested.filter((u) => u.endsWith('.glb'));
    expect(glbs.some((u) => u.includes(p.model)), `${p.slug} loads ${p.model}`).toBe(true);
    expect(glbs.some((u) => u.includes(p.forbidden)),
           `${p.slug} must not load ${p.forbidden}`).toBe(false);

    await page.screenshot({ path: `screenshots/pages/${p.slug}.png` });
    expect(errors, `console/page errors on ${p.slug}`).toEqual([]);
  });
}

test('header links every machine page', async ({ page }) => {
  await page.setViewportSize(REFERENCE);
  await page.goto('/index.html', { waitUntil: 'load' });
  await settle(page, 8);

  const hrefs = await page.locator('.site-nav a').evaluateAll(
    (els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href')),
  );
  for (const href of [
    'index.html', 'aerospace.html', 'airborne.html',
    'automotive.html', 'defence.html', 'airdefence.html',
  ]) expect(hrefs, `header links ${href}`).toContain(href);

  // The current page is marked.
  await expect(page.locator('.site-nav a.is-current')).toHaveText('Field robotics');

  // And the link actually navigates.
  await page.locator('.site-nav a[href="airborne.html"]').click();
  await page.waitForURL('**/airborne.html');
  await settle(page);
  await expect(page.locator('h2').first()).toContainText('Every airborne');
});

test('footer lists every machine', async ({ page }) => {
  await page.setViewportSize(REFERENCE);
  await page.goto('/index.html', { waitUntil: 'load' });
  await settle(page, 8);

  const hrefs = await page.locator('.site-footer .footer-col a').evaluateAll(
    (els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href')),
  );
  for (const href of [
    'index.html', 'aerospace.html', 'airborne.html',
    'automotive.html', 'defence.html', 'airdefence.html',
  ]) expect(hrefs, `footer links ${href}`).toContain(href);
});
