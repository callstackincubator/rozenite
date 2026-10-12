# Rozenite design

Near-black, one bright accent, white type. Light grotesk headlines, uppercase mono for
everything that labels. Square corners, 1px hairlines, no shadows, no gradients. Imagery is
dithered pixel art in the accent, never photos or illustrations. It is the Callstack product
look shared with Apex (lime), Simlock (orange), Appduct (cyan) and agent-device (violet);
Rozenite's accent is crimson-rose, the colour of the mineral's red crystals in dark rock.

**Scope.** This file governs the website (landing page, docs theme, plugin directory, welcome
page), social cards, slides, diagrams, videos and any other brand visual, and the DevTools
panel UI: `@rozenite/ui`, the Rozenite shell, the standalone app and every plugin panel. The
panel UI is the same look tuned for a dense tool; where it departs from the marketing rules
(status colours, a light theme, smaller type) it says so in [DevTools panel UI](#devtools-panel-ui).
How to work on the components themselves is in
[agents/working-on-ui-components.md](../agents/working-on-ui-components.md).

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
  `ERR` label, not crimson. The panel UI has its own status colours, kept clear of the
  accent's hue (see [DevTools panel UI](#devtools-panel-ui)).
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
- **DevTools window.** The picture of React Native DevTools with Rozenite in it, laid out the
  way it looks today (see `website/public/standalone-rozenite.png`) but drawn in our language:
  a Window titled `React Native DevTools`, then the DevTools tab row with the built-in tabs
  (Console, Sources, Network, Memory) as mono labels in `faint` and one `ROZENITE` tab, led by
  the mark, selected (white, 2px accent underline). Inside it, a narrow sidebar: the mark and
  "Rozenite" at the top over a hairline, then the installed plugins as a list in Switzer
  `muted`, the selected plugin on `surface` with a 2px accent bar on its left. The list starts
  two items above the selected one and is clipped by the window, so it reads as longer and
  never ends on an empty slot. The selected plugin's panel fills the rest: a mono table, a
  header row of `faint` uppercase labels, rows divided by `line`, values in white, a value
  that just changed flashed in the accent. HTTP status codes and errors stay white: status
  never takes the accent. The row the story is about is picked out like the selected plugin.
  On phones only Console stays of the built-in tabs, the sidebar narrows, and the table drops
  its least important column. Never draw Chrome's real UI or icons; this is a diagram of it, drawn
  with the same tokens the panel UI uses.
- **Code.** Zero-padded line numbers (`01`, `02`) in `faint`, keywords and punctuation in
  dimmed white, functions and types in white, strings and numbers in the accent, comments in
  `faint`. Shell: the command in white, plain arguments as text (never as strings), options
  dimmed like keywords, only quoted strings in the accent. JSON: keys white, values in the
  accent. Empty numbered lines pad short snippets to a common height. A command in running
  text (a cell, a caption) is `$` in the accent and the command in white mono. In the docs, code blocks are framed
  by a hairline only: no accent rule, no line numbers. No ASCII diagrams; they overflow.
- **Command bar.** `$` in the accent, the command in mono, a `COPY` label button on the right,
  `line-strong` border. The install command is `npx rozenite@latest init`; the agent skill is
  `npx skills add callstackincubator/rozenite --skill rozenite` (the short owner/repo form).
- **Agent transcript.** In an `agent` window: the user's request in white after `>`, each
  Rozenite call on its own line as `● domain · tool {args}` with the dot in the accent and the
  arguments coloured like JSON (keys `muted`, values in the accent, punctuation `faint`),
  results indented in `muted`, the agent's conclusion after `✓` in the accent. Domain and tool
  names are real and come from the built-in domains (`console · getMessages`,
  `network · listRequests`).
- **Tabs.** Equal-width cells across the frame, mono labels in `faint`; the selected tab is
  white with a 2px accent underline.
- **Marquee.** A hairline row of mono labels scrolling left (about 38s per loop), each led by
  a 6px accent square, ends faded with a mask. Pauses on hover; static under reduced motion.
- **Pixel icons.** Drawn on a 9×9 grid, one square per pixel, `currentColor`, rendered at
  multiples of 9px with crisp edges. Each official plugin has one; the mark is drawn on its
  own 7×10 grid, never squeezed into 9×9.
- **Plugin cell.** Pixel icon in the accent, plugin name as a card title, the package name in
  accent mono, one line on what the panel shows.
- **Plugin tree.** A plugin's `react-native.ts` in one window, split into two halves side by
  side: the app side answering its panel through the bridge, and the agent tool registered
  with `useRozenitePluginAgentTool`. Under each half a dotted duct, then the view it feeds: a
  DevTools window with the plugin selected in the Rozenite sidebar, and the agent's terminal
  calling the tool. A still composition; on first view one stepped pass lights each half and
  its duct in turn. On phones it stacks: the file, its panel, the terminal. Code in it is the
  docs' API, simplified but never invented.
- **Device frames.** Phones are dark (`#050505`) rectangles with pixel-stepped corners (4px
  steps, never rounded) and a 1px `#313131` outline that follows every step without a break,
  a black notch block (iPhone) or punch hole and three-square nav bar (Android). Apps inside
  are minimal: a header with the screen title flush left and a count in a small square on the
  right (accent when non-zero), Switzer UI text, mono prices and labels, product imagery as
  dot or line patterns.
- **Closing.** CTA bar, then the giant accent wordmark, then a single footer row:
  `© YEAR ROZENITE BY CALLSTACK` left, mono links right (Docs, Plugin directory, llms.txt,
  GitHub, Discord, MIT license, Callstack).

## DevTools panel UI

The panels people work in all day: `@rozenite/ui`, the shell's plugin sidebar, the standalone
app and every plugin panel. Same palette, fonts and hairlines as the website, tuned for a dense
tool. The reference composition is the Storybook story `Preview / Design refresh`
(`apps/ui-storybook/src/stories/DesignPreview.stories.tsx`): a Network Activity panel in the
shell, dark, light and empty.

**Tokens.** `packages/ui/styles.css` is the single source; components use its Tailwind names,
never raw colours. The website tokens map onto them like this:

| Panel token | Dark | Light | Website token / use |
| --- | --- | --- | --- |
| `background`, `card`, `sidebar` | `#0a0a0a` | `#ffffff` | `bg` |
| `surface`, `sidebar-accent` | `#111111` | `#f9f9f8` / `#f4f4f3` | `surface`: selected rows and items |
| `popover` | `#111111` | `#ffffff` | Menus, select and combobox popups, dialogs, toasts |
| `muted` | `#161616` | `#f6f6f5` | `field`: inputs, chips, inline code |
| `secondary` | `#1a1a1a` | `#efefee` | The dark button |
| `accent` | white 5% | black 4% | Hover wash only (not the brand accent) |
| `border` | `#1f1f1f` | `#e6e6e6` | `line` |
| `border-strong`, `input` | `#313131` | `#d1d1d1` | `line-strong`: inputs, outlined buttons, popups |
| `foreground` | `#ffffff` | `#0a0a0a` | `text` |
| `muted-foreground` | `#a3a3a3` | `#5e5e5e` | `muted`: body copy, idle items |
| `faint` | `#858585` | `#6b6b6b` | `faint`: labels, metadata, placeholders |
| `primary`, `ring` | `#ff4f7b` | `#c2143f` | `accent` (light uses the docs' deeper crimson) |
| `primary-hover` | `#ff9fb2` | `#a3102f` | `accent-hover` |
| `primary-foreground` | `#0a0a0a` | `#ffffff` | `on-accent` |

The greys are the website's alpha whites flattened onto `bg`, so they stay predictable when
they stack. Every text pair meets 4.5:1 in both themes, chips included.

**Status colours.** Panels need them; the website does not. `success` (`#4ade80` / `#136f35`),
`warning` (`#fbbf24` / `#8f5a06`), `danger` (`#ff7a50` / `#b13b0b`) and `info` (`#60a5fa` /
`#1d4ed8`). Danger is an orange-red so an error never reads as the brand. Status is text on a
chip (`soft`: a 14% / 10% tint), a square indicator or a mono label such as `ERR`; it never
fills large areas, and the accent never means status.

**Type.** Switzer for UI text and names, Geist Mono for data and labels, both bundled in
`packages/ui/fonts/` (the website's own files, 57 kB). Sizes are smaller than the website's:

| Role | Style |
| --- | --- |
| Panel title (`PluginHeader.Title`) | Switzer 500, 15px, -0.01em |
| Headings, `Text` `title`/`heading` | Switzer 500, never bold |
| Body, list items, field values | Switzer 400, 13–14px, `muted-foreground` when idle |
| Label (`Text variant="label"`, buttons, tabs, badges, table headers, group labels) | Geist Mono, uppercase, 0.08em, 10–12px, usually `faint` |
| Data (`Text` `code`/`numeric`, table values, keys) | Geist Mono 12px, tabular numbers |

Labels are mono; sentences, descriptions and empty-state copy never are. Plugin names stay
in Switzer.

**Shape.** Square everywhere (`--radius: 0`, the `rounded-*` scale stays wired as a seam). No
shadows, blur or gradients: popups, dialogs and toasts are separated by a `border-strong`
hairline on `popover`. Indicators are squares, never dots. The switch is a square track with a
square thumb.

**Components.**

- **Buttons:** mono uppercase labels, `h-6`/`h-8`/`h-10`. Primary is the accent fill with
  `primary-foreground` text; neutral solid is the dark button; outline has a `border-strong`
  border; ghost is `muted-foreground` until hovered.
- **Badges:** the website's chip. `soft` (the usual one) is a `muted` fill with the tone as
  text; `solid` primary is the accent block, like the `ROZENITE` window tag.
- **Tabs:** hairline-divided mono cells in `faint`; the selected one is white on the hover
  wash with a 2px accent underline.
- **Sidebar:** full-width rows, items in Switzer `muted-foreground`, the selected one on
  `surface` with a 2px accent bar on its left; mono group labels.
- **Tables:** header row of `faint` mono uppercase labels, rows divided by `border`, hover on
  the wash, selected row on `surface` with the accent bar.
- **Fields:** `muted` fill, `input` border that brightens to `faint` on hover and to the accent
  on focus; placeholders in `faint`.
- **Focus:** a 2px `ring` in the accent, square.
- **Motion:** 120ms colour transitions, as in [Motion](#motion).

**Plugins.** A plugin panel styles itself through `@rozenite/ui` components and tokens. It
does not ship its own palette, font or radius; colour for data (charts, categories, syntax)
comes from the status colours and neutral greys before anything new is added, and never from
violet, Rozenite's retired colour.

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
  - *Hollow*: the crystals scene with its tallest crystal missing, larger than the rest. Its
    socket is dark, a dashed stepped outline marks where it should be, and the glint flares
    along the outline as it passes. Only for the 404 page.
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
- Pixel motion moves in steps (`steps(16)` easing, dither at about 12 fps), never smoothly.
- UI transitions: 120ms for hovers, about 300ms for screen changes.
- Text that types in is laid out at full length first and revealed, so nothing reflows. A
  morphing element sits in a slot sized for its largest state.
- Animation code loads only when its element first nears the viewport (a dynamic `import()`
  behind an IntersectionObserver), and loops run only while on screen. Under
  `prefers-reduced-motion` everything shows one meaningful still frame: the moment that tells
  the story (the panel full of rows, the agent's conclusion), not the empty first frame.
- An animation ships that still frame in the server HTML, text included, so crawlers and
  readers without JavaScript see the whole story; the script resets it when it starts to play.
- Dither scenes start after the page's `load` event and run in a Web Worker on an
  OffscreenCanvas (main-thread fallback where that is missing), so building a scene never
  blocks the page. Canvases fill boxes that are already sized, so nothing shifts when they start.
- Vanilla scripts in Astro components; no framework islands on marketing pages.

## Home page

In order, each section in the frame:

1. **Nav.**
2. **Hero:** "See inside your running app. *So can your agent.*", a lede naming both readers,
   a `GET STARTED` button and the install command bar. Beside them on wide screens, a `zsh`
   window with the setup for both: `init`, a plugin, the `rozenite` skill (hidden below
   64rem). Then the hero animation on the crystals scene: React Native DevTools, the phone and
   the agent's terminal in a row, both attached to the app at the same time (stacked on
   phones, the app between them). The app's requests land in the Network Activity panel of
   the Rozenite tab, ending on a failing `GET /api/cart`; the agent runs
   `network · listRequests` and gets the same request back, picked out in the panel as it
   arrives, then reads the error from `console · getMessages`.
3. **Marquee** of targets and bundlers, in the order above.
4. **[01] How it works:** three steps (init, a plugin, the skill), then bundler and target
   tabs (Metro, Re.Pack, Web, Lynx) with their config over a flow backdrop.
5. **[02] Agents:** the agent CLI in a window, then the built-in domains (console, network,
   react, performance, memory) and a cell for the tools your app and your plugins register.
   Do not list which official plugins expose agent tools; it tells a user nothing they act on.
6. **[03] Official plugins:** fourteen link cells plus the directory and building your own.
7. **[04] Build your own:** "And the one you write, *for you and your agent.*", a lede naming
   the bridge (`@rozenite/plugin-bridge`: `DevToolsPluginClient`, `useRozeniteDevToolsClient`)
   and `useRozenitePluginAgentTool`, then a plugin tree on a flow backdrop, then
   `npx rozenite generate` and links to the plugin development and agent-enabled plugin guides.
8. **[05] Safe by default**, **[06] Beyond React Native** (Lynx, Web, standalone app, each
   `EXPERIMENTAL`), **[07] FAQ.**
9. **Closing:** CTA bar, giant wordmark, footer row.

Every hero tells both stories on the same app and the same data: a DevTools panel for the
human and a terminal for the agent, both live at once.

Pages outside the home page (plugin directory, welcome page, 404) use the same shell, nav and
footer. The welcome page is shown inside DevTools, so every link on it opens a new tab.

## 404 page

The hollow crystals scene fills the first screen behind a solid card: a `404` accent chip and
`PAGE NOT FOUND` label, a two-beat line ("This address is empty. *The rest of Rozenite
isn't.*"), the requested path read client-side and set as text only, a `HOME` button, a dark
`DOCS` button and mono links to the plugin directory and GitHub. Then the giant wordmark and
the footer. Starlight's own 404 is disabled; the page is `website/src/pages/404.astro`.

## Words

Short, plain, colleague-to-colleague. Speak to both readers: Rozenite gives you panels in
React Native DevTools and gives your coding agent the same runtime as tools; you can build
plugins that do both. No marketing adjectives, no "just" or "simply". Headlines in two beats; ledes one or two
sentences. Only facts from the docs and the repo: real commands, package names, tool names
and targets. No invented numbers, adopters, logos or testimonials.

## Social card and banner

Both are generated from one page, `website/og/og.html`, with `pnpm --filter @rozenite/docs og`
(`website/scripts/og.mjs` renders it in Chromium and also writes the PNG icons).

- Social card, `website/public/og-image.jpg`, 1200×630: the lockup top left, the home page
  headline large ("See inside your running app." in white, "So can your agent." in the
  accent), then a band of crystals dither across the bottom with a DevTools window (the
  Rozenite tab, Network Activity selected, the failing request picked out) beside the agent's
  terminal showing the same request, and the targets in a mono row bottom right.
- README banner, `website/public/rozenite-banner.jpg`, 1660×512: the same pieces side by
  side, copy on the left, the two windows stacked on the crystals on the right, no frame
  hairlines. The READMEs load it from `https://www.rozenite.dev/rozenite-banner.jpg`, so they
  pick up a new banner when the site deploys.

## Where it is implemented

- Panel UI tokens, fonts and base styles: `packages/ui/styles.css`, `packages/ui/fonts/`;
  components in `packages/ui/src/`; the reference panel in
  `apps/ui-storybook/src/stories/DesignPreview.stories.tsx`

- Landing tokens and base styles: `website/src/styles/landing.css`
- Docs theme, dark and light: `website/src/styles/theme.css`, `website/src/styles/docs.css`,
  `website/ec.config.mjs`
- Fonts: `website/src/fonts/` (woff2 files, no `@fontsource` dependency)
- Page shell for non-docs pages: `website/src/layouts/Site.astro`; Starlight overrides
  (lockup, dark default, header links, footer) in `website/src/components/starlight/`
- Dithered scenes: `website/src/components/site/dither.ts`, run by `dither-host.ts` in
  `dither.worker.ts`
- Components: `website/src/components/site/`; the home hero in `website/src/components/home/`
- Pages: `website/src/pages/index.astro` (home), `404.astro`, `welcome.astro`,
  `plugin-directory/`
- Facts the pages use: `website/src/site/content.ts`
