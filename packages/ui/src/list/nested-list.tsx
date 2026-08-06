import {
  Children,
  createContext,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../utils/cn';

const NestedListDepthContext = createContext(0);

const INDENT_PER_DEPTH_PX = 16;
const BASE_PADDING_PX = 8;

export type NestedListProps = ComponentProps<'div'>;

function NestedListRoot({ className, children, ...props }: NestedListProps) {
  return (
    <div data-slot="nested-list" className={cn('flex flex-col gap-0.5', className)} {...props}>
      <NestedListDepthContext.Provider value={0}>{children}</NestedListDepthContext.Provider>
    </div>
  );
}

export type NestedListItemProps = Omit<ComponentProps<'button'>, 'children'> & {
  label: ReactNode;
  /** Rendered after the disclosure chevron, before the label. Typically an icon. */
  adornment?: ReactNode;
  /** Rendered at the end of the row, e.g. a `Badge` with a count. */
  trailing?: ReactNode;
  selected?: boolean;
  /** Initial expanded state when uncontrolled. @default false */
  defaultExpanded?: boolean;
  /** Controlled expanded state. Omit to let the item manage its own state. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Nested `NestedList.Item`s, rendered when expanded. */
  children?: ReactNode;
};

function NestedListItem({
  className,
  label,
  adornment,
  trailing,
  selected = false,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  children,
  onClick,
  type = 'button',
  ...props
}: NestedListItemProps) {
  const depth = useContext(NestedListDepthContext);
  const hasChildren = Children.count(children) > 0;
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const expanded = expandedProp ?? uncontrolledExpanded;

  const toggleExpanded: ComponentProps<'button'>['onClick'] = (event) => {
    const next = !expanded;
    setUncontrolledExpanded(next);
    onExpandedChange?.(next);
    onClick?.(event);
  };

  return (
    <div data-slot="nested-list-item">
      <button
        type={type}
        data-slot="nested-list-item-row"
        data-selected={selected || undefined}
        data-expanded={expanded || undefined}
        aria-current={selected || undefined}
        aria-expanded={hasChildren ? expanded : undefined}
        style={{ paddingLeft: BASE_PADDING_PX + depth * INDENT_PER_DEPTH_PX }}
        className={cn(
          'flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-sm text-sidebar-foreground',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          'data-[selected]:bg-sidebar-accent data-[selected]:text-sidebar-accent-foreground data-[selected]:font-medium',
          className,
        )}
        onClick={hasChildren ? toggleExpanded : onClick}
        {...props}
      >
        {hasChildren ? (
          <ChevronRight
            data-slot="nested-list-item-chevron"
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60 transition-transform',
              expanded && 'rotate-90',
            )}
          />
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" />
        )}
        {adornment && (
          <span
            data-slot="list-item-adornment"
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5"
          >
            {adornment}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {trailing}
      </button>
      {hasChildren && expanded && (
        <NestedListDepthContext.Provider value={depth + 1}>
          <div data-slot="nested-list-children" className="flex flex-col gap-0.5">
            {children}
          </div>
        </NestedListDepthContext.Provider>
      )}
    </div>
  );
}

/** A collapsible tree of items nested to an arbitrary depth, with automatic left indentation. */
export const NestedList = Object.assign(NestedListRoot, {
  Item: NestedListItem,
});
