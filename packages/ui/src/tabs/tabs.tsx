import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cn } from '../utils/cn';
import type { Size } from '../tokens/size';

const tabsListSize = {
  sm: 'h-6 p-0.5',
  md: 'h-8 p-1',
  lg: 'h-10 p-1',
} as const satisfies Record<Size, string>;

const tabsTabSize = {
  sm: 'h-5 px-2 text-xs',
  md: 'h-6 px-2.5 text-sm',
  lg: 'h-8 px-3 text-base',
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
        'inline-flex items-center gap-1 rounded-md bg-muted text-muted-foreground',
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
        'inline-flex items-center justify-center rounded-sm border border-transparent font-medium whitespace-nowrap text-muted-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'data-[active]:border-border data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-xs',
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
export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Tab: TabsTab,
  Panel: TabsPanel,
});
