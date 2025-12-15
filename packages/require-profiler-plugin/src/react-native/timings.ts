import { RequireTimingNode } from '../shared';

export const getRequireTimings = (): RequireTimingNode | null => {
  if (
    !('getRequireTimings' in global) ||
    typeof global.getRequireTimings !== 'function'
  ) {
    return null;
  }

  return global.getRequireTimings();
};
