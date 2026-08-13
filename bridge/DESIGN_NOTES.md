# DESIGN_NOTES.md

The design system for the BRIDGE Twin product site. Every value here is the one
the code actually uses — `src/content.ts` for palette and copy, `src/styles.css`
for layout and type, `src/scene/sceneStates.ts` for the 3D beats.

---

## 1. Colour

### 1.1 Surfaces

| Token | Value | Where |
| --- | --- | --- |
| Page background | `#252423` | hero, all feature sections, docs, footer |
| Elevated surface 3 | `#2f2e2d` | code cards, scrubber track |
| Elevated surface 2 | `#2a2928` | doc grid cards |
| Light section background | `#DAD5D0` | the two technical-drawing sections |
| Brand accent | `#FF4713` | BRIDGE wordmark block |

The dark ground is a very slightly warm neutral, **not** pure black. The light
sections are a warm grey.

### 1.2 Foreground ramp

`#f6f4f2` → `#d5d3d1` → `#b4b1af` → `#93908e` → `#625d5b` → `#474543` →
`#393735` → `#2c2a28`

Headings `#f6f4f2` · body `#d5d3d1` · bullet labels `#b4b1af` · bullet arrows
`#93908e` · light-section headings `#2f2e2d`.

### 1.3 Per-section accents

| Section | Hue | Accent |
| --- | --- | --- |
| Live telemetry | red | `#ff4b4b` |
| Thermal fields | orange | `#ffa828` |
| Vibration spectra | turquoise | `#00ffaa` |
| Sensor grid | blue | `#4d9cff` |
| Gas-path tracing | cyan | `#26f2d5` |
| Interactive teardown | lime | `#b7ff54` |
| Flight-cycle replay | yellow | `#ffcc2a` |
| Fleet-wide scope | green | `#8dff55` |

The 12-hue LED ring on the engine face, clockwise from 12 o'clock: red, corail
`#ff7d36`, orange, yellow, citrus `#f9f640`, lime, green, turquoise, cyan, sky
`#05dbe9`, sega `#33b3f1`, king `#4d9cff`. Discrete arcs with dark gaps — not a
continuous gradient — so each segment animates independently.

---

## 2. Typography

Sizes are **fixed**, not viewport-scaled: identical at 1280 px and 1920 px.

| Role | Size | Weight | Line-height | Tracking |
| --- | --- | --- | --- | --- |
| Hero `h2` | 64 px | 700 | 0.865 | normal |
| Light-section `h2` | 40 px | 800 | 0.95 | −0.5 px |
| Feature `h2` | 52 px | 700 | 0.865 | normal |
| Body `p` | 20 px | 600 | 1.25 | normal |
| Bullet links | 16 px | 500 | 24 px pitch | normal |
| Code | 14 px | 400 | 1.4 | normal |

Scale tokens: `4 / 3.25 / 2.5 / 1.75 / 1.25 / 1.125 / 1 / .875 / .75` rem.

**Faces.** Body and headings use **Archivo Variable** at `font-stretch: 112%`
(a wide grotesque with a real width axis). Code uses **JetBrains Mono Variable**.
Both are bundled offline via `@fontsource-variable/*`, so there is no network
font dependency and Playwright renders are deterministic.

---

## 3. Layout grid

| Property | Value |
| --- | --- |
| Container max-width | 1500 px, centred |
| Section padding | 64 px (48 / 36 / 24 at narrower breakpoints) |
| Header height | 4.5 rem |
| Feature heading max-width | 400 px |
| Feature paragraph max-width | 320 px |
| Bullet row pitch | 24 px, arrow glyph 11 × 10 |
| Code card | 336 px wide, `#2f2e2d`, radius 12 px |
| Scrubber | 336 × 40 px, 92 px from the viewport bottom |
| Scrubber ticks | 46 ticks, 1 px, `#5b5855`; 2 px `#ff4b4b` playhead |

### 3.1 Lens geometry

The engine's circular display is the stage for the nine feature demos. It is
**never positioned with a hard-coded pixel value**: `Front_Display` is projected
to screen space every frame and the overlay receives a single
`translate + scale`. Demos author against a fixed 600 × 600 design box.

The engine is panned right of centre by 7 % of viewport width (a screen-space
camera dolly, so it holds at any camera angle) to clear the left text column.

---

## 4. Page structure

21 viewports of sticky stage track, plus a footer:

| Stage | Theme | Length |
| --- | --- | --- |
| Hero | dark | 3 × 100vh |
| Every component, digitally paired | light | 4 × 100vh |
| 8 feature sections | dark | 1 × 100vh each |
| Ship only the subsystems you need | light | 4 × 100vh |
| Integrations | dark | 1 × 100vh |
| Start modelling | dark | 1 × 100vh |
| Footer | dark | auto |

One `WebGLRenderer` and one canvas persist across all of it.

---

## 5. Model states

Camera uses a model-relative frame: `tilt` (angle off the lens axis), `roll`
(swing around the barrel), `camRoll` (on-screen rotation), `radius`, plus the
screen-space pan. FOV 32° throughout — a long lens keeps the barrel from
distorting.

| Progress | State |
| --- | --- |
| 0.00 | assembled, near-frontal |
| 0.05 | rolled so the barrel length reads |
| 0.10 | shell panels release and float clear |
| 0.15 → 0.30 | light technical view: diagonal → vertical → horizontal |
| 0.35 → 0.70 | eight feature sections, dead-on, constant scale |
| 0.755 → 0.895 | modular: assembled → exploded → reduced |
| 0.95 → 1.00 | engine leaves the stage |

Everything is a pure function of scroll progress, so scrolling up retraces
exactly and the model never jumps between sections.

---

## 6. Material treatment

The engine is a **dark technical illustration**, not PBR metal.

- Each material group gets a procedural 512 × 512 matcap (`src/scene/matcap.ts`)
  with `toneMapped = false`, so an authored `#413D3D` lands on screen as
  `#413D3D`.
- Renderer: `NoToneMapping`, sRGB output, exposure 1.0, `scene.environment = null`.
- Metalness 0, no clearcoat, no environment reflections, no white specular.

| Group | Base | Shadow | Highlight |
| --- | --- | --- | --- |
| Outer shell panels | `#413D3D` | `#262424` | `#F5C9AC` |
| Main housing | `#3B3838` | `#232222` | `#E8BEA2` |
| Ribbed grips | `#292828` | `#1D1D1D` | subtle |
| Gear rings | `#2B2929` | `#1F1F1F` | `#D8B296` |
| Internal modules | `#252424` | `#1D1D1D` | `#C2A18B` |
| Fasteners / recesses | `#1D1D1D` / `#181818` | — | minimal |

Away-facing surfaces bottom out at the "dark surface" value, **not** the cavity
value — the cavity tone is reserved for recesses and creases, so mechanical
detail stays readable. The warm edge is deliberately narrow: the rim term is
squared so it catches bevels rather than flooding whole curved panels.

Light sections use genuine hidden-line rendering: meshes are painted the
background colour with a polygon offset while pre-built 30° feature edges draw
on top, so faces occlude the edges behind them.

### 6.1 Measured acceptance targets

Verified by `tests/material-audit.spec.ts` against the rendered frame:

| Metric | Target | Actual |
| --- | --- | --- |
| Lit shell pixels near `#413D3D` | > 50 % | 60.5 % |
| Mean abs(R − G) on housing | < 8 | 2.6 |
| Housing pixels > RGB 245 | ~0 | 0 |
| Copper-hued broad-surface pixels | ~0 | 26 |
| Warm highlight share of model | small | 1.6 % |
| Housing at or below `#1D1D1D` | not crushed | 12.5 % |

---

## 7. Motion rules

- Native scrolling; the wheel is never hijacked.
- Text scrolls with its section while the WebGL stage stays fixed.
- All transitions are pure functions of progress, so they reverse exactly.
- The LED ring has a slow independent spin; in feature sections the tick ring
  tints to the section accent.
- In-lens demos loop on their own cadence and pause off-screen.
- `prefers-reduced-motion` pins the scene to a static state, disables the idle
  spin and typewriter, and unpins the sticky stages so all content is reachable.
