const STORAGE_KEY_PREFIX = '@rozenite/shell:welcome-dismissed:';

export function getWelcomeDismissalStorageKey(releaseId: string): string {
  return `${STORAGE_KEY_PREFIX}${releaseId}`;
}

export function shouldShowWelcomeDialog(
  runtimeVersion: string | undefined,
  releaseId: string,
  isDismissed: boolean,
): boolean {
  return runtimeVersion === releaseId && !isDismissed;
}

export function readWelcomeDismissal(releaseId: string): boolean {
  try {
    return localStorage.getItem(getWelcomeDismissalStorageKey(releaseId)) === '1';
  } catch {
    return false;
  }
}

export function writeWelcomeDismissal(releaseId: string): void {
  try {
    localStorage.setItem(getWelcomeDismissalStorageKey(releaseId), '1');
  } catch {
    // Storage may be unavailable. The dialog remains dismissed until unmount.
  }
}
