import type { Meta, StoryObj } from '@storybook/react-vite';
import { surfaceTone, textTone, sizeHeight, sizeIcon, type Tone, type Size } from '@rozenite/ui';

const TONES: Tone[] = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'];
const VARIANTS = ['solid', 'soft', 'outline', 'ghost'] as const;

function ToneMatrix() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {TONES.flatMap((tone) =>
        VARIANTS.map((variant) => (
          <div
            key={`${tone}-${variant}`}
            className={surfaceTone({
              tone,
              variant,
              class:
                'flex h-10 items-center justify-center rounded-md font-mono text-[10px] tracking-[0.08em] uppercase',
            })}
          >
            {tone}/{variant}
          </div>
        )),
      )}
    </div>
  );
}

function TextToneRow() {
  return (
    <div className="flex flex-wrap gap-4 font-mono text-[11px] tracking-[0.08em] uppercase">
      {TONES.map((tone) => (
        <span key={tone} className={textTone({ tone })}>
          {tone}
        </span>
      ))}
    </div>
  );
}

const SWATCHES = [
  ['background', 'bg-background'],
  ['surface', 'bg-surface'],
  ['popover', 'bg-popover'],
  ['muted', 'bg-muted'],
  ['secondary', 'bg-secondary'],
  ['border', 'bg-border'],
  ['border-strong', 'bg-border-strong'],
  ['faint', 'bg-faint'],
  ['muted-foreground', 'bg-muted-foreground'],
  ['foreground', 'bg-foreground'],
  ['primary', 'bg-primary'],
  ['primary-hover', 'bg-primary-hover'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
  ['danger', 'bg-danger'],
  ['info', 'bg-info'],
] as const;

function SwatchGrid() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {SWATCHES.map(([name, className]) => (
        <div key={name} className="flex items-center gap-2">
          <span className={`${className} border-input size-6 shrink-0 border`} />
          <span className="text-muted-foreground font-mono text-[11px]">{name}</span>
        </div>
      ))}
    </div>
  );
}

function ThemePanel({ dark }: { dark: boolean }) {
  return (
    <div className={dark ? 'dark' : ''}>
      <div className="bg-background text-foreground flex flex-col gap-4 p-4">
        <p className="text-faint font-mono text-[11px] tracking-[0.08em] uppercase">
          {dark ? 'Dark' : 'Light'}
        </p>
        <SwatchGrid />
        <ToneMatrix />
        <TextToneRow />
      </div>
    </div>
  );
}

/** No component owns this story — it documents the shared token layer that
 *  every other component builds on top of. */
const meta = {
  title: 'Foundations/Tokens',
  parameters: {
    layout: 'fullscreen',
    withPluginShell: false,
    docs: {
      description: {
        component:
          'The tone × variant × size matrix every component builds on. Tone is `neutral | primary | success | warning | danger | info`; variant is `solid | soft | outline | ghost`; size is `sm | md | lg`.',
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The palette tokens, the full tone × variant matrix from `surfaceTone`,
 * rendered in both themes, plus the foreground-only palette from `textTone`.
 * @summary Compare every tone and variant combination in both themes.
 */
export const ToneVariantMatrix: Story = {
  render: () => (
    <div className="grid grid-cols-2 divide-x divide-border">
      <ThemePanel dark={false} />
      <ThemePanel dark />
    </div>
  ),
};

const SIZES: Size[] = ['sm', 'md', 'lg'];

/**
 * The `sm | md | lg` control-height scale from `sizeHeight`, each paired
 * with its `sizeIcon` step.
 * @summary Compare every control size step.
 */
export const SizeScale: Story = {
  render: () => (
    <div className="flex items-end gap-4 p-4">
      {SIZES.map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <div
            className={`bg-secondary flex items-center gap-1 border border-border px-2 text-xs ${sizeHeight[size]}`}
          >
            <span className={`bg-foreground ${sizeIcon[size]}`} />
            {size}
          </div>
          <span className="text-muted-foreground text-xs">{sizeHeight[size]}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * `--radius` is `0` on purpose — this design system is square by design, not
 * an unfinished default. The `--radius-{sm,md,lg,xl}` scale stays wired
 * through `@theme inline` so `rounded-*` classes remain a live re-theming
 * seam: raising `--radius` above `0` would round every component at once
 * without touching component code.
 * @summary Document why every corner is square by default.
 */
export const SquareByDesign: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-4">
      <div className="flex flex-col items-center gap-2">
        <div className="bg-primary size-16 rounded-sm" />
        <span className="text-muted-foreground text-xs">rounded-sm</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="bg-primary size-16 rounded-md" />
        <span className="text-muted-foreground text-xs">rounded-md</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="bg-primary size-16 rounded-lg" />
        <span className="text-muted-foreground text-xs">rounded-lg</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="bg-primary size-16 rounded-xl" />
        <span className="text-muted-foreground text-xs">rounded-xl</span>
      </div>
    </div>
  ),
};
