import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * The basename `@rozenite/react-native`'s dev entry redirects to, resolved
 * through the host bundler's resolver — so any extension the project's
 * `sourceExts`/platform extensions would produce counts as "already exists".
 */
export const DEV_ENTRY_BASENAME = 'rozenite.dev';

const DEV_ENTRY_DEFAULT_EXTENSION = '.tsx';

// Matches `rozenite.dev.tsx`, `rozenite.dev.js`, and platform-suffixed
// variants like `rozenite.dev.ios.tsx` or `rozenite.dev.web.js` — anything
// the bundler's resolver could land on for the extensionless specifier.
const DEV_ENTRY_FILE_PATTERN = /^rozenite\.dev(\.[^./]+)?\.(tsx|ts|jsx|js)$/;

export const DEV_ENTRY_TEMPLATE = `// Everything you wire up here is development-only. Rozenite redirects its
// dev entry to this file in development, and to a noop in production, so
// nothing imported from here can reach a production bundle.
//
// Import your plugins and call their hooks, for example:
//
//   import { useRozeniteStoragePlugin } from '@rozenite/storage-plugin';
//
//   export default function RozeniteDevTools() {
//     useRozeniteStoragePlugin({ ... });
//     return null;
//   }

export default function RozeniteDevTools() {
  return null;
}
`;

/**
 * Looks for any `rozenite.dev.*` file (including platform-suffixed variants)
 * directly inside `projectRoot`. Returns its absolute path, or `null` when
 * none exists.
 */
export const findExistingDevEntryFile = async (projectRoot: string): Promise<string | null> => {
  let entries: string[];

  try {
    entries = await fs.readdir(projectRoot);
  } catch {
    return null;
  }

  const match = entries.find((entry) => DEV_ENTRY_FILE_PATTERN.test(entry));
  return match ? path.join(projectRoot, match) : null;
};

export type ScaffoldDevEntryResult =
  | { status: 'created'; filePath: string }
  | { status: 'skipped'; filePath: string };

/**
 * Creates `<projectRoot>/rozenite.dev.tsx` with a default-export placeholder,
 * unless a `rozenite.dev.*` file already exists — in which case it is left
 * byte-for-byte untouched and `status: 'skipped'` is returned. Never throws
 * because a dev entry already exists; that is the expected, idempotent case.
 */
export const scaffoldDevEntryFile = async (
  projectRoot: string,
): Promise<ScaffoldDevEntryResult> => {
  const existing = await findExistingDevEntryFile(projectRoot);

  if (existing) {
    return { status: 'skipped', filePath: existing };
  }

  const filePath = path.join(projectRoot, `${DEV_ENTRY_BASENAME}${DEV_ENTRY_DEFAULT_EXTENSION}`);
  await fs.writeFile(filePath, DEV_ENTRY_TEMPLATE, 'utf8');

  return { status: 'created', filePath };
};

export type MountTarget = 'react-native' | 'lynx';

const MOUNT_SNIPPETS: Record<MountTarget, string[]> = {
  'react-native': [
    "  import Rozenite from '@rozenite/react-native';",
    '',
    '  export default function App() {',
    '    return (',
    '      <>',
    '        <Rozenite />',
    '        {/* your app */}',
    '      </>',
    '    );',
    '  }',
  ],
  lynx: [
    "  import Rozenite from '@rozenite/lynx';",
    '',
    '  export function App() {',
    '    return (',
    '      <view>',
    '        <Rozenite />',
    '        {/* your app */}',
    '      </view>',
    '    );',
    '  }',
  ],
};

export const getMountInstructions = (target: MountTarget = 'react-native'): string => {
  return [
    'Add <Rozenite /> to your app root:',
    '',
    ...MOUNT_SNIPPETS[target],
    '',
    'Then wire your plugins up in rozenite.dev.tsx.',
  ].join('\n');
};
