import { Check, Copy } from 'lucide-react';
import { MouseEvent, PropsWithChildren } from 'react';
import { cn } from '@rozenite/ui';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

type JsonTreeCopyableItemProps = PropsWithChildren<{
  getCopyableValue: () => string;
  className?: string;
}>;

export const JsonTreeCopyableItem = ({
  children,
  getCopyableValue,
  className,
}: JsonTreeCopyableItemProps) => {
  const { isCopied, copy } = useCopyToClipboard();

  const handleCopy = (event: MouseEvent) => {
    event.stopPropagation();

    copy(getCopyableValue());
  };

  const Icon = isCopied ? Check : Copy;

  return (
    <span className={cn('group inline-block', className)}>
      {children}
      <div
        className="-m-2 ml-0 inline-block translate-y-0.75 cursor-pointer p-2 text-faint opacity-0 transition-[color,opacity] duration-[120ms] group-hover:opacity-100 hover:text-foreground"
        onClick={handleCopy}
      >
        <Icon className="size-3.5" />
      </div>
    </span>
  );
};
