export const isWeb = (): boolean => {
  // Checking for window.document to not depend on the 'react-native' package.
  return (
    typeof window !== 'undefined' && typeof window.document !== 'undefined'
  );
};
