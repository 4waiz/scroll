# REFERENCE_NOTES.md

Measured reconstruction notes for the clean-room recreation of the Anime.js landing page.

**Sources, in the priority order mandated by the brief**

1. The 18 attached screenshots (primary source of truth)
2. The live site at `https://animejs.com/` — used **only** for measurement of computed
   layout/typography/design-token values and for motion timing. No source code, markup,
   CSS or 3D asset was copied.
3. Own measured reconstruction where 1 and 2 are silent.

---

## 1. Screenshot dimensions and viewport crop

All supplied screenshots are **full-window Windows captures at DPR 1**, not viewport captures.

| Property | Measured value |
| --- | --- |
| Full image size | ~2000 × 1250 px (brief cites the canonical capture as 2048 × 1279) |
| Chrome tab strip + omnibox + bookmarks bar | ~145 px from the top |
| Windows taskbar | ~55 px at the bottom |
| Vertical scrollbar gutter | ~15 px on the right |
| **Derived page viewport crop** | **x ∈ [0, ~1985], y ∈ [145, ~1195] → ≈ 1985 × 1050 CSS px** |

Two screenshots are slightly narrower/offset (the "Springs and draggable", "Advanced
staggering", "SVG toolset" and "Runs like clockwork" frames are captured a few px left of
origin). Their content geometry is identical; only the window origin moved.

**Consequence for the rebuild:** the reference composition is a ~1985 × 1050 viewport.
Everything below is expressed in CSS px at that viewport unless stated otherwise.

---

## 2. Section inventory

Measured from the live document's section boxes at a 1920 × 1080 viewport
(`scrollHeight` = 25 238 px, header = 72 px):

| # | Section | Background | Scroll length | Notes |
| --- | --- | --- | --- | --- |
| 0 | Sticky site header | transparent over dark | 72 px tall | nav: Docs · Easings · Learn · Examples · GitHub · Sponsor |
| 1 | Hero — *All-in-one animation engine.* | dark | **3 × 100vh** | model assembled → rolls to length → shell opens |
| 2 | *The complete animator's toolbox* | **light** | **4 × 100vh** | line-art mode, 4 orientation beats |
| 3–10 | 8 feature sections | dark | **1 × 100vh each** | Intuitive API → Responsive animations |
| 11 | *A lightweight and modular API* | **light** | **4 × 100vh** | line-art, exploded, bundle-size card |
| 12 | *Our sponsors* | dark | 1 × 100vh | sponsor grid |
| 13 | *Start animating* | dark | 1 × 100vh | 3 × 4 documentation grid |
| 14 | Footer | `#252423` | 398 px | 3 columns + newsletter |

The rebuild uses the same rhythm: **3 + 4 + 8 + 4 + 1 + 1 viewports ≈ 21 × 100vh** plus footer.

The WebGL canvas lives in a `position: fixed` stage that persists across every section —
confirmed on the live page (`canvas` is `position:absolute` inside a `position:fixed`
parent). The rebuild uses one persistent canvas for the same reason.

---

## 3. Colours sampled

### 3.1 Backgrounds

| Token | Value | Where |
| --- | --- | --- |
| Dark page background | `#252423` | hero, all feature sections, docs, footer |
| Dark elevated surface 3 | `#2f2e2d` | code cards, scrubber track |
| Dark elevated surface 2 | `#2a2928` | doc grid cards |
| **Light section background** | `#DAD5D0` | toolbox + modular API sections |
| Rim / edge highlight | `#ffc7a8` | warm cream reflections on model edges |
| Shadow | `#212121` | |
| World ambient (dark) | `#423d3d` | |
| Outline (dark mode) | `#101010` | |
| Outline (light mode) | `#000000` | thin technical edge lines |

The "warm near-black" of the screenshots reads as `#252423` / `#262422` — a very slightly
warm neutral, *not* pure black. The light sections read as a warm grey `#DAD5D0`.

### 3.2 Foreground / text ramp

`#f6f4f2` → `#d5d3d1` → `#b4b1af` → `#93908e` → `#625d5b` → `#474543` → `#393735` → `#2c2a28`

- Headings on dark: `#f6f4f2`
- Body paragraphs: `#d5d3d1`
- Bullet link labels: `#b4b1af`
- Bullet arrow glyphs: `#93908e`
- Toolbox heading on light: `#2f2e2d`

### 3.3 Accent ramp (per-section accent = step 1 of each hue)

| Section | Hue name | Accent (step 1) | Step 2 | Deep step 8 |
| --- | --- | --- | --- | --- |
| Intuitive API | red | `#ff4b4b` | `#d34343` | `#2d2423` |
| Enhanced transforms | orange | `#ffa828` | `#d38e27` | `#2d2822` |
| Scroll Observer | turquoise | `#00ffaa` | `#07d38f` | `#232c27` |
| Advanced staggering | king (blue) | `#4d9cff` | `#4584d3` | `#25282b` |
| SVG toolset | cyan | `#26f2d5` | `#26c9b1` | `#242b28` |
| Springs and draggable | lime | `#b7ff54` | `#9ad34a` | `#292c23` |
| Runs like clockwork | yellow | `#ffcc2a` | `#d3aa29` | `#2d2922` |
| Responsive animations | green | `#8dff55` | `#78d34b` | `#282c24` |

Additional hues used by the **LED ring** on the model, read left-to-right around the
bezel in the hero screenshot: red `#ff4b4b`, corail `#ff7d36`, orange `#ffa828`,
yellow `#ffcc2a`, citrus `#f9f640`, lime `#b7ff54`, green `#8dff55`,
turquoise `#00ffaa`, cyan `#26f2d5`, sky `#05dbe9`, sega `#33b3f1`, king `#4d9cff`.

The ring in the screenshots is *segmented* — discrete arcs with dark gaps, each a
different hue, with a strong bloom-free emissive falloff. It is **not** a continuous
rainbow gradient, so the rebuild models each arc as its own object/material.

---

## 4. Typography

Measured computed styles. **Font sizes are fixed, not viewport-scaled** — identical at
1280 px and 1920 px viewport widths.

| Role | Size | Weight | Line-height | Letter-spacing | Colour |
| --- | --- | --- | --- | --- | --- |
| Hero `h2` | 64 px (4 rem) | 700 | 55.36 px (0.865) | normal | `#f6f4f2` |
| Light-section `h2` | 40 px (2.5 rem) | 800 | 38 px (0.95) | −0.5 px | `#2f2e2d` |
| Feature `h2` | 52 px (3.25 rem) | 700 | 44.98 px (0.865) | normal | accent |
| Body `p` | 20 px (1.25 rem) | 600 | 25 px (1.25) | normal | `#d5d3d1` |
| Bullet links | 16 px (1 rem) | ~500 | 24 px row pitch | normal | `#b4b1af` |
| Code | 14 px | 400 | ~19.6 px | normal | see §7 |
| Bundle-size / labels | 12–14 px | 400 | — | — | — |

Type scale tokens: `4 / 3.25 / 2.5 / 1.75 / 1.25 / 1.125 / 1 / .875 / .75` rem.

### 4.1 Typeface substitution (deliberate, documented)

The reference uses a **licensed variable DIN** (`DIN`, axes `wght 100–900`, `wdth`,
`slnt`, site defaults `--wght: 450`, `--wdth: 120`) plus a custom `Mono` and `Digital-7`.
These are not redistributable, so the rebuild substitutes:

| Reference | Substitute | Why |
| --- | --- | --- |
| `DIN` variable | **Archivo Variable** (`wght 100–900`, `wdth 62–125`) | grotesque with a real width axis; set to `font-stretch: 112%` to match DIN's wide `--wdth: 120` default |
| `Mono` | **JetBrains Mono Variable** | similar cap height and stroke weight in the code cards |

Both are bundled offline via `@fontsource-variable/*` so Playwright renders are
deterministic and there is no network font dependency.

---

## 5. Layout grid

Measured at 1920 × 1080 (usable width 1905 after the 15 px scrollbar):

| Property | Value |
| --- | --- |
| Page container max-width | **1500 px**, centred → left edge x = 202.5 |
| Section horizontal padding | **64 px** → content starts x = 267 |
| Header horizontal padding | 24 px |
| Footer padding | `0 24px 24px` |
| Feature heading max-width | **400 px** (forces "Enhanced / transforms" to 2 lines) |
| Feature paragraph max-width | **320–336 px** |
| Hero paragraph max-width | **336 px** |
| Bullet list width | 432 px, row pitch **24 px**, arrow glyph 11 × 10 px at x-offset +4 |
| Divider rule above bullets | 1 px, colour `#474543`, width ≈ 300 px |

At the ~1985 px screenshot viewport the same 1500 px container yields a left content
margin of ≈ (1985 − 15 − 1500) / 2 + 64 = **≈ 289 px**, which matches the measured
heading left edge of ≈ 188–190 px in the screenshots **once the 1500 px cap is removed** —
i.e. the reference container is *not* capped at the screenshot width; the screenshots show
a left content margin of ≈ 9.4 % of viewport width. The rebuild therefore uses
`max-width: 1500px` **with** a `min(64px, 4.5vw)`-style padding so both the 1920 and the
1985 captures reproduce.

### 5.1 Lens / model screen geometry

The feature-section demo layer is a **full-viewport fixed box** (measured 1905 × 1080,
centred). Therefore the circular engine face is centred on the viewport centre.

| Property | Measured from screenshots (viewport ≈ 1985 × 1050) |
| --- | --- |
| Lens centre | ≈ (49.5 % width, 50 % height) → viewport centre |
| Outer coloured LED ring radius | ≈ 400 px → **≈ 38 % of viewport height** |
| Inner tick-ring radius | ≈ 355 px |
| Dark display (glass) radius | ≈ 300 px |
| Active demo content radius | ≈ 210 px |
| Hero model | same centre, but pushed right and scaled ≈ 1.25× vs feature sections |

**Implementation rule:** the demo overlay is *not* hard-coded. Each frame the
`Front_Display` object is projected to screen space and the overlay is positioned and
scaled from that projection, so the alignment survives any camera move or viewport size.

### 5.2 Code card

| Property | Value |
| --- | --- |
| Position | right-aligned to the container inner edge, above the scrubber |
| Width | **336 px** |
| Background | `#2f2e2d` |
| Border radius | **12 px** |
| Padding | ~16 px |
| Copy icon | 14 × 14 px, top-right, colour `#93908e` |
| Font | mono 14 px / 19.6 px |

### 5.3 Progress scrubber ("timeline indicator")

| Property | Measured value |
| --- | --- |
| Box | x = 1303, y = 948, **336 × 40 px** |
| Background | `#2f2e2d` |
| Border radius | **12 px** |
| Right edge | flush with container inner edge (1639 = 1703 − 64) |
| Distance from viewport bottom | **92 px** |
| Ticks | ~46 fine vertical grey ticks, 1 px, colour ≈ `#5b5855`, ~7 px pitch |
| Playhead | 2–3 px wide, `#ff4b4b`, full tick height, position = section scroll progress |

On the light sections the scrubber keeps the dark `#2f2e2d` fill (clearly visible in the
toolbox and modular screenshots), providing contrast against `#DAD5D0`.

---

## 6. Model states observed

| State | Screenshot | Camera | Model |
| --- | --- | --- | --- |
| **A. Hero front 3/4** | 1 | ~ front, slight right offset, mild perspective | fully assembled, face-on, LED ring fully lit, display shows striped/dotted abstract |
| **B. Hero rolled** | 2 | orbited ~55° so the barrel length reads | assembled, tilted ~30° from vertical, face lower-left |
| **C. Hero opening** | 3 | further orbit, wider | 4 curved shell plates detached and floating away |
| **D. Hero open wide** | 4 | pulled back | shells further out, internals visible, model diagonal |
| **E. Toolbox line-art diagonal** | 5 | light bg, orthographic feel | full technical line drawing, diagonal, leader lines + labels |
| **F. Toolbox vertical** | 6 | light bg | model rotated to near-vertical, labels re-anchored |
| **G. Toolbox horizontal** | 7 | light bg | model horizontal, lens at right, faint accent tint on lens |
| **H–O. Feature sections** | 8–14 | dead-on front, constant scale | assembled, face-on; only the in-lens demo and accent colour change |
| **P. Modular assembled** | 15 | light bg, 3/4 high angle | technical line art, gear stack, bundle card shows 27.13 KB |
| **Q. Modular exploded** | 16 | light bg | parts fanned out with per-part KB labels; card shows 18.80 KB |
| **R. Modular minimal** | 17 | light bg | fewer parts, radial pods + shells; card shows 11.50 KB |
| **S. Docs / footer** | 18 | dark | model gone / faded out above |

### 6.1 Bundle-size card (modular section)

Dark card, lower right. Title "Bundle size", right-aligned total in mono
(`27.13 KB` → `18.80 KB` → `11.50 KB` across the three captured beats). Below: a single
horizontal stacked bar of coloured segments, then a **3-column legend** with coloured
dots: Timer / Animation / Timeline · Animatable / Draggable / Scroll · Scope / SVG /
Stagger · Spring / WAAPI.

Measured per-module weights from the live page: Timer 5.60 KB, Animation +5.20 KB,
Timeline +0.55 KB, Animatable +0.40 KB, Draggable +6.41 KB, Scroll +4.30 KB,
Scope +0.22 KB, SVG 0.35 KB. Per-part floating labels seen in screenshot 16:
2.55 KB, 3.63 KB, 0.28 KB, 0.18 KB, 0.27 KB, 1.63 KB.

---

## 7. Copy and code transcribed from the screenshots

| Section | Heading | Paragraph |
| --- | --- | --- |
| Hero | All-in-one animation engine. | A fast and flexible JavaScript library to animate ▍ *(typewriter)* |
| Toolbox | The complete animator's toolbox | Break free from browser limitations and animate anything on the web with a single API. |
| Intuitive API | Intuitive API | Animate faster with an easy-to-use, yet powerful animation API. |
| Enhanced transforms | Enhanced transforms | Smoothly blend individual CSS transform properties with a versatile composition API. |
| Scroll Observer | Scroll Observer | Synchronise and trigger animations on scroll with the Scroll Observer API. |
| Advanced staggering | Advanced staggering | Create stunning effects in seconds with the built-in Stagger utility function. |
| SVG toolset | SVG toolset | Morph shapes, follow motion paths, and draw lines easily with the built-in SVG utilities. |
| Springs and draggable | Springs and draggable | Drag, snap, flick and throw HTML elements with the fully-featured Draggable API. |
| Runs like clockwork | Runs like clockwork | Orchestrate animation sequences and keep callbacks in sync with the powerful Timeline API. |
| Responsive animations | Responsive animations | Make animations respond to media queries easily with the Scope API. |
| Modular API | A lightweight and modular API | Keep your bundle size small by only importing the parts you need. |
| Start animating | Start animating | Get started quickly with our in-depth documentation. |

Bullet triplets per feature section, and the code sample shown in each card, are recorded
verbatim in `src/content.ts`. Code samples are the library's own public API usage as
displayed on screen (e.g. `animate('.square', { rotate: 90, loop: true, ease: 'inOutExpo' })`).

Toolbox leader-line labels — left column: `timer`, `easings`, `draggable`, `scroll`,
`scope`; right column: `waapi`, `timeline`, `stagger`, `svg`, `spring`, `animation`.

Docs grid (3 columns × 4 rows, each an accent dot + label + `→`):
Getting started · Timer · Animation / Timeline · Animatable · Draggable / Scope · Scroll ·
SVG / Utils · Easings · WAAPI.

Footer columns: **Platinum sponsors** (Become a sponsor ×2) · **Site** (Home,
Documentation, Easings editor, Learn) · **Socials** (X / Twitter, Bluesky, GitHub,
CodePen). Newsletter: "Stay in the loop", placeholder "Enter your email", button
"Subscribe". Logo bottom-left with a small accent dot, copyright line beneath.

---

## 8. Animation observations (timing / behaviour)

- **Scroll is native.** No wheel hijacking. Long beats are built from sticky stages that
  are 3–4 viewports tall; the sticky content stays pinned while progress 0→1 drives the
  scene state.
- **Text scrolls normally** with its section while the WebGL stage and the lens demo stay
  fixed. This is why the heading sits at a different height in each supplied screenshot
  (measured heading tops range from ~10 % to ~75 % of the viewport) — those captures were
  simply taken at different scroll offsets inside a 100vh section.
- **Reversibility.** All transitions are pure functions of scroll progress, so scrolling
  up retraces exactly. The rebuild therefore stores states declaratively and interpolates,
  rather than firing one-shot tweens.
- **Model rotation** is continuous and eased across a whole sticky stage, never snapped.
  Between adjacent sections the model never jumps: the end state of one stage is the start
  state of the next.
- **LED ring** segments have a slow independent rotation plus a subtle per-segment
  intensity flicker; in the feature sections the ring desaturates toward the section
  accent hue.
- **In-lens demos** loop independently of scroll, at their own cadence, and are paused
  when their section is off-screen.
- **Scrubber playhead** maps linearly to the current section's scroll progress and
  resets per section.
- **Light↔dark transitions** cross-fade the background colour and swap the model's
  material mode over roughly the first 15 % of the incoming section.

---

## 9. Camera angles (rebuilt values)

Field of view 32° throughout (a long-ish lens keeps the barrel from distorting, matching
the screenshots' compressed perspective). Radius from target ≈ 13–17 units.

| State | Azimuth | Elevation | Radius | Target |
| --- | --- | --- | --- | --- |
| Hero front | 4° | 3° | 13.0 | (0, 0, 0) |
| Hero rolled | 46° | 16° | 14.5 | (0, 0, 0.4) |
| Hero opening | 62° | 22° | 16.5 | (0, 0, 0) |
| Toolbox diagonal | 38° | 18° | 15.5 | (0, 0, 0) |
| Toolbox vertical | 24° | 6° | 15.0 | (0, 0, 0) |
| Toolbox horizontal | 78° | 10° | 15.0 | (0, 0, 0) |
| Feature (all 8) | 0° | 0° | 12.4 | (0, 0, 0) |
| Modular assembled | 34° | 26° | 16.0 | (0, 0, 0) |
| Modular exploded | 30° | 22° | 18.0 | (0, 0, 0) |

Model long axis is local **Z**; the root is rotated to present the face to camera.

---

## 10. Deliberate deviations

1. **Typeface** — Archivo Variable / JetBrains Mono substitute the licensed DIN / Mono
   (§4.1). Glyph widths differ slightly, so heading wrap points are matched by tuning
   `max-width` rather than by copying pixel positions.
2. **3D model** — authored from scratch in Blender by `blender/build_model.py`. It matches
   the reference *silhouette and detail density* but is not a copy; part counts, section
   proportions and greeble layout are the rebuild's own.
3. **Model proportions vs the brief's numbers** — the brief suggested a main radius of
   2.2 BU with a total length of 5.5–6 BU, which is a 1.3 : 1 barrel. The supplied
   screenshots unambiguously show a barrel roughly **2.5 : 1**, and the brief itself ranks
   the screenshots above every other source. Radius was kept at the specified 2.2 and the
   length extended to ~11 BU. A 1.3 : 1 object simply does not read as the reference.
4. **Sponsor wall** — the live page lists ~50 named individual sponsors. The rebuild
   reproduces the section's layout and the "Become a sponsor" cards but does not
   reproduce third-party personal names.
5. **Hero typewriter** — the reference types a rotating list of animatable targets; the
   rebuild types the same idea with its own word list.
6. **Brand** — the page is rebranded to **BRIDGE** at the client's request. The supplied
   wordmark (white letterforms + `#FF4713` accent block) replaces the original lockup in
   the header and footer; the page title, package name in the install pill, sponsor copy
   and copyright follow. The 12-hue per-section accent ramp (§3.3) is *kept*, because it
   is structural to the design being recreated rather than brand colour.

---

## 11. Correction to §1 — the screenshots' CSS viewport

§1 derived a ~1985 × 1050 crop by treating the captures as DPR 1. Rebuilding at that size
put the content inset at 15.5 % of viewport width against the reference's measured 9.5 %.

Solving the measured inset against the known layout (1500 px container, 64 px gutter)
gives a device-to-CSS ratio of about **1.15**, i.e. a **CSS viewport of ≈ 1728 × 912** —
the captures were taken with display scaling, not at DPR 1. At that size the container,
gutters, heading widths and lens diameter all line up with the screenshots.

The Playwright suite therefore compares composition at **1728 × 912**, and exercises the
raw pixel sizes from the brief (2048 × 1279 down to 390 × 844) separately as a breakpoint
sweep. This does not change any measured value in §3–§5; it changes only the viewport at
which those values reproduce the reference framing.
