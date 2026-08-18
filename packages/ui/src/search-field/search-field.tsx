import type { ComponentProps } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../utils/cn';

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
          'h-8 w-full min-w-0 rounded-md border border-input bg-transparent pl-8 text-sm text-foreground shadow-xs transition-colors',
          showClear ? 'pr-8' : 'pr-3',
          'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
          'placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
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
