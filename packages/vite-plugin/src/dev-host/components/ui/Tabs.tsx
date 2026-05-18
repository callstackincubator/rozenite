import { Children, createContext, isValidElement, useContext, type ReactElement, type ReactNode } from 'react';
import { Tab, Tabs as BaseTabs } from 'baseui/tabs/index.js';
import { cn } from '../../utils.js';

type TabsContextValue = {
  activeKey: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

type TabsProps = {
  className?: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
};

type TabsListProps = {
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
};

type TabsTriggerProps = {
  value: string;
  disabled?: boolean;
  children: ReactNode;
};

type TabsContentProps = {
  value: string;
  className?: string;
  children: ReactNode;
};

type ElementWithChildren = ReactElement<{ children?: ReactNode }>;
type TabTriggerElement = ReactElement<TabsTriggerProps>;
type TabsContentElement = ReactElement<TabsContentProps>;

const collectElements = <T,>(
  children: ReactNode,
  matcher: (element: ReactElement) => element is ReactElement<T>,
): Array<ReactElement<T>> => {
  const matches: Array<ReactElement<T>> = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    if (matcher(child)) {
      matches.push(child);
      return;
    }

    const childWithChildren = child as ElementWithChildren;

    if (childWithChildren.props.children !== undefined) {
      matches.push(...collectElements(childWithChildren.props.children, matcher));
    }
  });

  return matches;
};

const tabsOverrides = {
  Root: {
    style: {
      width: '100%',
      minWidth: 0,
    },
  },
  TabBar: {
    style: {
      display: 'inline-flex',
      minHeight: '26px',
      maxWidth: '100%',
      alignItems: 'center',
      gap: '2px',
      overflowX: 'auto',
      overflowY: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '4px',
      background: 'rgba(255, 255, 255, 0.04)',
      paddingTop: '2px',
      paddingRight: '2px',
      paddingBottom: '2px',
      paddingLeft: '2px',
      scrollbarWidth: 'none',
    },
  },
  Tab: {
    style: ({ $active, $disabled, $isFocusVisible }: { $active?: boolean; $disabled?: boolean; $isFocusVisible?: boolean }) => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      whiteSpace: 'nowrap',
      borderRadius: '2px',
      backgroundColor: $active ? '#ffffff' : 'transparent',
      minHeight: '22px',
      paddingTop: '3px',
      paddingRight: '9px',
      paddingBottom: '3px',
      paddingLeft: '9px',
      color: $active ? '#000000' : 'rgba(255, 255, 255, 0.6)',
      fontSize: '12px',
      fontWeight: 500,
      lineHeight: 1.2,
      transitionProperty: 'background-color, color',
      transitionDuration: '120ms',
      outline: $isFocusVisible ? '2px solid rgba(130, 50, 255, 0.95)' : 'none',
      outlineOffset: '-2px',
      cursor: $disabled ? 'default' : 'pointer',
      opacity: $disabled ? 0.4 : 1,
      ':hover': $disabled || $active ? undefined : {
        color: '#ffffff',
      },
    }),
  },
};

export const Tabs = ({ className, value, onValueChange, children }: TabsProps) => {
  const lists = collectElements(children, (child): child is ReactElement<TabsListProps> => child.type === TabsList);
  const content = collectElements(children, (child): child is TabsContentElement => child.type === TabsContent);
  const list = lists[0];

  if (!list) {
    return null;
  }

  const triggers = Children.toArray(list.props.children).filter(
    (child): child is TabTriggerElement => isValidElement(child) && child.type === TabsTrigger,
  );

  return (
    <TabsContext.Provider value={{ activeKey: value }}>
      <div className={cn('rz-tabs-root', className)}>
        <BaseTabs activeKey={value} onChange={({ activeKey }) => onValueChange(String(activeKey))} overrides={tabsOverrides}>
          {triggers.map((trigger) => (
            <Tab key={trigger.props.value} title={trigger.props.children} disabled={trigger.props.disabled} />
          ))}
        </BaseTabs>
        {content}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children }: TabsListProps) => {
  return <>{children}</>;
};

export const TabsTrigger = (_props: TabsTriggerProps) => {
  return null;
};

export const TabsContent = ({ value, className, children }: TabsContentProps) => {
  const context = useContext(TabsContext);
  const isActive = context?.activeKey === value;

  if (!isActive) {
    return null;
  }

  return <div className={className}>{children}</div>;
};
