import { Input } from './Input';
import { Button } from './Button';
import { X, Filter, ChevronDown, SlidersHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './DropdownMenu';
import type { HttpMethod, NetworkEventSource } from '../../shared/client';

export type RequestTypeFilter = 'http' | 'websocket' | 'sse';
export type AdvancedFilterState = {
  methods: Set<HttpMethod>;
  sources: Set<NetworkEventSource>;
  status: string;
  domain: string;
  contentType: string;
  failedOnly: boolean;
  inFlightOnly: boolean;
  overriddenOnly: boolean;
  minSize: string;
  maxSize: string;
  minDuration: string;
  maxDuration: string;
};

export type FilterState = {
  text: string;
  types: Set<RequestTypeFilter>;
  advanced: AdvancedFilterState;
};

type FilterBarProps = {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
};

const REQUEST_TYPES: RequestTypeFilter[] = ['http', 'sse', 'websocket'];
const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
];
const SOURCES: NetworkEventSource[] = ['builtin', 'nitro'];

export const createDefaultFilter = (): FilterState => ({
  text: '',
  types: new Set(REQUEST_TYPES),
  advanced: {
    methods: new Set(),
    sources: new Set(),
    status: '',
    domain: '',
    contentType: '',
    failedOnly: false,
    inFlightOnly: false,
    overriddenOnly: false,
    minSize: '',
    maxSize: '',
    minDuration: '',
    maxDuration: '',
  },
});

const getTypeLabel = (type: RequestTypeFilter) => {
  switch (type) {
    case 'http':
      return 'XHR';
    case 'websocket':
      return 'WS';
    case 'sse':
      return 'SSE';
  }
};

const getSourceLabel = (source: NetworkEventSource) => {
  switch (source) {
    case 'builtin':
      return 'Built-in';
    case 'nitro':
      return 'Nitro';
  }
};

const getAdvancedFilterCount = (advanced: AdvancedFilterState) => {
  return [
    advanced.methods.size > 0,
    advanced.sources.size > 0,
    advanced.status.trim() !== '',
    advanced.domain.trim() !== '',
    advanced.contentType.trim() !== '',
    advanced.failedOnly,
    advanced.inFlightOnly,
    advanced.overriddenOnly,
    advanced.minSize.trim() !== '',
    advanced.maxSize.trim() !== '',
    advanced.minDuration.trim() !== '',
    advanced.maxDuration.trim() !== '',
  ].filter(Boolean).length;
};

const FilterField = ({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) => (
  <label className="block space-y-1 px-2 py-1">
    <span className="text-xs text-gray-400">{label}</span>
    <Input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className="h-7 bg-gray-900 border-gray-700 text-xs text-gray-100 placeholder:text-gray-500"
    />
  </label>
);

export const FilterBar = ({ filter, onFilterChange }: FilterBarProps) => {
  const handleTextChange = (text: string) => {
    onFilterChange({ ...filter, text });
  };

  const updateAdvancedFilter = (patch: Partial<AdvancedFilterState>) => {
    onFilterChange({
      ...filter,
      advanced: {
        ...filter.advanced,
        ...patch,
      },
    });
  };

  const toggleType = (type: RequestTypeFilter) => {
    const newTypes = new Set(filter.types);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    onFilterChange({ ...filter, types: newTypes });
  };

  const toggleMethod = (method: HttpMethod) => {
    const methods = new Set(filter.advanced.methods);
    if (methods.has(method)) {
      methods.delete(method);
    } else {
      methods.add(method);
    }
    updateAdvancedFilter({ methods });
  };

  const toggleSource = (source: NetworkEventSource) => {
    const sources = new Set(filter.advanced.sources);
    if (sources.has(source)) {
      sources.delete(source);
    } else {
      sources.add(source);
    }
    updateAdvancedFilter({ sources });
  };

  const clearFilters = () => {
    onFilterChange(createDefaultFilter());
  };

  const advancedFilterCount = getAdvancedFilterCount(filter.advanced);
  const hasActiveFilters =
    filter.text !== '' ||
    filter.types.size < REQUEST_TYPES.length ||
    advancedFilterCount > 0;
  const isTypeFilterActive = filter.types.size < REQUEST_TYPES.length;

  return (
    <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
      <div className="flex-1">
        <Input
          placeholder="Filter requests..."
          value={filter.text}
          onChange={(e) => handleTextChange(e.target.value)}
          className="h-8 text-sm bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-400"
        />
      </div>

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
          {REQUEST_TYPES.map((type) => (
            <DropdownMenuCheckboxItem
              key={type}
              checked={filter.types.has(type)}
              onCheckedChange={() => toggleType(type)}
            >
              {getTypeLabel(type)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-3 text-xs transition-all ${
              advancedFilterCount > 0
                ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300 hover:bg-blue-600/30'
                : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700'
            }`}
          >
            <SlidersHorizontal className="h-3 w-3 mr-1" />
            Advanced
            {advancedFilterCount > 0 && (
              <span className="rounded bg-blue-500/30 px-1 text-[10px] text-blue-100">
                {advancedFilterCount}
              </span>
            )}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent sideOffset={5} className="w-80 space-y-1">
          <DropdownMenuLabel>Method</DropdownMenuLabel>
          <div className="grid grid-cols-2">
            {HTTP_METHODS.map((method) => (
              <DropdownMenuCheckboxItem
                key={method}
                checked={filter.advanced.methods.has(method)}
                onCheckedChange={() => toggleMethod(method)}
              >
                {method}
              </DropdownMenuCheckboxItem>
            ))}
          </div>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Request Source</DropdownMenuLabel>
          {SOURCES.map((source) => (
            <DropdownMenuCheckboxItem
              key={source}
              checked={filter.advanced.sources.has(source)}
              onCheckedChange={() => toggleSource(source)}
            >
              {getSourceLabel(source)}
            </DropdownMenuCheckboxItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={filter.advanced.failedOnly}
            onCheckedChange={(checked) =>
              updateAdvancedFilter({ failedOnly: checked })
            }
          >
            Failed only
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filter.advanced.inFlightOnly}
            onCheckedChange={(checked) =>
              updateAdvancedFilter({ inFlightOnly: checked })
            }
          >
            In-flight only
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filter.advanced.overriddenOnly}
            onCheckedChange={(checked) =>
              updateAdvancedFilter({ overriddenOnly: checked })
            }
          >
            Overridden only
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />
          <div className="grid grid-cols-2 gap-x-2">
            <FilterField
              label="Status"
              value={filter.advanced.status}
              placeholder="200, 2xx, >=400"
              onChange={(status) => updateAdvancedFilter({ status })}
            />
            <FilterField
              label="Domain"
              value={filter.advanced.domain}
              placeholder="api.example.com"
              onChange={(domain) => updateAdvancedFilter({ domain })}
            />
            <FilterField
              label="MIME Type"
              value={filter.advanced.contentType}
              placeholder="json"
              onChange={(contentType) => updateAdvancedFilter({ contentType })}
            />
            <FilterField
              label="Min Size"
              value={filter.advanced.minSize}
              placeholder="1024"
              onChange={(minSize) => updateAdvancedFilter({ minSize })}
            />
            <FilterField
              label="Max Size"
              value={filter.advanced.maxSize}
              placeholder="50000"
              onChange={(maxSize) => updateAdvancedFilter({ maxSize })}
            />
            <FilterField
              label="Min Duration"
              value={filter.advanced.minDuration}
              placeholder="500"
              onChange={(minDuration) => updateAdvancedFilter({ minDuration })}
            />
            <FilterField
              label="Max Duration"
              value={filter.advanced.maxDuration}
              placeholder="2000"
              onChange={(maxDuration) => updateAdvancedFilter({ maxDuration })}
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

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
