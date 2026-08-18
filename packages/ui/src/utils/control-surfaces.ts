import { cva } from 'class-variance-authority';
import { cn } from './cn';

/**
 * The shared chrome for form control shells — input, textarea, search
 * field, field control, select trigger, combobox input. Callers layer their
 * own height/padding on top, e.g. `cn(fieldSurface(), 'h-8 px-3')`.
 */
export const fieldSurface = cva(
  cn(
    'w-full rounded-md border border-input bg-transparent text-sm text-foreground shadow-xs transition-colors',
    'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
    'placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  ),
);

/** The shared popup surface for select and combobox dropdowns. */
export const popoverSurface = cva(
  cn(
    'max-h-64 min-w-[--anchor-width] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
    'origin-(--transform-origin) transition-[transform,scale,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
  ),
);

/** The shared option row for select and combobox items. */
export const optionRow = cva(
  cn(
    'flex cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground select-none',
    'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  ),
);
