import { useCallback } from 'react';
import { useToast } from '@rozenite/ui';

/**
 * Runs a panel operation and shows a failure as an error toast. Never
 * rejects: it resolves to whether the operation succeeded.
 */
export const useRunWithToast = () => {
  const toast = useToast();
  return useCallback(
    (label: string, operation: () => unknown): Promise<boolean> =>
      Promise.resolve()
        .then(operation)
        .then(
          () => true,
          (error: unknown) => {
            toast.add({
              title: `${label} failed`,
              description: (error as Error).message,
              type: 'error',
            });
            return false;
          },
        ),
    [toast],
  );
};
