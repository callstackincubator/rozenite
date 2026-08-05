import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cn } from '../utils/cn';

export type TabsProps = TabsPrimitive.Root.Props;

function TabsRoot(props: TabsProps) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

export type TabsListProps = TabsPrimitive.List.Props;

function TabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-md bg-muted p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export type TabsTabProps = TabsPrimitive.Tab.Props;

function TabsTab({ className, ...props }: TabsTabProps) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        'inline-flex h-6 items-center justify-center rounded-sm px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-xs',
        'disabled:pointer-events-none disabled:opacity-50',
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

export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Tab: TabsTab,
  Panel: TabsPanel,
});
