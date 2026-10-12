import { describe, expect, it } from 'vitest';
import type { RozeniteConfig } from '../config.js';
import { toRozeniteConfig } from '../to-rozenite-config.js';

describe('toRozeniteConfig', () => {
  it('round-trips every user-settable RozeniteConfig field', () => {
    const full: Required<Omit<RozeniteConfig, 'projectRoot'>> = {
      include: ['a'],
      exclude: ['b'],
      destroyOnDetachPlugins: ['c'],
      projectType: 'expo',
      logLevel: 'debug',
      pluginDisplay: 'tabs',
      integration: 'lynx',
    };

    expect(toRozeniteConfig(full, { projectRoot: '/app' })).toEqual({
      ...full,
      projectRoot: '/app',
    });
  });

  it('drops keys the middleware does not read', () => {
    const result = toRozeniteConfig(
      {
        include: ['a'],
        enabled: true,
        enhanceMetroConfig: () => undefined,
        deviceSerial: 'abc',
      } as Partial<RozeniteConfig>,
      { projectRoot: '/app' },
    );

    expect(result).toEqual({ include: ['a'], projectRoot: '/app' });
  });

  it('omits undefined values', () => {
    const result = toRozeniteConfig(
      { include: undefined, logLevel: 'warn' },
      { projectRoot: '/app' },
    );

    expect(result).toEqual({ logLevel: 'warn', projectRoot: '/app' });
    expect('include' in result).toBe(false);
  });

  it('never lets a user option override projectRoot', () => {
    const result = toRozeniteConfig({ projectRoot: '/evil' }, { projectRoot: '/app' });

    expect(result.projectRoot).toBe('/app');
  });

  it('lets the bundler integration win, and keeps the user one otherwise', () => {
    expect(
      toRozeniteConfig({ integration: 'react-native' }, { projectRoot: '/a', integration: 'lynx' })
        .integration,
    ).toBe('lynx');
    expect(toRozeniteConfig({ integration: 'lynx' }, { projectRoot: '/a' }).integration).toBe(
      'lynx',
    );
  });

  it('works without options', () => {
    expect(toRozeniteConfig(undefined, { projectRoot: '/app' })).toEqual({
      projectRoot: '/app',
    });
  });
});
