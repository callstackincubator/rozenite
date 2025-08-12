import React, { Fragment } from 'react';
import { cn } from '../utils/cn';

export type KeyValueItem = {
  key: string;
  value: React.ReactNode;
  keyClassName?: string;
  valueClassName?: string;
};

export type KeyValueGridProps = {
  items?: KeyValueItem[];
  emptyMessage?: string;
  className?: string;
};

export const KeyValueGrid = ({
  items = [],
  emptyMessage,
  className,
}: KeyValueGridProps) => {
  const gridClassName = cn(
    'grid grid-cols-[minmax(7rem,25%)_minmax(3rem,1fr)] gap-x-2 gap-y-2 text-sm',
    className
  );

  if (items.length === 0) {
    return emptyMessage ? (
      <div className={gridClassName}>
        <span className="col-span-2 text-gray-500 italic">{emptyMessage}</span>
      </div>
    ) : null;
  }

  return (
    <div className={gridClassName}>
      {items.map((item, index) => (
        <Fragment key={index}>
          <span
            className={cn(
              'text-gray-400 wrap-anywhere',
              item.keyClassName
            )}
          >
            {item.key}
          </span>
          <span className={cn('wrap-anywhere', item.valueClassName)}>
            {item.value}
          </span>
        </Fragment>
      ))}
    </div>
  );
};
