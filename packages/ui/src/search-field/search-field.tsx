import type { ComponentProps } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { fieldSurface } from '../utils/control-surfaces';
import type { Size } from '../tokens/size';

const searchFieldSize = {
  sm: {
    icon: 'left-1.5 size-3',
    input: 'pl-6',
    inputPad: { withClear: 'pr-6', bare: 'pr-2' },
    clear: 'right-1 size-3.5',
    clearIcon: 'size-3',
  },
  md: {
    icon: 'left-2.5 size-3.5',
    input: 'pl-8',
    inputPad: { withClear: 'pr-8', bare: 'pr-3' },
    clear: 'right-2 size-4',
    clearIcon: 'size-3.5',
  },
  lg: {
    icon: 'left-3 size-4',
    input: 'pl-10',
    inputPad: { withClear: 'pr-10', bare: 'pr-4' },
    clear: 'right-2.5 size-5',
    clearIcon: 'size-4',
  },
} as const satisfies Record<Size, unknown>;

export type SearchFieldProps = Omit<ComponentProps<'input'>, 'type' | 'size'> & {
  /** Called when the clear button is pressed. Omit to hide the clear affordance. */
  onClear?: () => void;
  /** Accessible name for the clear button.
   * @default 'Clear search' */
  clearLabel?: string;
  /** @default 'md' */
  size?: Size;
};

/** A search input with a leading search icon and clear affordance. */
export function SearchField({
  className,
  value,
  onClear,
  clearLabel = 'Clear search',
  size = 'md',
  ...props
}: SearchFieldProps) {
  const showClear = Boolean(onClear) && Boolean(value);
  const sizing = searchFieldSize[size];

  return (
    <div data-slot="search-field" className="relative flex items-center">
      <Search className={cn('pointer-events-none absolute text-muted-foreground', sizing.icon)} />
      <input
        type="search"
        value={value}
        className={cn(
          fieldSurface({ size }),
          'min-w-0',
          sizing.input,
          showClear ? sizing.inputPad.withClear : sizing.inputPad.bare,
          '[&::-webkit-search-cancel-button]:appearance-none',
          className,
        )}
        {...props}
      />
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={clearLabel}
          className={cn(
            'absolute inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground',
            sizing.clear,
          )}
        >
          <X className={sizing.clearIcon} />
        </button>
      )}
    </div>
  );
}
