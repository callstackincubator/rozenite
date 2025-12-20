import { RequireChainMeta, RequireChainData } from '../shared';

export const getRequireChainsList = (): RequireChainMeta[] => {
  if (
    !('getRequireChainsList' in global) ||
    typeof global.getRequireChainsList !== 'function'
  ) {
    return [];
  }

  return global.getRequireChainsList();
};

export const getRequireChainData = (index: number): RequireChainData | null => {
  if (
    !('getRequireChainData' in global) ||
    typeof global.getRequireChainData !== 'function'
  ) {
    return null;
  }

  return global.getRequireChainData(index);
};

export const onRequireChainComplete = (
  callback: (chain: RequireChainMeta) => void,
): (() => void) => {
  if (
    !('__onRequireChainComplete' in global) ||
    typeof (global as Record<string, unknown>).__onRequireChainComplete !==
      'function'
  ) {
    return () => {
      // Return no-op unsubscribe if not available
    };
  }

  return (
    global.__onRequireChainComplete as (
      callback: (chain: RequireChainMeta) => void,
    ) => () => void
  )(callback) as () => void;
};
