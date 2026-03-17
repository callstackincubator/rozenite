export const isWeb = (): boolean => {
  // Checking for window.document to not depend on the 'react-native' package.
  return (
    typeof window !== 'undefined' && typeof window.document !== 'undefined'
  );
};


declare global {
  var __ROZENITE_WEB__: unknown;
}

export const isRozeniteWeb = (): boolean => {
  return isWeb() && typeof window.__ROZENITE_WEB__ !== 'undefined';
};

export const isServer = (): boolean => {
  return typeof window === 'undefined';
};