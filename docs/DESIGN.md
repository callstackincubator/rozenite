# Rozenite design

Near-black, one bright accent, white type. Light grotesk headlines, uppercase mono for
everything that labels. Square corners, 1px hairlines, no shadows, no gradients. Imagery is
dithered pixel art in the accent, never photos or illustrations. It is the Callstack product
look shared with Apex (lime), Simlock (orange), Appduct (cyan) and agent-device (violet);
Rozenite's accent is crimson-rose, the colour of the mineral's red crystals in dark rock.

**Scope.** This file governs the website (landing page, docs theme, plugin directory, welcome
page), social cards, slides, diagrams, videos and any other brand visual. It does not govern
the DevTools panel UI that plugins build with `@rozenite/ui`; that work follows
[agents/working-on-ui-components.md](../agents/working-on-ui-components.md). Where the two
seem to disagree, the panel UI follows its own guide and this file only applies to pictures
of it on the website.

## Colour

Dark is the default and the only mode for marketing surfaces.

| Token | Value | Use |
| --- | --- | --- |
| `bg` | `#0a0a0a` | Page background |
| `surface` | `#111111` | Hovered cells, panels |
| `field` | `#161616` | Inputs, inline code, chips |
| `line` | `rgb(255 255 255 / 0.08)` | Hairlines: frame, section rows, cell borders |
| `line-strong` | `rgb(255 255 255 / 0.16)` | Window and input borders, outlined buttons |
| `text` | `#ffffff` | Headlines, primary text |
| `muted` | `rgb(255 255 255 / 0.62)` | Body copy, nav links |
| `faint` | `rgb(255 255 255 / 0.5)` | Metadata, section numbers, line numbers (the dimmest text that still passes 4.5:1) |
| `accent` | `#ff4f7b` | Brand, primary actions, highlights (6.3:1 on `bg`) |
| `accent-hover` | `#ff9fb2` | Hover on accent fills |
| `accent-rgb` | `255 79 123` | The accent for `rgb()` mixes and the dither palette |
| `on-accent` | `#0a0a0a` | Text on accent fills, always dark |

- One accent, used sparingly: the mark and wordmark, the primary action, the second beat of a
  headline, strings in code, live state in animations. Never for status (success, error,
  warning), even though it is red: an error row in a pictured panel is white text with an
  `ERR` label, not crimson.
- Anything filled with the accent carries dark text.
- Docs in light mode: white background, black text, neutral greys, and a deeper crimson for
  accent text and links (`#c2143f`, 6.1:1 on white) and for rules (`#d6204c`). The bright
  accent stays only as a fill under dark text, such as the wordmark, and as the mark.
- Greys are neutral. No tinted greys.
- Every piece of text, code punctuation included, meets 4.5:1 against its background.
- Rozenite's old violet (`#8232ff`) is retired on the website. It is agent-device's family
  colour now; do not bring it back as a second accent.

## The mark

The mark is the stepped crystal from `website/public/logo.svg`: seven steps wide, ten tall,
one column at the tip, widening by one step each side twice, three full-width rows, then
narrowing to the base. As a 7×10 bitmap:

```
...#...
..###..
..###..
.#####.
.#####.
#######
#######
#######
.#####.
..###..
```

- Always the accent on dark, or `on-accent` when it sits on an accent fill. Never violet,
  outlined, rotated, shaded or with a gradient. It keeps the accent in light mode too.
- Rendered on the step grid with crisp edges, at a height that is a multiple of 10px where it
  matters (favicon, window tag) so each step stays whole.
- Nav and docs header lockup: the mark, then the wordmark block, then the `BY CALLSTACK`
  chip. Where only a square fits (favicon, app icon, avatar), the mark alone.
- The mark is also the seed of the signature dither scene, so the imagery and the logo are
  the same shape.

## Type

| Role | Font | Size | Weight | Tracking | Leading |
| --- | --- | --- | --- | --- | --- |
| Hero headline | Switzer | `clamp(2rem, 1.3rem + 2.6vw, 3.5rem)` | 500 | -0.035em | 1.08 |
| Section headline | Switzer | `clamp(1.75rem, 1.3rem + 1.6vw, 2.75rem)` | 500 | -0.03em | 1.1 |
| Card title | Switzer | 1.125rem | 500 | -0.01em | 1.3 |
| Lede | Switzer | 1–1.125rem | 400 | 0 | 1.55, `muted` |
| Body | Switzer | 0.9375rem | 400 | 0 | 1.55, `muted` |
| Label | Geist Mono | 0.75rem | 400 | 0.08em, UPPERCASE | — |
| Code | Geist Mono | 0.8125rem | 400 | 0 | 1.75 |
| Closing wordmark | Switzer | as wide as the frame (`21.6cqi`, as Appduct's) | 500 | -0.045em | 0.8, `accent` |

- Fonts are free: Switzer (Fontshare, ITF Free Font License) and Geist Mono (OFL), both
  self-hosted as woff2 files in `website/src/fonts/`. No paid or proprietary fonts.
  Fallbacks: Arial; system monospace.
- Headlines run two beats; the second is in the accent: "Plug-and-play panels *for React
  Native DevTools.*" No italics.
- Targets are always listed in this order: React Native (iOS, Android), Expo, Re.Pack, React
  Native Web, Lynx. Bundlers in this order: Metro, Re.Pack, Webpack, rspeedy.
- Mono labels carry structure: nav links, buttons, tabs, section numbers, package names, tool
  names, metadata. Sentences are never mono.
- Surfaces the docs call experimental carry an `EXPERIMENTAL` label wherever they are
  introduced: mono, `faint`, on `field`. Today that is Rozenite for Lynx, Rozenite for Web and
  the standalone app. Rozenite for Agents is not experimental and never carries the label.
  Check the docs before adding or dropping one.

## Layout

- **The frame.** Content sits in one centred column, `min(100% - 2 × gutter, 75rem)`, whose
  left and right `line` hairlines run the full page height. Gutter `clamp(1rem, 3vw, 2rem)`;
  inner padding `clamp(1.25rem, 3vw, 2.5rem)`.
- **Sections** open on a full-width hairline row: `[01]  OFFICIAL PLUGINS` in mono, the
  number in `faint`. Then a headline block with generous top padding, then content.
- **Cells.** Grids of equal cells divided by `line` hairlines (right and bottom borders),
  no gaps, no fills. A cell that is a link fills with `surface` on hover. A grid never ends
  with an empty cell at any width: pick counts that divide by the column counts you use
  (the official plugins grid is 14 plugins plus two link cells, 16, for 4, 2 and 1 columns).
- **Spacing** steps in 4px; section rhythm `clamp(2.5rem, 6vw, 5rem)`.
- Corner radius is 0 everywhere. No shadows, no blur except the sticky nav's backdrop.
- Phone width: one column, 16px side gutter, never horizontal scroll.

## Components

- **Wordmark.** "ROZENITE" in Switzer 500, uppercase, `on-accent` on an `accent` block with
  tight padding, after the mark and followed by a `BY CALLSTACK` mono chip in `muted` on
  `#1a1a1a` (dropped on phones). The block is the bright accent in every theme.
- **Nav.** Sticky, `rgb(10 10 10 / 0.86)` with backdrop blur, hairline under it. Lockup left,
  mono links centred (Docs, Plugins, Agents, GitHub), a dark `GET STARTED` button right.
- **Buttons.** Mono uppercase 0.75rem, 2.5rem tall, square. Primary: accent fill, dark text.
  Dark: `#1a1a1a` fill, white text. 120ms colour transitions.
- **CTA bar.** The main call to action is a full-frame-width accent block,
  `clamp(4.5rem, 9vw, 7rem)` tall, a mono label centred: `GET STARTED →`.
- **Window.** For code and terminals: `bg` fill, `line-strong` border, a bar with a mini
  accent wordmark tag, a mono title in `faint` (file name, `zsh` or `agent`) and three thin
  window controls (×, –, □) on the right.
- **DevTools window.** The picture of React Native DevTools with Rozenite in it: a Window
  titled `React Native DevTools`, then a tab strip. Built-in tabs (Console, Sources, Network,
  Memory) are mono labels in `faint`; Rozenite plugin tabs carry a 6px accent square before
  the label; the selected tab is white with a 2px accent underline. The panel body is a mono
  table: a header row of `faint` uppercase labels, rows divided by `line`, values in white,
  a value that just changed flashed in the accent. HTTP status codes and errors stay white:
  status never takes the accent. The row the story is about is picked out with a `surface`
  fill and a 2px accent bar on its left. Never draw Chrome's real UI or icons; this is a
  diagram of it.
- **Code.** Zero-padded line numbers (`01`, `02`) in `faint`, keywords and punctuation in
  dimmed white, functions and types in white, strings and numbers in the accent. Empty
  numbered lines pad short snippets to a common height. In the docs, code blocks are framed
  by a hairline only: no accent rule, no line numbers. No ASCII diagrams; they overflow.
- **Command bar.** `$` in the accent, the command in mono, a `COPY` label button on the right,
  `line-strong` border. The install command is `npx rozenite@latest init`.
- **Agent transcript.** In an `agent` window: the user's request in white after `>`, each
  Rozenite call on its own line as `● domain · tool {args}` with the dot in the accent and the
  arguments in `faint`, results indented in `muted`, the agent's conclusion after `✓` in the
  accent. Domain and tool names are real (`console · getMessages`, `network · listRequests`,
  `react-navigation · navigate`).
- **Tabs.** Equal-width cells across the frame, mono labels in `faint`; the selected tab is
  white with a 2px accent underline.
- **Marquee.** A hairline row of mono labels scrolling left (about 38s per loop), each led by
  a 6px accent square, ends faded with a mask. Pauses on hover; static under reduced motion.
- **Pixel icons.** Drawn on a 9×9 grid, one square per pixel, `currentColor`, rendered at
  multiples of 9px with crisp edges. Each official plugin has one; the mark is drawn on its
  own 7×10 grid, never squeezed into 9×9.
- **Plugin cell.** Pixel icon in the accent, plugin name as a card title, the package name in
  accent mono, one line on what the panel shows, and an `AGENT` label when the plugin also
  registers agent tools.
- **Device frames.** Phones are dark (`#050505`) rectangles with pixel-stepped corners (4px
  steps, never rounded) and a 1px `#313131` outline that follows every step without a break,
  a black notch block (iPhone) or punch hole and three-square nav bar (Android). Apps inside
  are minimal: a header with the screen title flush left and a count in a small square on the
  right (accent when non-zero), Switzer UI text, mono prices and labels, product imagery as
  dot or line patterns.
- **Variant switcher.** Only on prototype pages: a fixed mono `A B C` strip bottom right,
  `bg` fill, `line-strong` border, the current one filled with the accent.
- **Closing.** CTA bar, then the giant accent wordmark, then a single footer row:
  `© YEAR ROZENITE BY CALLSTACK` left, mono links right (Docs, Plugin directory, llms.txt,
  GitHub, Discord, MIT license, Callstack).

## Pixel imagery

All imagery is ordered dithering of a generated scene, drawn on canvas.

- **Grain:** 2 CSS px cells, scaled with `image-rendering: pixelated`. Fully filled cells,
  no gaps.
- **Palette:** three tones, `bg` → a 30% mix of the accent into `bg` (a dark crimson,
  `#541f2c`) → the accent, with a 4×4 Bayer threshold between neighbouring tones. On
  black the dark crimson midtones read as crystal in rock; keep the middle tone, it is what
  makes the scenes look like the mineral.
- **Scenes:**
  - *Crystals* (the signature): a druse of the mark. Stepped crystals with the mark's
    silhouette rise from the bottom edge: a dense cluster of about thirteen medium crystals
    around the `focus` (where the product visual sits), tallest at the centre, smaller and
    dimmer toward the edges; a bed of small dim ones along the whole bottom; a few tiny ones
    loose in the upper field. Keep them medium: sizes follow the shorter side of the scene
    and a step never grows past about 28px, or the crystals start to read as a city skyline.
    Each crystal carries a dark gap around its silhouette so it separates from the ones
    behind. Each crystal is shaded as a faceted stone: the left half lit, the
    right half at about 60%, a bright rim on its top steps, a vertical facet line, darker
    toward the base. Behind them, dark rock: low noise in the bottom tones with a faint glow
    around the focus. Motion: a glint band sweeps diagonally across the facets every few
    seconds, and short pulses climb each crystal from base to tip, each at its own speed.
    It reads as red crystals in dark rock, and as what is inside the app rising into view.
  - *Traffic*: horizontal lanes of short dashes, alternate lanes moving right and left, like
    messages crossing the bridge between the app and its panel, both ways. Denser around the centre line. For backdrops behind a
    bridge, a pipeline or the plugin anatomy.
  - *Flow*: soft diagonal bands of light on black, slowly turning. For quieter backdrops
    behind code or commands.
- Windows and devices sit on top of the imagery with solid `bg` fills, so text never sits on
  dither.
- No mountains, landscapes, photos, gradients or 3D renders, and no literal mineral photos:
  the crystal is always the stepped mark.

## Motion

- Animations tell the product story without captions: real commands are typed, panel tabs
  appear, rows land in panels as the app does something, packets step between app and
  DevTools.
- **One connection at a time.** A device serves one debugger connection, and an agent
  session disconnects React Native DevTools. Never show DevTools and an agent attached to the
  same app at the same moment: they take turns. The side that is not attached dims what is
  inside its window to 40% (the window fill stays solid, so no text lands on dither), and so
  does its duct. A reduced-motion still may show both filled, as a summary.
- Pixel motion moves in steps (`steps(16)` easing, dither at about 12 fps), never smoothly.
- UI transitions: 120ms for hovers, about 300ms for screen changes.
- Text that types in is laid out at full length first and revealed, so nothing reflows. A
  morphing element sits in a slot sized for its largest state.
- Animation code loads only when its element first nears the viewport (a dynamic `import()`
  behind an IntersectionObserver), and loops run only while on screen. Under
  `prefers-reduced-motion` everything shows one meaningful still frame: the moment that tells
  the story (the panel full of rows, the agent's conclusion), not the empty first frame.
- Vanilla scripts in Astro components; no framework islands on marketing pages.

## Landing page

Three variants are being compared at `/variants`; `/` keeps the old page until one is picked.
Update this section with the chosen one. All three share, in order, each section in the frame:

1. **Nav.**
2. **Hero:** two-beat headline covering both readers (you and your agent), a one- or
   two-sentence lede, a primary button and the install command bar, then the hero animation
   on the crystals scene.
3. **Marquee** of targets and bundlers, in the order above.
4. **Sections**, each opened by a `[0N]  NAME` row. Agent content comes early, never last.
5. **Closing:** CTA bar, giant wordmark, footer row.

Agents are first-class users of Rozenite, so every hero tells both stories on the same app
and the same data: a DevTools panel for the human, and a terminal for the agent (the agent's
transcript, or a shell). The same row of data shows up in both, such as the failing request
as a Network Activity row and as the agent's `network · listRequests` result.

The three angles:

- **A · Both views**: React Native DevTools, the phone and the agent's terminal in a row
  (stacked on phones, the app between them). The panel fills with the app's requests; then
  the agent attaches and gets the same failing request back. The hero top keeps a `zsh`
  window with the setup for both: `init`, a plugin, the `rozenite` skill.
- **B · Agent-led**: copy on the left, the scene on the right. The agent's terminal leads,
  top left; it changes the app through plugin tools and stops its session. Then DevTools,
  under the terminal, attaches and its Storage panel shows what the agent changed.
- **C · Build-led**: a plugin's `react-native.ts` in one window, split into its two halves
  (the message handler, the agent tool), each above the view it feeds: a panel in DevTools
  and the agent's terminal. Its first section shows the plugin anatomy on the traffic scene.

Pages outside the landing (plugin directory, welcome page) use the same shell, nav and
footer. The welcome page is shown inside DevTools, so every link on it opens a new tab.

## Words

Short, plain, colleague-to-colleague. Speak to both readers: Rozenite gives you panels in
React Native DevTools and gives your coding agent the same runtime as tools; you can build
plugins that do both. No
marketing adjectives, no "just" or "simply". Headlines in two beats; ledes one or two
sentences. Only facts from the docs and the repo: real commands, package names, tool names
and targets. No invented numbers, adopters, logos or testimonials.

## Social card and banner

Not yet redrawn in this look. When they are:

- Open Graph card, 1200×630: the lockup top left, the chosen headline large (first beat in
  white, second in the accent), a band of crystals dither across the bottom with a DevTools
  window showing one plugin tab, and the targets in a mono row bottom right.
- README banner, 1300×400 rendered at 2×: the same pieces side by side, copy on the left,
  the crystals and the window on the right.

## Where it is implemented

- Landing tokens and base styles: `website/src/styles/landing.css`
- Docs theme, dark and light: `website/src/styles/theme.css`, `website/src/styles/docs.css`,
  `website/ec.config.mjs`
- Fonts: `website/src/fonts/` (woff2 files, no `@fontsource` dependency)
- Page shell for non-docs pages: `website/src/layouts/Site.astro`; Starlight overrides
  (lockup, dark default, header links, footer) in `website/src/components/starlight/`
- Dithered scenes: `website/src/components/site/dither.ts`
- Components: `website/src/components/site/`; hero animations in
  `website/src/components/variants/`
- Facts the pages use: `website/src/site/content.ts`
