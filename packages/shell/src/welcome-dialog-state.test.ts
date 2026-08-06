import { describe, expect, it } from 'vitest';
import {
  getWelcomeDismissalStorageKey,
  shouldShowWelcomeDialog,
} from './welcome-dialog-state';

describe('shouldShowWelcomeDialog', () => {
  it('shows an unseen welcome dialog for its matching runtime version', () => {
    expect(shouldShowWelcomeDialog('1.13.0', '1.13.0', false)).toBe(true);
  });

  it('does not show a dismissed or non-matching release', () => {
    expect(shouldShowWelcomeDialog('1.13.0', '1.13.0', true)).toBe(false);
    expect(shouldShowWelcomeDialog('1.14.0', '1.13.0', false)).toBe(false);
  });
});

describe('getWelcomeDismissalStorageKey', () => {
  it('scopes dismissal state to one release', () => {
    expect(getWelcomeDismissalStorageKey('1.13.0')).toBe(
      '@rozenite/shell:welcome-dismissed:1.13.0',
    );
  });
});
