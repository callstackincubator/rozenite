import type { ReactNode } from 'react';
import { StatefulMenu } from 'baseui/menu/index.js';
import { StatefulPopover, TRIGGER_TYPE } from 'baseui/popover/index.js';

export type DropdownMenuItem<T> = {
  id: string;
  label: string;
  item: T;
};

type DropdownMenuProps<T> = {
  items: DropdownMenuItem<T>[];
  onSelect: (item: T) => void;
  children: ReactNode;
};

export const DropdownMenu = <T,>({ items, onSelect, children }: DropdownMenuProps<T>) => {
  return (
    <StatefulPopover
      triggerType={TRIGGER_TYPE.click}
      placement="bottomRight"
      accessibilityType="menu"
      dismissOnClickOutside
      dismissOnEsc
      focusLock={false}
      autoFocus={false}
      showArrow={false}
      content={({ close }: { close: () => void }) => (
        <div className="rz-baseui-preset-menu">
          <StatefulMenu
            items={items}
            onItemSelect={({ item }: { item: DropdownMenuItem<T> }) => {
              onSelect(item.item);
              close();
            }}
            overrides={{
              List: {
                style: {
                  backgroundColor: '#111111',
                  color: '#ffffff',
                  borderRadius: '8px',
                  minWidth: '220px',
                  maxWidth: 'min(320px, calc(100vw - 24px))',
                  paddingTop: '6px',
                  paddingBottom: '6px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
                },
              },
              Option: {
                props: {
                  getItemLabel: (menuItem: DropdownMenuItem<T>) => menuItem.label,
                },
                style: ({ $isHighlighted }: { $isHighlighted?: boolean }) => ({
                  backgroundColor: $isHighlighted ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  color: '#ffffff',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  paddingTop: '8px',
                  paddingRight: '10px',
                  paddingBottom: '8px',
                  paddingLeft: '10px',
                }),
              },
            }}
          />
        </div>
      )}
      overrides={{
        Body: {
          style: {
            zIndex: 20,
          },
        },
        Inner: {
          style: {
            backgroundColor: 'transparent',
          },
        },
      }}
    >
      {children}
    </StatefulPopover>
  );
};
