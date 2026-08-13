/**
 * React DevTools' style editor only needs the *names* of valid native style
 * attributes (`Object.keys(ReactNativeStyleAttributes)` in
 * `fuseboxConnection.ts`) — it never reads the `process`/`diff` value
 * objects RN attaches to each key. Those value objects are what pull in
 * RN's private `Libraries/StyleSheet/process*` modules and the private
 * `ReactNativeFeatureFlags` module, so instead of vendoring the whole
 * attribute table we vendor just the key list, matching the same set of
 * attribute names as RN's `ReactNativeStyleAttributes.js` (grouped the same
 * way, to make re-syncing on a React Native upgrade easier to diff).
 *
 * @see https://github.com/facebook/react-native/blob/v0.86.0/packages/react-native/Libraries/Components/View/ReactNativeStyleAttributes.js
 */

export const nativeStyleEditorValidAttributes: string[] = [
  // Layout
  'alignContent',
  'alignItems',
  'alignSelf',
  'aspectRatio',
  'borderBottomWidth',
  'borderEndWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'borderStartWidth',
  'borderTopWidth',
  'boxSizing',
  'columnGap',
  'borderWidth',
  'bottom',
  'direction',
  'display',
  'end',
  'flex',
  'flexBasis',
  'flexDirection',
  'flexGrow',
  'flexShrink',
  'flexWrap',
  'gap',
  'height',
  'inset',
  'insetBlock',
  'insetBlockEnd',
  'insetBlockStart',
  'insetInline',
  'insetInlineEnd',
  'insetInlineStart',
  'justifyContent',
  'left',
  'margin',
  'marginBlock',
  'marginBlockEnd',
  'marginBlockStart',
  'marginBottom',
  'marginEnd',
  'marginHorizontal',
  'marginInline',
  'marginInlineEnd',
  'marginInlineStart',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginTop',
  'marginVertical',
  'maxHeight',
  'maxWidth',
  'minHeight',
  'minWidth',
  'overflow',
  'padding',
  'paddingBlock',
  'paddingBlockEnd',
  'paddingBlockStart',
  'paddingBottom',
  'paddingEnd',
  'paddingHorizontal',
  'paddingInline',
  'paddingInlineEnd',
  'paddingInlineStart',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingTop',
  'paddingVertical',
  'position',
  'right',
  'rowGap',
  'start',
  'top',
  'width',
  'zIndex',

  // Shadow
  'elevation',
  'shadowColor',
  'shadowOffset',
  'shadowOpacity',
  'shadowRadius',

  // Transform
  'transform',
  'transformOrigin',

  // Filter
  'filter',

  // MixBlendMode
  'mixBlendMode',

  // Isolation
  'isolation',

  // BoxShadow
  'boxShadow',

  // BackgroundImage
  'experimental_backgroundImage',

  // BackgroundSize
  'experimental_backgroundSize',

  // BackgroundPosition
  'experimental_backgroundPosition',

  // BackgroundRepeat
  'experimental_backgroundRepeat',

  // View
  'backfaceVisibility',
  'backgroundColor',
  'borderBlockColor',
  'borderBlockEndColor',
  'borderBlockStartColor',
  'borderBottomColor',
  'borderBottomEndRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderBottomStartRadius',
  'borderColor',
  'borderCurve',
  'borderEndColor',
  'borderEndEndRadius',
  'borderEndStartRadius',
  'borderLeftColor',
  'borderRadius',
  'borderRightColor',
  'borderStartColor',
  'borderStartEndRadius',
  'borderStartStartRadius',
  'borderStyle',
  'borderTopColor',
  'borderTopEndRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderTopStartRadius',
  'cursor',
  'opacity',
  'outlineColor',
  'outlineOffset',
  'outlineStyle',
  'outlineWidth',
  'pointerEvents',

  // Text
  'color',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'includeFontPadding',
  'letterSpacing',
  'lineHeight',
  'textAlign',
  'textAlignVertical',
  'textDecorationColor',
  'textDecorationLine',
  'textDecorationStyle',
  'textShadowColor',
  'textShadowOffset',
  'textShadowRadius',
  'textTransform',
  'userSelect',
  'verticalAlign',
  'writingDirection',

  // Image
  'overlayColor',
  'resizeMode',
  'tintColor',
  'objectFit',
];
