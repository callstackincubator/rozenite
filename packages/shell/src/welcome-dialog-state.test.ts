import { describe, expect, it } from 'vitest';
import { WELCOME_DISMISSAL_STORAGE_KEY, shouldShowWelcomeDialog } from './welcome-dialog-state';

describe('shouldShowWelcomeDialog', () => {
  it('shows an unseen welcome dialog for a runtime version', () => {
    expect(shouldShowWelcomeDialog('1.13.0', null)).toBe(true);
  });

  it('does not show a dismissed version or a missing runtime version', () => {
    expect(shouldShowWelcomeDialog('1.13.0', '1.13.0')).toBe(false);
    expect(shouldShowWelcomeDialog(undefined, null)).toBe(false);
  });
});

describe('WELCOME_DISMISSAL_STORAGE_KEY', () => {
  it('uses one stable storage key', () => {
    expect(WELCOME_DISMISSAL_STORAGE_KEY).toBe('@rozenite/shell:welcome-dismissed-version');
  });
});
