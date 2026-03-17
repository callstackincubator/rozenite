/**
 * This module is required by the internals of the React Native DevTools integration.
 * The original implementation won't work on the web, so we need to provide our own version.
 * @see https://github.com/facebook/react-native/blob/main/packages/react-native/src/private/featureflags/ReactNativeFeatureFlags.js
 */

export const enableNativeCSSParsing = () => false;