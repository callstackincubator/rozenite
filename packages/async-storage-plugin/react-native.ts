/**
 * AsyncStorage Plugin for Rozenite DevTools
 * 
 * This plugin provides a powerful interface for inspecting and managing
 * AsyncStorage data in your React Native application.
 */

import { useAsyncStorageDevTools as useDevToolsImpl } from './src/react-native/useAsyncStorageDevTools';
export type { AsyncStorageAPI } from './src/react-native/async-storage-container';

const isWeb = typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

// In development and in a React Native environment, use the real implementation
export const useAsyncStorageDevTools = (!isWeb && !isServer && isDev) 
  ? useDevToolsImpl 
  : () => null;
  