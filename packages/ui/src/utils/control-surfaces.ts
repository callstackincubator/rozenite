import { cva } from 'class-variance-authority';
import { cn } from './cn';
import type { Size } from '../tokens/size';

const fieldSurfaceBase = /* @__PURE__ */ cn(
  'w-full rounded-md border border-input bg-muted text-foreground transition-colors duration-[120ms]',
  'outline-none hover:border-faint focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring',
  'placeholder:text-faint disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
);

/**
 * The shared chrome for form control shells — input, search field, field
 * control, select trigger, combobox input. `size` covers height and
 * horizontal padding; textarea sizes itself separately since it has no
 * fixed height (see `textareaSurface`).
 */
export const fieldSurface = /* @__PURE__ */ cva(fieldSurfaceBase, {
  variants: {
    size: {
      sm: 'h-6 px-2 text-xs',
      md: 'h-8 px-3 text-sm',
      lg: 'h-10 px-4 text-base',
    } as const satisfies Record<Size, string>,
  },
  defaultVariants: {
    size: 'md',
  },
});

/** The same chrome as `fieldSurface`, sized for `Textarea` — padding and
 *  minimum height scale, but not a fixed height. */
export const textareaSurface = /* @__PURE__ */ cva(fieldSurfaceBase, {
  variants: {
    size: {
      sm: 'min-h-20 px-2 py-1.5 text-xs',
      md: 'min-h-28 px-3 py-2 text-sm',
      lg: 'min-h-36 px-4 py-2.5 text-base',
    } as const satisfies Record<Size, string>,
  },
  defaultVariants: {
    size: 'md',
  },
});

/** The shared popup surface for select and combobox dropdowns. */
export const popoverSurface = /* @__PURE__ */ cva(
  cn(
    'max-h-64 min-w-(--anchor-width) overflow-y-auto rounded-md border border-input bg-popover p-1 text-popover-foreground',
    'origin-(--transform-origin) transition-[transform,scale,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
  ),
);

/** The shared option row for select and combobox items. */
export const optionRow = /* @__PURE__ */ cva(
  cn(
    'flex cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground select-none',
    'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  ),
);
