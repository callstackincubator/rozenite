import type { ComponentProps } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { fieldSurface } from '../utils/control-surfaces';

export type SearchFieldProps = Omit<ComponentProps<'input'>, 'type'> & {
  /** Called when the clear button is pressed. Omit to hide the clear affordance. */
  onClear?: () => void;
  /** Accessible name for the clear button.
   * @default 'Clear search' */
  clearLabel?: string;
};

/** A search input with a leading search icon and clear affordance. */
export function SearchField({
  className,
  value,
  onClear,
  clearLabel = 'Clear search',
  ...props
}: SearchFieldProps) {
  const showClear = Boolean(onClear) && Boolean(value);

  return (
    <div data-slot="search-field" className="relative flex items-center">
      <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
      <input
        type="search"
        value={value}
        className={cn(
          fieldSurface(),
          'h-8 min-w-0 pl-8',
          showClear ? 'pr-8' : 'pr-3',
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
          className="absolute right-2 inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
