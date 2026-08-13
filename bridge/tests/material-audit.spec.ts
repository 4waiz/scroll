import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

/**
 * Material audit.
 *
 * Renders the exploded frame at the reference capture size and measures the
 * acceptance targets for the graphite correction directly off the pixels:
 * broad-surface colour, channel neutrality, white hotspots, copper
 * contamination, highlight coverage and cavity depth.
 *
 * The screenshot is decoded back inside the page (Image -> canvas -> getImageData)
 * so the audit needs no Node image dependency.
 */

const SHOT = { width: 1522, height: 1270 };
const OUT = 'comparison';

interface Audit {
  total: number;
  background: number;
  model: number;
  housing: number;
  chroma: number;
  /** housing pixels bright enough to count as "clearly lit outer shell" */
  lit: number;
  /** % of lit housing pixels within tolerance of #413D3D */
  litNearBase: number;
  /** % of housing pixels within tolerance of #413D3D */
  nearBase: number;
  /** % of housing pixels in the broad graphite band #2A..#4C */
  inGraphiteBand: number;
  meanAbsRG: number;
  meanAbsGB: number;
  maxAbsRG: number;
  /** housing pixels with any channel > 245 */
  hotspots: number;
  /** housing pixels reading copper/brown */
  copper: number;
  /** % of model pixels that are warm peach highlight */
  peachPct: number;
  /** % of housing pixels at or below #1D1D1D */
  deepPct: number;
  meanHousing: [number, number, number];
}

async function audit(page: import('@playwright/test').Page, pngBase64: string): Promise<Audit> {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);

    const BG: [number, number, number] = [37, 36, 35];
    const BASE: [number, number, number] = [65, 61, 61];

    let background = 0, model = 0, housing = 0, chroma = 0;
    let nearBase = 0, band = 0, hotspots = 0, copper = 0, peach = 0, deep = 0;
    let lit = 0, litNearBase = 0;
    let sumRG = 0, sumGB = 0, maxRG = 0;
    let sr = 0, sg = 0, sb = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];

      // Background: close to the page colour.
      if (Math.abs(r - BG[0]) <= 3 && Math.abs(g - BG[1]) <= 3 && Math.abs(b - BG[2]) <= 3) {
        background++;
        continue;
      }
      model++;

      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;

      // Strongly saturated pixels are the LED arcs / tick ring / lens demo and
      // are deliberately excluded from the graphite audit.
      if (sat > 0.45 && mx > 60) { chroma++; continue; }

      // Warm peach highlight family: warm, light, moderately saturated.
      if (r > 150 && r > b + 18 && sat > 0.12) { peach++; continue; }

      housing++;
      if (mx >= 40) lit++;
      if (mx >= 40 && Math.abs(r - BASE[0]) <= 16 && Math.abs(g - BASE[1]) <= 16
          && Math.abs(b - BASE[2]) <= 16) litNearBase++;
      sr += r; sg += g; sb += b;

      const dRG = Math.abs(r - g), dGB = Math.abs(g - b);
      sumRG += dRG; sumGB += dGB;
      if (dRG > maxRG) maxRG = dRG;

      if (Math.abs(r - BASE[0]) <= 14 && Math.abs(g - BASE[1]) <= 14 && Math.abs(b - BASE[2]) <= 14) nearBase++;
      if (mx >= 42 && mx <= 76) band++;
      if (r > 245 || g > 245 || b > 245) hotspots++;
      // Copper contamination means a *broad graphite surface* carrying a brown
      // hue. Warm pixels inside the deliberate edge highlight are not
      // contamination, so only pixels sitting in the graphite value band count.
      if (mx >= 42 && mx <= 76 && r - b >= 22 && r > g && g >= b) copper++;
      if (mx <= 29) deep++;
    }

    const pct = (n: number, d: number): number => (d ? +((n / d) * 100).toFixed(2) : 0);
    return {
      total: data.length / 4,
      background, model, housing, chroma,
      lit,
      litNearBase: pct(litNearBase, lit),
      nearBase: pct(nearBase, housing),
      inGraphiteBand: pct(band, housing),
      meanAbsRG: +(sumRG / Math.max(1, housing)).toFixed(2),
      meanAbsGB: +(sumGB / Math.max(1, housing)).toFixed(2),
      maxAbsRG: maxRG,
      hotspots,
      copper,
      peachPct: pct(peach, model),
      deepPct: pct(deep, housing),
      meanHousing: [
        Math.round(sr / Math.max(1, housing)),
        Math.round(sg / Math.max(1, housing)),
        Math.round(sb / Math.max(1, housing)),
      ] as [number, number, number],
    };
  }, pngBase64);
}

test('graphite material audit @ exploded frame', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize(SHOT);
  await page.goto('/?state=hero-open', { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, {
    timeout: 60_000,
  });
  await page.waitForTimeout(1200);

  // Hide the DOM layer so the audit measures the rendered model only. The
  // white heading text and the logo's orange block would otherwise register as
  // "white hotspots" and "copper pixels" that the housing does not have.
  await page.addStyleTag({
    content: '#app,.lens-layer,#loading{visibility:hidden !important}',
  });
  await page.waitForTimeout(150);

  const buf = await page.screenshot({ path: `${OUT}/current.png` });
  const stats = await audit(page, buf.toString('base64'));

  // Dump the generated matcaps so the textures exist as real files.
  const dumped = await page.evaluate(async () => {
    // Path string kept in a variable so TypeScript does not try to resolve a
    // Vite-served URL at build time.
    const specifier = '/src/scene/matcap.ts';
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      MATCAPS: Record<string, unknown>;
      paintMatcap: (spec: unknown, size: number) => ImageData;
    };
    const out: { name: string; url: string }[] = [];
    for (const [name, spec] of Object.entries(mod.MATCAPS)) {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 512;
      c.getContext('2d')!.putImageData(mod.paintMatcap(spec, 512), 0, 0);
      out.push({ name, url: c.toDataURL('image/png') });
    }
    return out;
  });
  mkdirSync('public/matcaps', { recursive: true });
  for (const d of dumped) {
    writeFileSync(`public/matcaps/matcap-${d.name}.png`,
      Buffer.from(d.url.split(',')[1], 'base64'));
  }

  console.log('AUDIT ' + JSON.stringify(stats));
});
