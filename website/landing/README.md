# Landing page

The rozenite.dev landing page. Everything it needs lives in this directory:
sections, reusable components, design tokens and copy data.

## Why it is separate

Rspress renders it today, but the coupling is deliberately thin so the page can
move to another framework without a rewrite. The only Rspress-aware file is
[`../src/index.tsx`](../src/index.tsx), which sets the page frontmatter, passes
the site footer in and renders `<LandingPage />`.

Inside this directory:

- no imports from `@rspress/*` or `@callstack/rspress-theme`
- no reads from `../src/public`. The one binary asset, the Switzer webfont,
  lives in `styles/fonts/` and is imported relatively so the bundler emits it
- all styling through CSS Modules plus the tokens in `styles/tokens.css`

## Structure

```
landing/
├── landing-page.tsx      composition of the sections, in page order
├── components/           reusable primitives (buttons, cards, code, reveal)
├── sections/             one directory per page section
├── data/                 copy that is really data (the official plugin list)
└── styles/tokens.css     design tokens, dark mode and the Switzer @font-face
```

## Design tokens

`styles/tokens.css` defines every `--rz-*` token under the `[data-rz-landing]`
scope, so the page never depends on the host's variables. Dark mode is read from
either `html.dark` (what Rspress sets) or `[data-theme='dark']`.

Colours, radii and the type pairing follow callstack.com: Alliance No. 2 for
display, Switzer for body copy, a monospace face for labels and code, one purple
accent.

Three rules are worth knowing before adding anything:

- **Radius.** There are exactly two: `--rz-radius-control` for interactive
  elements and chips, `--rz-radius-surface` for panels, cards and code blocks.
- **Colour blocks.** `Section` takes `tint="block"`, which remaps the token set
  locally so its children need no dark-specific styling. Nothing spends it
  today. Spend it at most once: a second inverted section would read as a theme
  flip mid-scroll.
- **Tints alternate.** Every section is `subtle` or `default`, strictly
  alternating down the page, and the `subtle` ones carry `bordered`. Inserting a
  section means retinting its neighbours, not breaking the run.
- **The hero owns the first screen.** It is `min-height: calc(100dvh -
  var(--rz-nav-height))`. If the host navigation changes height, retune that
  token rather than the section. Everything down to the install command has to
  fit above the fold, on a laptop and on a phone. Check both after changing
  anything in it.

## Conventions the page holds to

These came out of a design review and are easy to break by accident:

- **Eyebrows are rationed.** Only the product surfaces carry one: official
  plugins, Rozenite for Agents, Rozenite for Lynx, Rozenite for Web. Not every
  section needs a label above its headline -- the standalone app is a way of
  working rather than a surface, so it has none. `eyebrow` takes a `ReactNode`
  so a surface can pair its label with a brand mark or a status chip on that
  one line. That is its whole remit; it is not a second headline.
- **Section headers stack.** Eyebrow, headline, body, in one column. Rozenite
  for Agents is the one exception: it pairs its header with the terminal sample
  on the same line, and takes `className` to drop its stacking margin.
- **No layout family repeats.** Rozenite for Web is the only text-and-visual
  split. Everything else uses a different composition: the hero is a centred
  stack, Lynx is the page's only ordered rail, and the standalone app is the
  only centred header over a full-width figure. The hero and the standalone app
  both centre, but they are the two ends of the page and hold nothing else in
  common -- one is type over a mark, the other is a caption over a screenshot.
- **Icons come from a library.** `@phosphor-icons/react` for UI glyphs,
  `simple-icons` for brand marks via `components/brand-mark`. Nothing is drawn
  by hand. Brand marks render in `currentColor`, never in the brand hex, so a
  logo cannot smuggle a second accent onto the page.

  The Lynx mark is the one exception: `simple-icons` has no Lynx entry, so its
  paths are vendored into `components/brand-mark`, which carries the provenance
  and the licensing reasoning. Vendor another mark only on the same terms.
- **Grids have no empty cells.** The plugin grid shows `FEATURED_PLUGINS`, six
  of the fourteen, which divides evenly at three, two and one column. The rest
  are counted in a line of copy underneath rather than drawn. Keep the featured
  count divisible by six.

## Motion

Three effects, and adding a fourth needs an argument.

`components/reveal` is a fade and lift as a block enters the viewport, so a
section's header lands before its content. It is built on CSS scroll-driven
animation and is pure progressive enhancement: the default state is the final
state, and the animation only attaches inside
`@supports (animation-timeline: view())` and
`prefers-reduced-motion: no-preference`.

`components/connection-diagram` runs two dots along the link between its
endpoints. It is there because the subject is traffic and a still line cannot
show a direction. Same progressive-enhancement shape: without
`prefers-reduced-motion: no-preference` the dots simply sit on the line.

The hero's animated mark is the third. It is a canvas rather than CSS, so its
rules live in `sections/hero/hero.tsx`; like the other two it degrades to a
single static frame under `prefers-reduced-motion`.

Everything else is hover, focus and `:active` feedback.

## Standing in for product shots

Two components, for two different situations.

`components/screenshot` renders a labelled empty slot, not a mock of the
product. It reserves the right amount of space and says what the capture has to
show. To ship a real one, replace the element with an `<img>` at the same aspect
ratio.

`components/connection-diagram` is for the places where no screenshot is coming.
It draws two endpoints and the link between them, which explains an architecture
better than a picture of a panel would. Rozenite for Web uses it.

Nothing uses `components/screenshot` right now -- the standalone app's capture
landed, which is what the slot is for. Keep it around for the next section that
is drafted before its screenshot exists.

## Framing a real capture

The page has one product capture, and how it is framed follows from what the
image already contains rather than from a house style.

`standalone-rozenite.png` is a raw window grab: it has macOS traffic lights but
no border or shadow, and a dark app screen sitting flush on the page reads as a
hole rather than a window. So the section frames it, and that frame is the
page's only elevated surface. See `sections/standalone/standalone.module.css`.

Never draw chrome the capture already has. If a future capture arrives without
traffic lights, that is a reason to recapture it, not to fake a title bar.

`website/landing-rozenite.png` is the hero's old DevTools screenshot. Nothing
imports it since the hero became the animated mark, so it is emitted by no
build; it is kept only in case the hero ever wants a product shot back.
