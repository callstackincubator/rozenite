import { Input } from './Input';
import { Button } from './Button';
import { X, Filter, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './DropdownMenu';

export type FilterState = {
  text: string;
  types: Set<'http' | 'websocket' | 'sse'>;
};

type FilterBarProps = {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
};

export const FilterBar = ({ filter, onFilterChange }: FilterBarProps) => {
  const handleTextChange = (text: string) => {
    onFilterChange({ ...filter, text });
  };

  const toggleType = (type: 'http' | 'websocket' | 'sse') => {
    const newTypes = new Set(filter.types);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    onFilterChange({ ...filter, types: newTypes });
  };

  const clearFilters = () => {
    onFilterChange({
      text: '',
      types: new Set(['http', 'websocket', 'sse']),
    });
  };

  const hasActiveFilters = filter.text !== '' || filter.types.size < 3;
  const isTypeFilterActive = filter.types.size < 3;

  const getTypeLabel = (type: 'http' | 'websocket' | 'sse') => {
    switch (type) {
      case 'http':
        return 'XHR';
      case 'websocket':
        return 'WS';
      case 'sse':
        return 'SSE';
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
      {/* Text Filter */}
      <div className="flex-1">
        <Input
          placeholder="Filter requests..."
          value={filter.text}
          onChange={(e) => handleTextChange(e.target.value)}
          className="h-8 text-sm bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-400"
        />
      </div>

      {/* Request Type Filters Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-3 text-xs transition-all ${
              isTypeFilterActive
                ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300 hover:bg-blue-600/30'
                : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700'
            }`}
          >
            <Filter className="h-3 w-3 mr-1" />
            Types
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent sideOffset={5} className="space-y-1">
          {(['http', 'sse', 'websocket'] as const).map((type) => (
            <DropdownMenuItem
              key={type}
              onClick={() => toggleType(type)}
              className={
                filter.types.has(type)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100'
              }
            >
              {getTypeLabel(type)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-8 w-8 p-0 text-gray-400 hover:text-blue-400"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
