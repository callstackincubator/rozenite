import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cn } from '../utils/cn';
import type { Size } from '../tokens/size';
import { monoLabel } from '../utils/mono-label';

const tabsListSize = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10',
} as const satisfies Record<Size, string>;

const tabsTabSize = {
  sm: 'px-2.5 text-[11px]',
  md: 'px-3 text-[11px]',
  lg: 'px-4 text-xs',
} as const satisfies Record<Size, string>;

export type TabsProps = TabsPrimitive.Root.Props;

function TabsRoot(props: TabsProps) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

export type TabsListProps = TabsPrimitive.List.Props & {
  /** @default 'md' */
  size?: Size;
};

function TabsList({ className, size = 'md', ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex items-stretch border border-border text-faint',
        tabsListSize[size],
        className,
      )}
      {...props}
    />
  );
}

export type TabsTabProps = TabsPrimitive.Tab.Props & {
  /** @default 'md' */
  size?: Size;
};

function TabsTab({ className, size = 'md', ...props }: TabsTabProps) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap text-faint transition-colors duration-[120ms] not-first:border-l not-first:border-border',
        monoLabel,
        'hover:text-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        'data-[active]:bg-accent data-[active]:text-foreground data-[active]:shadow-[inset_0_-2px_0_var(--primary)]',
        'disabled:pointer-events-none disabled:opacity-50',
        tabsTabSize[size],
        className,
      )}
      {...props}
    />
  );
}

export type TabsPanelProps = TabsPrimitive.Panel.Props;

function TabsPanel({ className, ...props }: TabsPanelProps) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  );
}

/** A set of panels where one view is visible at a time. */
export const Tabs = /* @__PURE__ */ Object.assign(TabsRoot, {
  List: TabsList,
  Tab: TabsTab,
  Panel: TabsPanel,
});
