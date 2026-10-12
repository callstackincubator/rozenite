import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

/** A sort-direction indicator for a sortable table column header. */
export function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') {
    return <ChevronUp className="h-3 w-3 text-foreground" />;
  }

  if (direction === 'desc') {
    return <ChevronDown className="h-3 w-3 text-foreground" />;
  }

  return <ChevronsUpDown className="h-3 w-3 text-faint" />;
}
