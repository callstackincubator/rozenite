import { useState } from 'react';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { Check, ChevronDown, Filter } from 'lucide-react';
import {
  Badge,
  Button,
  cn,
  IconButton,
  Input,
  SearchField,
  Separator,
  Text,
  X,
} from '@rozenite/ui';
import type { HttpMethod, NetworkEventSource } from '../../shared/client';
import { createDefaultFilter, DEFAULT_REQUEST_TYPES } from '../state/filter';
import type { AdvancedFilterState, FilterState, RequestTypeFilter } from '../state/filter';

type FilterBarProps = {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
};

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];
const SOURCES: NetworkEventSource[] = ['builtin', 'expo', 'nitro'];

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
    case 'expo':
      return 'Expo';
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
  const typeFilterCount = filter.types.size < DEFAULT_REQUEST_TYPES.length ? 1 : 0;

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
  <label className="flex flex-col gap-1 px-2 py-1">
    <Text variant="label" className="text-[10px]">
      {label}
    </Text>
    <Input
      size="sm"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className="font-mono"
    />
  </label>
);

const FilterPanelLabel = ({ children }: { children: string }) => (
  <Text variant="label" className="block px-2 pt-2 pb-1 text-[10px]">
    {children}
  </Text>
);

const FilterPanelSeparator = () => <Separator className="-mx-1 my-1 w-auto" />;

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
    className={cn(
      'flex w-full cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-foreground select-none',
      'transition-colors duration-[120ms] outline-none hover:bg-accent focus-visible:bg-accent',
    )}
    onClick={() => onCheckedChange(!checked)}
  >
    {children}
    {checked && <Check className="size-3.5 shrink-0 text-primary" />}
  </button>
);

/**
 * The text filter and the filters popup, as controls for a toolbar. The popup is rendered in
 * place, not in a portal, so it stays inside the panel's theme.
 */
export const FilterBar = ({ filter, onFilterChange }: FilterBarProps) => {
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: isFilterPanelOpen,
    onOpenChange: setIsFilterPanelOpen,
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
    placement: 'bottom-end',
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
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

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
    <>
      <div className="min-w-32 flex-1">
        <SearchField
          size="sm"
          placeholder="Filter requests..."
          aria-label="Filter requests"
          value={filter.text}
          onChange={(e) => handleTextChange(e.target.value)}
          onClear={() => handleTextChange('')}
        />
      </div>

      <Button
        ref={refs.setReference}
        tone={activeFilterCount > 0 ? 'primary' : 'neutral'}
        variant="outline"
        size="sm"
        {...getReferenceProps()}
      >
        <Filter />
        Filters
        {activeFilterCount > 0 && (
          <Badge tone="primary" variant="solid" size="sm">
            {activeFilterCount}
          </Badge>
        )}
        <ChevronDown className="ml-0.5 !size-3" />
      </Button>

      {isFilterPanelOpen && (
        <div
          ref={refs.setFloating}
          className="z-50 flex w-80 flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-md border border-input bg-popover p-1 text-popover-foreground"
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
            onCheckedChange={(checked) => updateAdvancedFilter({ failedOnly: checked })}
          >
            Failed only
          </FilterCheckbox>
          <FilterCheckbox
            checked={filter.advanced.inFlightOnly}
            onCheckedChange={(checked) => updateAdvancedFilter({ inFlightOnly: checked })}
          >
            In-flight only
          </FilterCheckbox>
          <FilterCheckbox
            checked={filter.advanced.overriddenOnly}
            onCheckedChange={(checked) => updateAdvancedFilter({ overriddenOnly: checked })}
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
        </div>
      )}

      {hasActiveFilters && (
        <IconButton
          label="Clear filters"
          tone="neutral"
          variant="ghost"
          size="sm"
          onClick={clearFilters}
        >
          <X />
        </IconButton>
      )}
    </>
  );
};
