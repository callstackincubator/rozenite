import type { Framework } from './framework';

/**
 * Trails every title, the way React Native DevTools' own
 * "- React Native DevTools" does: whatever comes before it identifies
 * *which* window this is, and the product name says what it is.
 */
const APP_NAME = 'Rozenite';
const SEPARATOR = ' · ';

export type DocumentTitleParts = {
  /** `null` until the target reports it — see `getFrameworkFromMetadata`. */
  framework: Framework | null;
  /** The device's display name; the raw device id until one resolves. */
  targetName: string;
};

/**
 * The window title for a Rozenite app window — "Lynx · Pixel 8 -
 * Rozenite".
 *
 * This app owns its title in both the places it runs: a browser tab shows
 * it directly, and the Electron shell has no `page-title-updated` handler,
 * so Electron's default propagates it to the window (`title: 'Rozenite'`
 * in `packages/electron-app/src/main.js` is only the value before this
 * page loads). Both matter for the same reason: several Rozenite windows
 * open at once, and only what is in front of "- Rozenite" tells them
 * apart.
 *
 * Deliberately *not* the case in React Native DevTools, where the
 * frontend owns the title and Rozenite leaves it exactly as it found it.
 *
 * Both parts are optional in practice, so every combination degrades to
 * something readable rather than to stray separators.
 */
export const buildDocumentTitle = ({ framework, targetName }: DocumentTitleParts): string => {
  const parts = [framework, targetName].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? `${parts.join(SEPARATOR)} - ${APP_NAME}` : APP_NAME;
};
