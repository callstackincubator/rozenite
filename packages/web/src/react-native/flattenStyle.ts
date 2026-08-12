/**
 * Vendored from React Native's `flattenStyle.js`, which lives under the
 * `Libraries/*` path blocked by React Native's Strict TypeScript API
 * (https://reactnative.dev/docs/strict-typescript-api). The function has no
 * dependency on any other RN-internal module, so it's copied here verbatim
 * aside from the Flow -> TypeScript conversion.
 *
 * @see https://github.com/facebook/react-native/blob/v0.86.0/packages/react-native/Libraries/StyleSheet/flattenStyle.js
 */

type Style = Record<string, unknown>;

const flattenStyle = (style: unknown): Style | undefined => {
  if (style === null || style === undefined || typeof style !== 'object') {
    return undefined;
  }

  if (!Array.isArray(style)) {
    return style as Style;
  }

  const result: Style = {};
  for (let i = 0, styleLength = style.length; i < styleLength; ++i) {
    const computedStyle = flattenStyle(style[i]);
    if (computedStyle) {
      for (const key in computedStyle) {
        result[key] = computedStyle[key];
      }
    }
  }
  return result;
};

export default flattenStyle;
