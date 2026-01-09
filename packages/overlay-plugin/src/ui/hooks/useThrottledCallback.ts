import { useEffect, useRef, useCallback, useLayoutEffect } from 'react';

/**
 * A hook that returns a throttled version of the callback.
 * Guaranteed to execute on the leading edge (immediately) and the trailing edge (after delay).
 * The returned function is stable and handles changing callbacks.
 */
export function useThrottledCallback<A extends any[]>(
  callback: (...args: A) => void,
  delay: number
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const argsRef = useRef<A | null>(null);
  const lastRunRef = useRef<number>(0);
  
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: A) => {
      const now = Date.now();
      argsRef.current = args;

      const execute = () => {
         if (argsRef.current) {
             callbackRef.current(...argsRef.current);
             lastRunRef.current = Date.now();
             argsRef.current = null;
         }
      };

      if (!timeoutRef.current) {
        if (now - lastRunRef.current >= delay) {
          // Leading edge execution
          callbackRef.current(...args);
          lastRunRef.current = now;
          argsRef.current = null; // Consumed

          // Start timeout
          timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            // Trailing check
            execute();
          }, delay);
        } else {
          // Schedule trailing
          const remaining = delay - (now - lastRunRef.current);
          timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            execute();
          }, remaining);
        }
      }
    },
    [delay]
  );
}