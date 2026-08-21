import { describe, expect, it } from 'vitest';
import { getFrameworkLabel } from './framework';

describe('getFrameworkLabel', () => {
  it('names each platform the standalone app can be launched for', () => {
    expect(getFrameworkLabel('react-native')).toBe('React Native');
    expect(getFrameworkLabel('lynx')).toBe('Lynx');
  });

  it('drops a platform this build does not know instead of showing it raw', () => {
    // `fetchConfig` doesn't validate the payload, so the served value is
    // whatever the dev server sent.
    expect(getFrameworkLabel('lynx-web' as never)).toBeNull();
  });

  it('drops a missing platform, as an older dev server would send', () => {
    expect(getFrameworkLabel(undefined)).toBeNull();
  });
});
