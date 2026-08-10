const DEBUG_STORAGE_KEY = 'rozenite.debug';

/** Whether shell's debug affordances are available. Always on when running
 *  from source; otherwise opt in from the shell frame's console with
 *  `localStorage.setItem('rozenite.debug', '1')` so a released build can be
 *  driven into states that would otherwise need a real npm release. */
export function isDebugEnabled(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }

  try {
    return localStorage.getItem(DEBUG_STORAGE_KEY) === '1';
  } catch {
    // Storage can be unavailable in a sandboxed frame. Debug is off, which
    // is the same as the default.
    return false;
  }
}
