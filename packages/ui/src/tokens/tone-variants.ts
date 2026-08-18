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
 * surface-bearing components — Button, IconButton, Badge, Alert.
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
  },
  compoundVariants: [
    {
      tone: 'neutral',
      variant: 'solid',
      class: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    },
    {
      tone: 'neutral',
      variant: 'soft',
      class: 'bg-muted text-foreground',
    },
    {
      tone: 'neutral',
      variant: 'outline',
      class: 'border border-border text-foreground hover:bg-accent hover:text-accent-foreground',
    },
    {
      tone: 'neutral',
      variant: 'ghost',
      class: 'text-foreground hover:bg-accent hover:text-accent-foreground',
    },

    {
      tone: 'primary',
      variant: 'solid',
      class: 'bg-primary text-primary-foreground hover:bg-primary/90',
    },
    {
      tone: 'primary',
      variant: 'soft',
      class: 'bg-accent text-accent-foreground',
    },
    {
      tone: 'primary',
      variant: 'outline',
      class: 'border border-primary text-primary hover:bg-accent',
    },
    {
      tone: 'primary',
      variant: 'ghost',
      class: 'text-primary hover:bg-accent',
    },

    {
      tone: 'success',
      variant: 'solid',
      class: 'bg-success text-success-foreground hover:bg-success/90',
    },
    {
      tone: 'success',
      variant: 'soft',
      class: 'bg-success-soft text-success',
    },
    {
      tone: 'success',
      variant: 'outline',
      class: 'border border-success text-success hover:bg-success-soft',
    },
    {
      tone: 'success',
      variant: 'ghost',
      class: 'text-success hover:bg-success-soft',
    },

    {
      tone: 'warning',
      variant: 'solid',
      class: 'bg-warning text-warning-foreground hover:bg-warning/90',
    },
    {
      tone: 'warning',
      variant: 'soft',
      class: 'bg-warning-soft text-warning',
    },
    {
      tone: 'warning',
      variant: 'outline',
      class: 'border border-warning text-warning hover:bg-warning-soft',
    },
    {
      tone: 'warning',
      variant: 'ghost',
      class: 'text-warning hover:bg-warning-soft',
    },

    {
      tone: 'danger',
      variant: 'solid',
      class: 'bg-danger text-danger-foreground hover:bg-danger/90',
    },
    {
      tone: 'danger',
      variant: 'soft',
      class: 'bg-danger-soft text-danger',
    },
    {
      tone: 'danger',
      variant: 'outline',
      class: 'border border-danger text-danger hover:bg-danger-soft',
    },
    {
      tone: 'danger',
      variant: 'ghost',
      class: 'text-danger hover:bg-danger-soft',
    },

    {
      tone: 'info',
      variant: 'solid',
      class: 'bg-info text-info-foreground hover:bg-info/90',
    },
    {
      tone: 'info',
      variant: 'soft',
      class: 'bg-info-soft text-info',
    },
    {
      tone: 'info',
      variant: 'outline',
      class: 'border border-info text-info hover:bg-info-soft',
    },
    { tone: 'info', variant: 'ghost', class: 'text-info hover:bg-info-soft' },
  ],
  defaultVariants: {
    tone: 'neutral',
    variant: 'solid',
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
