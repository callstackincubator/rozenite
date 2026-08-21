import type { RozenitePlatform } from './config';

/**
 * How each host platform is named in the UI.
 *
 * Only the two the standalone app can be launched for: `rozenite open`
 * (React Native, via Metro) and `@rozenite/lynx-dev`'s printed URL (Lynx).
 * Rozenite for Web is debugged in React Native DevTools rather than here,
 * and is labelled there instead (see `@rozenite/runtime`'s
 * `framework-title.ts`).
 */
const FRAMEWORK_LABELS: Record<RozenitePlatform, string> = {
  'react-native': 'React Native',
  lynx: 'Lynx',
};

/**
 * The framework label for a served config, or `null` when the server named
 * a platform this build doesn't know. `fetchConfig` does no validation —
 * the payload is whatever the dev server sent — so an unknown value is
 * dropped rather than shown raw.
 */
export const getFrameworkLabel = (platform: RozenitePlatform | undefined): string | null =>
  platform ? (FRAMEWORK_LABELS[platform] ?? null) : null;
