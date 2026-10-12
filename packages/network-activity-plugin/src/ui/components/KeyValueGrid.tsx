import React from 'react';
import { cn, DescriptionList, Text } from '@rozenite/ui';

export type KeyValueItem = {
  key: string;
  value: React.ReactNode;
  keyClassName?: string;
  valueClassName?: string;
};

export type KeyValueGridProps = {
  items?: KeyValueItem[];
  emptyMessage?: string;
  /**
   * `label` keys are field names set in the uppercase mono label style. `data` keys are
   * case-sensitive names (headers, parameters), shown as typed in mono, with mono values.
   * @default 'label'
   */
  variant?: 'label' | 'data';
  className?: string;
};

export const KeyValueGrid = ({
  items = [],
  emptyMessage,
  variant = 'label',
  className,
}: KeyValueGridProps) => {
  if (items.length === 0) {
    return emptyMessage ? (
      <Text variant="caption" className={cn('block italic', className)}>
        {emptyMessage}
      </Text>
    ) : null;
  }

  const isData = variant === 'data';

  return (
    <DescriptionList className={className}>
      {items.map((item, index) => (
        <DescriptionList.Item
          key={index}
          label={
            <span
              className={cn(
                'wrap-anywhere',
                isData && 'font-mono text-xs tracking-normal normal-case',
                item.keyClassName,
              )}
            >
              {item.key}
            </span>
          }
        >
          <span
            className={cn(
              'wrap-anywhere text-foreground',
              isData && 'font-mono text-xs',
              item.valueClassName,
            )}
          >
            {item.value}
          </span>
        </DescriptionList.Item>
      ))}
    </DescriptionList>
  );
};
