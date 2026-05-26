import { useState } from 'react';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { Input } from './Input';
import { Button } from './Button';
import { X, Filter, ChevronDown, Check } from 'lucide-react';
import type { HttpMethod, NetworkEventSource } from '../../shared/client';
import {
  createDefaultFilter,
  DEFAULT_REQUEST_TYPES,
} from '../state/filter';
import type {
  AdvancedFilterState,
  FilterState,
  RequestTypeFilter,
} from '../state/filter';

type FilterBarProps = {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
};

const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
];
const SOURCES: NetworkEventSource[] = ['builtin', 'nitro'];

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

const getActiveFilterCount = (filter: FilterState) => {
  const typeFilterCount =
    filter.types.size < DEFAULT_REQUEST_TYPES.length ? 1 : 0;

  return typeFilterCount + getAdvancedFilterCount(filter.advanced);
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

const FilterPanelLabel = ({ children }: { children: string }) => (
  <div className="px-2 py-1.5 text-xs font-semibold text-gray-400">
    {children}
  </div>
);

const FilterPanelSeparator = () => (
  <div className="-mx-1 my-1 h-px bg-gray-700" />
);

const FilterCheckbox = ({
  checked,
  onCheckedChange,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: string;
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-left text-sm outline-none transition-colors hover:bg-gray-700 focus:bg-gray-700 focus:text-gray-100"
    onClick={() => onCheckedChange(!checked)}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      {checked && <Check className="h-4 w-4" />}
    </span>
    {children}
  </button>
);

export const FilterBar = ({ filter, onFilterChange }: FilterBarProps) => {
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: isFilterPanelOpen,
    onOpenChange: setIsFilterPanelOpen,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(5),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${availableHeight}px`;
        },
      }),
    ],
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

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

  const activeFilterCount = getActiveFilterCount(filter);
  const hasActiveFilters = filter.text.trim() !== '' || activeFilterCount > 0;

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

      <Button
        ref={refs.setReference}
        variant="ghost"
        size="sm"
        className={`h-8 px-3 text-xs transition-all ${
          activeFilterCount > 0
            ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300 hover:bg-blue-600/30'
            : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700'
        }`}
        {...getReferenceProps()}
      >
        <Filter className="h-3 w-3 mr-1" />
        Filters
        {activeFilterCount > 0 && (
          <span className="rounded bg-blue-500/30 px-1 text-[10px] text-blue-100">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown className="h-3 w-3 ml-1" />
      </Button>

      {isFilterPanelOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            className="z-50 w-80 space-y-1 overflow-y-auto overscroll-contain rounded-md border border-gray-600 bg-gray-800 p-1 text-gray-100 shadow-lg"
            style={floatingStyles}
            {...getFloatingProps()}
          >
            <FilterPanelLabel>Request Type</FilterPanelLabel>
            {DEFAULT_REQUEST_TYPES.map((type) => (
              <FilterCheckbox
                key={type}
                checked={filter.types.has(type)}
                onCheckedChange={() => toggleType(type)}
              >
                {getTypeLabel(type)}
              </FilterCheckbox>
            ))}

            <FilterPanelSeparator />
            <FilterPanelLabel>Method</FilterPanelLabel>
            <div className="grid grid-cols-2">
              {HTTP_METHODS.map((method) => (
                <FilterCheckbox
                  key={method}
                  checked={filter.advanced.methods.has(method)}
                  onCheckedChange={() => toggleMethod(method)}
                >
                  {method}
                </FilterCheckbox>
              ))}
            </div>

            <FilterPanelSeparator />
            <FilterPanelLabel>Request Source</FilterPanelLabel>
            {SOURCES.map((source) => (
              <FilterCheckbox
                key={source}
                checked={filter.advanced.sources.has(source)}
                onCheckedChange={() => toggleSource(source)}
              >
                {getSourceLabel(source)}
              </FilterCheckbox>
            ))}

            <FilterPanelSeparator />
            <FilterCheckbox
              checked={filter.advanced.failedOnly}
              onCheckedChange={(checked) =>
                updateAdvancedFilter({ failedOnly: checked })
              }
            >
              Failed only
            </FilterCheckbox>
            <FilterCheckbox
              checked={filter.advanced.inFlightOnly}
              onCheckedChange={(checked) =>
                updateAdvancedFilter({ inFlightOnly: checked })
              }
            >
              In-flight only
            </FilterCheckbox>
            <FilterCheckbox
              checked={filter.advanced.overriddenOnly}
              onCheckedChange={(checked) =>
                updateAdvancedFilter({ overriddenOnly: checked })
              }
            >
              Overridden only
            </FilterCheckbox>

            <FilterPanelSeparator />
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
                onChange={(contentType) =>
                  updateAdvancedFilter({ contentType })
                }
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
                onChange={(minDuration) =>
                  updateAdvancedFilter({ minDuration })
                }
              />
              <FilterField
                label="Max Duration"
                value={filter.advanced.maxDuration}
                placeholder="2000"
                onChange={(maxDuration) =>
                  updateAdvancedFilter({ maxDuration })
                }
              />
            </div>
          </div>
        </FloatingPortal>
      )}

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
