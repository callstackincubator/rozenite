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
  locally so its children need no dark-specific styling. The page spends that
  once, on Rozenite for Agents. A second inverted section would read as a theme
  flip mid-scroll.
- **The hero owns the first screen.** It is `min-height: calc(100dvh -
  var(--rz-nav-height))`. If the host navigation changes height, retune that
  token rather than the section.

## Conventions the page holds to

These came out of a design review and are easy to break by accident:

- **Eyebrows are rationed.** Only the three product surfaces carry one: official
  plugins, Rozenite for Agents, Rozenite for Web. Not every section needs a
  label above its headline.
- **Section headers stack.** Eyebrow, headline, body, in one column. Rozenite
  for Agents is the one exception: it pairs its header with the terminal sample
  on the same line, and takes `className` to drop its stacking margin.
- **No layout family repeats.** Hero and Rozenite for Web are the only
  text-and-visual splits, and they are not adjacent. Everything else uses a
  different composition.
- **Icons come from a library.** `@phosphor-icons/react` for UI glyphs,
  `simple-icons` for brand marks via `components/brand-mark`. Nothing is drawn
  by hand. Brand marks render in `currentColor`, never in the brand hex, so a
  logo cannot smuggle a second accent onto the page.
- **Grids have no empty cells.** The plugin grid shows `FEATURED_PLUGINS`, six
  of the fourteen, which divides evenly at three, two and one column. The rest
  are counted in a line of copy underneath rather than drawn. Keep the featured
  count divisible by six.

## Motion

Two effects, and adding a third needs an argument.

`components/reveal` is a fade and lift as a block enters the viewport, so a
section's header lands before its content. It is built on CSS scroll-driven
animation and is pure progressive enhancement: the default state is the final
state, and the animation only attaches inside
`@supports (animation-timeline: view())` and
`prefers-reduced-motion: no-preference`.

`components/connection-diagram` runs two dots along the link between its
endpoints. This is the one looping animation on the page, and it is there
because the subject is traffic and a still line cannot show a direction. Same
progressive-enhancement shape: without `prefers-reduced-motion: no-preference`
the dots simply sit on the line.

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
