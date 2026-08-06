export const WELCOME_DISMISSAL_STORAGE_KEY =
  '@rozenite/shell:welcome-dismissed-version';

export function shouldShowWelcomeDialog(
  runtimeVersion: string | undefined,
  dismissedVersion: string | null,
): boolean {
  return runtimeVersion !== undefined && runtimeVersion !== dismissedVersion;
}

export function readWelcomeDismissal(): string | null {
  try {
    return localStorage.getItem(WELCOME_DISMISSAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeWelcomeDismissal(runtimeVersion: string): void {
  try {
    localStorage.setItem(WELCOME_DISMISSAL_STORAGE_KEY, runtimeVersion);
  } catch {
    // Storage may be unavailable. The dialog remains dismissed until unmount.
  }
}
