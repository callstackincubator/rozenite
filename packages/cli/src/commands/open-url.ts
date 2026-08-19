import type { MetroTarget } from '@rozenite/agent-shared';

/**
 * Builds the launch URL for `@rozenite/app`, served by Metro at
 * `/rozenite/app/`. The `ws` query parameter is the path + query of the
 * target's `webSocketDebuggerUrl` (its host/port are Metro's own, not the
 * app's), URL-encoded. Mirrors the equivalent `rn_fusebox.html` URL shape
 * documented in `docs/agents/e2e-testing.md`.
 */
export const buildAppOpenUrl = (host: string, port: number, target: MetroTarget): string => {
  const debuggerUrl = new URL(target.webSocketDebuggerUrl);
  const wsPathAndQuery = `${debuggerUrl.pathname}${debuggerUrl.search}`;

  const params = `ws=${encodeURIComponent(wsPathAndQuery)}&appId=${encodeURIComponent(target.appId)}`;

  return `http://${host}:${port}/rozenite/app/?${params}`;
};
