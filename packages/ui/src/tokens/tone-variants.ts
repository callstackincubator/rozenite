import { cva } from 'class-variance-authority';
import type { Tone } from './tone';

const toneKeys = {
  neutral: '',
  primary: '',
  success: '',
  warning: '',
  danger: '',
  info: '',
} as const satisfies Record<Tone, string>;

/**
 * Crosses `tone` with `variant` (solid | soft | outline | ghost) for
 * surface-bearing components — Button, IconButton, Badge, Alert. Pass
 * `interactive: true` (Button, IconButton) to add hover states; leave it
 * off for static surfaces (Badge, Alert) so they don't look clickable.
 */
export const surfaceTone = cva('', {
  variants: {
    tone: toneKeys,
    variant: {
      solid: '',
      soft: '',
      outline: '',
      ghost: '',
    },
    interactive: {
      true: '',
      false: '',
    },
  },
  compoundVariants: [
    { tone: 'neutral', variant: 'solid', class: 'bg-secondary text-secondary-foreground' },
    { tone: 'neutral', variant: 'soft', class: 'bg-muted text-foreground' },
    { tone: 'neutral', variant: 'outline', class: 'border border-border text-foreground' },
    { tone: 'neutral', variant: 'ghost', class: 'text-foreground' },

    { tone: 'primary', variant: 'solid', class: 'bg-primary text-primary-foreground' },
    { tone: 'primary', variant: 'soft', class: 'bg-accent text-accent-foreground' },
    { tone: 'primary', variant: 'outline', class: 'border border-primary text-primary' },
    { tone: 'primary', variant: 'ghost', class: 'text-primary' },

    { tone: 'success', variant: 'solid', class: 'bg-success text-success-foreground' },
    { tone: 'success', variant: 'soft', class: 'bg-success-soft text-success' },
    { tone: 'success', variant: 'outline', class: 'border border-success text-success' },
    { tone: 'success', variant: 'ghost', class: 'text-success' },

    { tone: 'warning', variant: 'solid', class: 'bg-warning text-warning-foreground' },
    { tone: 'warning', variant: 'soft', class: 'bg-warning-soft text-warning' },
    { tone: 'warning', variant: 'outline', class: 'border border-warning text-warning' },
    { tone: 'warning', variant: 'ghost', class: 'text-warning' },

    { tone: 'danger', variant: 'solid', class: 'bg-danger text-danger-foreground' },
    { tone: 'danger', variant: 'soft', class: 'bg-danger-soft text-danger' },
    { tone: 'danger', variant: 'outline', class: 'border border-danger text-danger' },
    { tone: 'danger', variant: 'ghost', class: 'text-danger' },

    { tone: 'info', variant: 'solid', class: 'bg-info text-info-foreground' },
    { tone: 'info', variant: 'soft', class: 'bg-info-soft text-info' },
    { tone: 'info', variant: 'outline', class: 'border border-info text-info' },
    { tone: 'info', variant: 'ghost', class: 'text-info' },

    // Hover states, opt-in via `interactive: true` — safe to give every
    // variant (including `soft`) an interactive hover now that it's gated:
    // static consumers like Alert never pass `interactive`, so they never
    // see it.
    {
      tone: 'neutral',
      variant: 'solid',
      interactive: true,
      class: 'hover:bg-secondary/80',
    },
    {
      tone: 'neutral',
      variant: 'soft',
      interactive: true,
      class: 'hover:bg-muted/80',
    },
    {
      tone: 'neutral',
      variant: 'outline',
      interactive: true,
      class: 'hover:bg-accent hover:text-accent-foreground',
    },
    {
      tone: 'neutral',
      variant: 'ghost',
      interactive: true,
      class: 'hover:bg-accent hover:text-accent-foreground',
    },

    { tone: 'primary', variant: 'solid', interactive: true, class: 'hover:bg-primary/90' },
    { tone: 'primary', variant: 'soft', interactive: true, class: 'hover:bg-accent/80' },
    { tone: 'primary', variant: 'outline', interactive: true, class: 'hover:bg-accent' },
    { tone: 'primary', variant: 'ghost', interactive: true, class: 'hover:bg-accent' },

    { tone: 'success', variant: 'solid', interactive: true, class: 'hover:bg-success/90' },
    {
      tone: 'success',
      variant: 'soft',
      interactive: true,
      class: 'hover:bg-success-soft/70',
    },
    {
      tone: 'success',
      variant: 'outline',
      interactive: true,
      class: 'hover:bg-success-soft',
    },
    { tone: 'success', variant: 'ghost', interactive: true, class: 'hover:bg-success-soft' },

    { tone: 'warning', variant: 'solid', interactive: true, class: 'hover:bg-warning/90' },
    {
      tone: 'warning',
      variant: 'soft',
      interactive: true,
      class: 'hover:bg-warning-soft/70',
    },
    {
      tone: 'warning',
      variant: 'outline',
      interactive: true,
      class: 'hover:bg-warning-soft',
    },
    { tone: 'warning', variant: 'ghost', interactive: true, class: 'hover:bg-warning-soft' },

    { tone: 'danger', variant: 'solid', interactive: true, class: 'hover:bg-danger/90' },
    {
      tone: 'danger',
      variant: 'soft',
      interactive: true,
      class: 'hover:bg-danger-soft/70',
    },
    { tone: 'danger', variant: 'outline', interactive: true, class: 'hover:bg-danger-soft' },
    { tone: 'danger', variant: 'ghost', interactive: true, class: 'hover:bg-danger-soft' },

    { tone: 'info', variant: 'solid', interactive: true, class: 'hover:bg-info/90' },
    { tone: 'info', variant: 'soft', interactive: true, class: 'hover:bg-info-soft/70' },
    { tone: 'info', variant: 'outline', interactive: true, class: 'hover:bg-info-soft' },
    { tone: 'info', variant: 'ghost', interactive: true, class: 'hover:bg-info-soft' },
  ],
  defaultVariants: {
    tone: 'neutral',
    variant: 'solid',
    interactive: false,
  },
});

/**
 * Foreground-only tone color, for text-bearing components that don't render
 * a surface — Text, Icon, IndicatorDot.
 */
export const textTone = cva('', {
  variants: {
    tone: {
      neutral: 'text-foreground',
      primary: 'text-primary',
      success: 'text-success',
      warning: 'text-warning',
      danger: 'text-danger',
      info: 'text-info',
    } as const satisfies Record<Tone, string>,
  },
  defaultVariants: {
    tone: 'neutral',
  },
});
