import { useState, useRef, useEffect, useCallback } from 'react';

import { copyToClipboard } from '../utils/copyToClipboard';

export function useCopyToClipboard() {
  const [isCopied, setIsCopied] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const copy = useCallback(async (value: string) => {
    try {
      await copyToClipboard(value);
  
      setIsCopied(true);
  
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsCopied(false), 1000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  return { isCopied, copy };
}
