import { Check, Copy } from "lucide-react";
import { MouseEvent, PropsWithChildren } from "react";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { cn } from "../utils/cn";

type JsonTreeCopyableItemProps = PropsWithChildren<{
  getCopyableValue: () => string;
  className?: string;
}>;

export const JsonTreeCopyableItem = ({ children, getCopyableValue, className }: JsonTreeCopyableItemProps) => {
  const { isCopied, copy } = useCopyToClipboard();
  
  const handleCopy = (event: MouseEvent) => {
    event.stopPropagation();

    copy(getCopyableValue());
  }

  const Icon = isCopied ? Check : Copy;

  return (
    <span className={cn('inline-block group', className)}>
      {children}
      <div 
        className="inline-block cursor-pointer opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition-all p-2 -m-2 ml-0 translate-y-0.75"
        onClick={handleCopy}
      >
        <Icon className='h-4 w-4' />
      </div>
    </span>
  );
}
