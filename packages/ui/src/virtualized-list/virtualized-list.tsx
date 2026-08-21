import { Virtuoso, type Components, type FollowOutput, type ItemProps } from 'react-virtuoso';
import {
  useCallback,
  useMemo,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from '../utils/cn';

const DEFAULT_SCROLL_CLASSNAME = 'h-full w-full overflow-auto';
const DEFAULT_STYLE: CSSProperties = { height: 400 };

export type VirtualizedListProps<TItem> = {
  ariaLabel: string;
  data: TItem[];
  /** Renders one row. Rows may vary freely in height. */
  renderItem: (item: TItem, index: number) => ReactNode;
  /** Stable row key. Defaults to the index. */
  getItemKey?: (item: TItem, index: number) => string;
  /** Accessible label for a row. */
  getItemTextValue?: (item: TItem, index: number) => string;
  onItemClick?: (item: TItem) => void;
  onStartReached?: (index: number) => void;
  onEndReached?: (index: number) => void;
  /**
   * Pins the view to the newest row while items stream in, releasing when the
   * user scrolls away. The affordance a live log tail needs.
   * @default false
   */
  followOutput?: FollowOutput;
  initialTopMostItemIndex?: number;
  loading?: boolean;
  emptyMessage?: string;
  /** Overrides the default centered empty or loading rendering. */
  renderEmptyState?: () => ReactNode;
  /** Applied to the list element. */
  className?: string;
  /** Applied to each row. */
  itemClassName?: string;
  /** Applied to Virtuoso's scroll container. */
  scrollClassName?: string;
  style?: CSSProperties;
};

type VirtualizedListContext<TItem> = {
  ariaLabel: string;
  emptyMessage: string;
  getItemKey?: (item: TItem, index: number) => string;
  getItemTextValue?: (item: TItem, index: number) => string;
  isLoading: boolean;
  itemClassName?: string;
  listClassName?: string;
  onItemClick?: (item: TItem) => void;
  renderEmptyState?: () => ReactNode;
};

type ListComponentProps = {
  children?: ReactNode;
  context: VirtualizedListContext<unknown>;
  /**
   * Virtuoso measures the list through this ref (see `ListProps` in
   * react-virtuoso). Dropping it leaves the list unmeasured: it collapses to
   * a single probe row instead of filling the viewport.
   */
  ref?: Ref<HTMLDivElement>;
  style?: CSSProperties;
};

type ListItemComponentProps = ItemProps<unknown> & {
  context: VirtualizedListContext<unknown>;
};

const VirtualizedListElement = ({ children, context, ref, style }: ListComponentProps) => (
  <div
    aria-label={context.ariaLabel}
    className={cn(context.listClassName)}
    ref={ref}
    role="list"
    style={style}
  >
    {children}
  </div>
);

const VirtualizedListRow = ({ children, context, item, ...props }: ListItemComponentProps) => {
  const index = props['data-index'];
  const isActionable = Boolean(context.onItemClick);

  const activateItem = () => {
    context.onItemClick?.(item);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isActionable || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    activateItem();
  };

  const fallbackKey = context.getItemKey?.(item, index) ?? String(index);

  return (
    <div
      {...props}
      aria-label={context.getItemTextValue?.(item, index) ?? fallbackKey}
      className={cn(
        'border-b border-border last:border-0 transition-colors hover:bg-accent/50',
        isActionable && 'cursor-pointer',
        context.itemClassName,
      )}
      onClick={isActionable ? activateItem : undefined}
      onKeyDown={handleKeyDown}
      role="listitem"
      tabIndex={isActionable ? 0 : undefined}
    >
      {children}
    </div>
  );
};

const VirtualizedListEmptyState = ({ context }: { context: VirtualizedListContext<unknown> }) => (
  <>
    {context.renderEmptyState?.() ?? (
      <div className="flex min-h-56 w-full items-center justify-center px-4 py-10 text-center">
        <span className="text-sm text-muted-foreground">
          {context.isLoading ? 'Loading…' : context.emptyMessage}
        </span>
      </div>
    )}
  </>
);

// Virtuoso requires component definitions to remain stable between renders.
// Dynamic behavior travels through its `context` prop instead.
const virtualizedListComponents: Components<unknown, VirtualizedListContext<unknown>> = {
  EmptyPlaceholder: VirtualizedListEmptyState,
  Item: VirtualizedListRow,
  List: VirtualizedListElement,
};

/** A virtualized list for large datasets of variable-height, freely-composed rows. */
export const VirtualizedList = <TItem,>({
  ariaLabel,
  data,
  renderItem,
  getItemKey,
  getItemTextValue,
  onItemClick,
  onStartReached,
  onEndReached,
  followOutput = false,
  initialTopMostItemIndex,
  loading = false,
  emptyMessage = 'No data.',
  renderEmptyState,
  className,
  itemClassName,
  scrollClassName,
  style,
}: VirtualizedListProps<TItem>) => {
  const context = useMemo<VirtualizedListContext<TItem>>(
    () => ({
      ariaLabel,
      emptyMessage,
      getItemKey,
      getItemTextValue,
      isLoading: loading,
      itemClassName,
      listClassName: className,
      onItemClick,
      renderEmptyState,
    }),
    [
      ariaLabel,
      className,
      emptyMessage,
      getItemKey,
      getItemTextValue,
      itemClassName,
      loading,
      onItemClick,
      renderEmptyState,
    ],
  );
  const itemContent = useCallback(
    (index: number, item: TItem) => renderItem(item, index),
    [renderItem],
  );
  const computeItemKey = useCallback(
    (index: number, item: TItem) => getItemKey?.(item, index) ?? String(index),
    [getItemKey],
  );

  return (
    <Virtuoso<TItem, VirtualizedListContext<TItem>>
      className={cn(DEFAULT_SCROLL_CLASSNAME, scrollClassName)}
      components={virtualizedListComponents as Components<TItem, VirtualizedListContext<TItem>>}
      computeItemKey={computeItemKey}
      context={context}
      data={data}
      endReached={onEndReached}
      followOutput={followOutput}
      // Spread conditionally rather than passing `undefined`: Virtuoso reads
      // this prop as `typeof value === 'number' ? value : value.index`, so an
      // explicit `undefined` throws instead of falling back to its default,
      // and the list renders no rows at all.
      {...(initialTopMostItemIndex === undefined ? {} : { initialTopMostItemIndex })}
      itemContent={itemContent}
      startReached={onStartReached}
      style={style ? { ...DEFAULT_STYLE, ...style } : DEFAULT_STYLE}
    />
  );
};
