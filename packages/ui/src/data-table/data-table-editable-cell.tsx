import { useState, type ComponentProps } from 'react';
import { cn } from '../utils/cn';

export type DataTableEditableCellProps = Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'onCommit'
> & {
  value: string;
  /** Called with the new value when the edit is confirmed (Enter or blur). */
  onCommit: (value: string) => void;
};

/**
 * Click-to-edit text cell for `DataTable`. Renders the value as plain text
 * until clicked, then swaps to an input; commits on Enter or blur, discards
 * on Escape.
 */
/** A click-to-edit text cell that commits changes on Enter or blur. */
export function DataTableEditableCell({
  value,
  onCommit,
  className,
  ...props
}: DataTableEditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={cn('w-full rounded-sm px-1 py-0.5 text-left hover:bg-accent/50', className)}
      >
        {value}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    if (draft !== value) {
      onCommit(draft);
    }
  };

  return (
    <input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit();
        } else if (event.key === 'Escape') {
          setEditing(false);
        }
      }}
      className={cn(
        'w-full rounded-sm border border-ring bg-transparent px-1 py-0.5 outline-none',
        className,
      )}
      {...props}
    />
  );
}
