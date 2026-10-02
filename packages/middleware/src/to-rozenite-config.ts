import type { RozeniteConfig } from './config.js';

/** The `RozeniteConfig` fields a user can set; the bundler always owns `projectRoot`. */
type UserRozeniteOptions = Omit<RozeniteConfig, 'projectRoot'>;

/**
 * Every user-settable `RozeniteConfig` field. `satisfies Record<keyof ...>`
 * makes this fail to compile when a field is added to or removed from
 * `RozeniteConfig` without updating the list.
 */
const USER_OPTION_KEYS = {
  include: true,
  exclude: true,
  destroyOnDetachPlugins: true,
  projectType: true,
  logLevel: true,
  pluginDisplay: true,
  integration: true,
} as const satisfies Record<keyof UserRozeniteOptions, true>;

const userOptionKeys = Object.keys(USER_OPTION_KEYS) as (keyof UserRozeniteOptions)[];

export type BundlerContext = {
  /** Always wins over any `projectRoot` found in the user options. */
  projectRoot: string;
  /** When set, wins over `options.integration` (e.g. Lynx). */
  integration?: RozeniteConfig['integration'];
};

/**
 * Builds the `RozeniteConfig` for `initializeRozenite` from the options a
 * bundler plugin received. Copies only the fields the middleware reads and
 * drops everything else (`enabled`, `enhanceMetroConfig`, `deviceSerial`, ...)
 * as well as `undefined` values.
 */
export const toRozeniteConfig = (
  options: Partial<RozeniteConfig> | undefined,
  { projectRoot, integration }: BundlerContext,
): RozeniteConfig => {
  const config: Record<string, unknown> = {};

  for (const key of userOptionKeys) {
    const value = options?.[key];
    if (value !== undefined) {
      config[key] = value;
    }
  }

  if (integration !== undefined) {
    config.integration = integration;
  }

  return { ...config, projectRoot } as RozeniteConfig;
};
