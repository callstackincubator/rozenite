import {
  Broadcast,
  Cube,
  Database,
  Faders,
  Flame,
  FolderOpen,
  Gauge,
  HardDrives,
  GridFour,
  MagnifyingGlass,
  Signpost,
  Stack,
  Table,
  Textbox,
  type Icon,
} from '@phosphor-icons/react';

export type OfficialPlugin = {
  name: string;
  packageName: string;
  /** What the panel puts in front of you. One line, under fifteen words. */
  exposes: string;
  icon: Icon;
  href: string;
  /** Also registers tools for Rozenite for Agents. */
  agentEnabled: boolean;
};

/**
 * The plugins maintained in this repository, ordered by how often a team
 * reaches for them rather than alphabetically.
 */
export const OFFICIAL_PLUGINS: OfficialPlugin[] = [
  {
    name: 'Network Activity',
    packageName: '@rozenite/network-activity-plugin',
    exposes:
      'Requests, headers, payloads and timings, including Expo fetch and nitro-fetch traffic.',
    icon: Broadcast,
    href: '/docs/official-plugins/network-activity',
    agentEnabled: true,
  },
  {
    name: 'Performance Monitor',
    packageName: '@rozenite/performance-monitor-plugin',
    exposes: 'Live marks, measures and metrics per session, exportable for offline analysis.',
    icon: Gauge,
    href: '/docs/official-plugins/performance-monitor',
    agentEnabled: false,
  },
  {
    name: 'Redux DevTools',
    packageName: '@rozenite/redux-devtools-plugin',
    exposes: 'Store state, dispatched actions and a diff for each one.',
    icon: Cube,
    href: '/docs/official-plugins/redux-devtools',
    agentEnabled: true,
  },
  {
    name: 'TanStack Query',
    packageName: '@rozenite/tanstack-query-plugin',
    exposes: 'Queries, mutations and cache entries, with refetch, invalidate and reset.',
    icon: MagnifyingGlass,
    href: '/docs/official-plugins/tanstack-query',
    agentEnabled: true,
  },
  {
    name: 'React Navigation',
    packageName: '@rozenite/react-navigation-plugin',
    exposes: 'Action timeline with dispatch origins, time travel and deep link testing.',
    icon: Signpost,
    href: '/docs/official-plugins/react-navigation',
    agentEnabled: true,
  },
  {
    name: 'Storage',
    packageName: '@rozenite/storage-plugin',
    exposes: 'MMKV, AsyncStorage and SecureStore in one panel, with per-key blacklists.',
    icon: Database,
    href: '/docs/official-plugins/storage',
    agentEnabled: true,
  },
  {
    name: 'MMKV',
    packageName: '@rozenite/mmkv-plugin',
    exposes: 'Every instance and key, typed and searchable, editable without a rebuild.',
    icon: HardDrives,
    href: '/docs/official-plugins/mmkv',
    agentEnabled: true,
  },
  {
    name: 'SQLite',
    packageName: '@rozenite/sqlite-plugin',
    exposes: 'Query-first inspector that derives tables and schema through SQL and PRAGMA.',
    icon: Table,
    href: '/docs/official-plugins/sqlite',
    agentEnabled: false,
  },
  {
    name: 'File System',
    packageName: '@rozenite/file-system-plugin',
    exposes: 'App directories with inline text and image previews, hex for binaries.',
    icon: FolderOpen,
    href: '/docs/official-plugins/file-system',
    agentEnabled: true,
  },
  {
    name: 'Controls',
    packageName: '@rozenite/controls-plugin',
    exposes: 'App-defined toggles, selects and actions, kept out of your product UI.',
    icon: Faders,
    href: '/docs/official-plugins/controls',
    agentEnabled: true,
  },
  {
    name: 'Expo Atlas',
    packageName: '@rozenite/expo-atlas-plugin',
    exposes: 'Metro bundle structure, per-module size and the dependency graph behind it.',
    icon: Stack,
    href: '/docs/official-plugins/expo-atlas',
    agentEnabled: false,
  },
  {
    name: 'Require Profiler',
    packageName: '@rozenite/require-profiler-plugin',
    exposes: 'Flame graph of startup require() calls and what pushes out interactive.',
    icon: Flame,
    href: '/docs/official-plugins/require-profiler',
    agentEnabled: false,
  },
  {
    name: 'React Hook Form',
    packageName: '@rozenite/rhf-plugin',
    exposes: 'Values, errors, dirty and touched state for every form currently mounted.',
    icon: Textbox,
    href: '/docs/official-plugins/react-hook-form',
    agentEnabled: false,
  },
  {
    name: 'Overlay',
    packageName: '@rozenite/overlay-plugin',
    exposes: 'Grids and reference images over the running app, with a compare slider.',
    icon: GridFour,
    href: '/docs/official-plugins/overlay',
    agentEnabled: false,
  },
];

/**
 * The six shown on the landing page. The list above is ordered by reach, so the
 * cut is a slice: keep it that way and the grid stays a clean two rows.
 */
export const FEATURED_PLUGINS = OFFICIAL_PLUGINS.slice(0, 6);

export const REMAINING_PLUGIN_COUNT = OFFICIAL_PLUGINS.length - FEATURED_PLUGINS.length;
