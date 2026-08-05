import { useCallback, useRef, useState } from 'react';

export type UseCopyToClipboardOptions = {
  /** How long `copied` stays `true` after a successful copy, in ms. */
  resetDelay?: number;
};

export type UseCopyToClipboardResult = {
  copy: (text: string) => Promise<boolean>;
  copied: boolean;
};

export function useCopyToClipboard({
  resetDelay = 2000,
}: UseCopyToClipboardOptions = {}): UseCopyToClipboardResult {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copy = useCallback(
    async (text: string) => {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), resetDelay);
        return true;
      } catch {
        return false;
      }
    },
    [resetDelay],
  );

  return { copy, copied };
}
