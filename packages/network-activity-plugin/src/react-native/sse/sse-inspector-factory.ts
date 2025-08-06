import { getSSEInspector, type SSEInspector } from './sse-inspector';

export const getSSEInspectorSafely = (): SSEInspector | null => {
  try {
    // Check if react-native-sse is available
    require('react-native-sse');

    return getSSEInspector();
    // return createSSEInspector();
    return null;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'MODULE_NOT_FOUND'
    ) {
      return null;
    }

    throw error;
  }
};
