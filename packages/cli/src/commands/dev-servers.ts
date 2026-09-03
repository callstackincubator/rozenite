import {
  AGENT_TARGETS_ROUTE,
  DEFAULT_AGENT_PORT,
  type AgentResponseEnvelope,
  type GetAgentTargetsResponse,
  type MetroTarget,
} from '@rozenite/agent-shared';
import type { RozeniteHostIntegration } from '@rozenite/tools/integration';

/**
 * Rspeedy's default dev-server port, which is the port `@rozenite/lynx-dev`
 * ends up serving `/json/list` and `@rozenite/app` on. React Native's own
 * default is Metro's 8081 (`DEFAULT_AGENT_PORT`).
 */
export const DEFAULT_LYNX_PORT = 3000;

export const INTEGRATION_LABELS: Record<RozeniteHostIntegration, string> = {
  'react-native': 'React Native',
  lynx: 'Lynx',
};

export type DevServer = {
  port: number;
  /**
   * The integration this port serves, as a name to show a person.
   *
   * Only set for the default ports we scan on our own initiative, where
   * the port *is* the integration's documented default. A `--port` the
   * user chose says nothing about which integration listens on it — Metro
   * is perfectly happy on 3000 — so an explicit port carries no name
   * rather than a guessed (and possibly wrong) one. This is only ever used
   * to describe a server that could not be reached at all; a target that
   * *was* found is always labelled from its own `integration` field
   * (`@rozenite/agent-shared`'s `MetroTarget`), never from this guess.
   */
  integration?: string;
};

/**
 * The dev servers `rozenite open` scans when it is not told which port to
 * use. Both integrations can be running at once, so this is a list rather
 * than a choice, and its order is the order targets are offered in.
 */
export const DEFAULT_DEV_SERVERS: readonly DevServer[] = [
  { port: DEFAULT_AGENT_PORT, integration: INTEGRATION_LABELS['react-native'] },
  { port: DEFAULT_LYNX_PORT, integration: INTEGRATION_LABELS.lynx },
];

export const resolveDevServers = (port: number | undefined): DevServer[] =>
  port === undefined ? [...DEFAULT_DEV_SERVERS] : [{ port }];

/** A target plus the dev server it was found on, which is where it opens. */
export type OpenTarget = MetroTarget & Pick<DevServer, 'port'>;

export type DevServerFailure = {
  server: DevServer;
  message: string;
};

export type DevServerDiscovery = {
  targets: OpenTarget[];
  /**
   * The servers that could not be reached at all. Scanning defaults means
   * most projects always have one of these — nobody runs Metro and a Lynx
   * dev server at the same time — so a failure is only worth reporting
   * when nothing was found anywhere.
   */
  failures: DevServerFailure[];
};

const getErrorDetails = (error: unknown): string | null => {
  if (!error) {
    return null;
  }

  if (error instanceof AggregateError && error.errors.length > 0) {
    return error.errors
      .map((entry) => (entry instanceof Error ? entry.message : String(entry)))
      .join('; ');
  }

  return error instanceof Error ? error.message : String(error);
};

/**
 * Fetches `GET /rozenite/agent/targets` from one dev server. This is the
 * only way Rozenite code discovers targets (see
 * `docs/adr/0000-single-target-discovery-endpoint.md`): the CLI does not
 * parse `/json/list` itself, and does not fall back to it if the endpoint
 * is missing — the CLI and `@rozenite/middleware` are released in
 * lockstep, so a missing endpoint means a mismatched version, which
 * surfaces as this request's own failure.
 */
const fetchTargets = async (host: string, port: number): Promise<MetroTarget[]> => {
  const url = `http://${host}:${port}${AGENT_TARGETS_ROUTE}`;
  const unreachableMessage = (details: string | null): string =>
    `Unable to reach a dev server at ${url}. Make sure it is running and reachable, then try again.${
      details ? ` Details: ${details}` : ''
    }`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(unreachableMessage(getErrorDetails(error)));
  }

  let body: AgentResponseEnvelope<GetAgentTargetsResponse>;
  try {
    body = (await response.json()) as AgentResponseEnvelope<GetAgentTargetsResponse>;
  } catch (error) {
    throw new Error(unreachableMessage(getErrorDetails(error)));
  }

  if (!body.ok) {
    throw new Error(`${body.error.message} (${url})`);
  }

  if (!response.ok) {
    throw new Error(`Dev server at ${url} responded with status ${response.status}.`);
  }

  return body.result.targets;
};

/**
 * Asks every candidate dev server for its targets, at the same time, and
 * keeps whatever answers. Servers are queried concurrently because one of
 * them is usually not listening, and a connection refused on a port that
 * was never going to be used should not add to the wait.
 */
export const discoverTargets = async (
  host: string,
  servers: readonly DevServer[],
): Promise<DevServerDiscovery> => {
  const results = await Promise.all(
    servers.map(async (server): Promise<DevServerDiscovery> => {
      try {
        const targets = await fetchTargets(host, server.port);

        return {
          targets: targets.map((target) => ({
            ...target,
            port: server.port,
          })),
          failures: [],
        };
      } catch (error) {
        return {
          targets: [],
          failures: [
            {
              server,
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        };
      }
    }),
  );

  return {
    targets: results.flatMap((result) => result.targets),
    failures: results.flatMap((result) => result.failures),
  };
};

const describeServer = (host: string, server: DevServer): string => {
  const url = `http://${host}:${server.port}`;

  return server.integration ? `${url} (${server.integration})` : url;
};

/**
 * What to tell someone when the scan found nothing, which has two quite
 * different causes: a dev server answered but has no app connected to it,
 * or no dev server answered at all.
 */
export const formatNoTargetsMessage = (
  host: string,
  servers: readonly DevServer[],
  failures: readonly DevServerFailure[],
): string => {
  const locations = servers.map((server) => describeServer(host, server)).join(', ');

  if (failures.length < servers.length) {
    return `No connected device found at ${locations}. Open the Rozenite-enabled app on a device or simulator so it registers with the dev server, then try again.`;
  }

  const details = failures.map((failure) => failure.message).join(' ');

  return `Could not reach a dev server at ${locations}. Start your dev server, or pass --port if it listens on a different port. ${details}`;
};
