import { createAgentClient, type AgentSessionClient } from '@rozenite/agent-sdk';
import { createAgentTransport, type AgentTransport } from '@rozenite/agent-sdk/transport';
import { NETWORK_ACTIVITY_AGENT_PLUGIN_ID } from '@rozenite/network-activity-plugin/sdk';
import {
  ALL_SCENARIO_NAMES,
  NETWORK_SCENARIO_TOOL_NAME,
  type NetworkScenarioResult,
  type ScenarioName,
} from '../../src/app/utils/network-activity/e2e-scenario-contract';
import { DEFAULT_FIXTURE_PORT } from './fixture-server';
import {
  createNetworkObserver,
  withTimeout,
  type NetworkObserver,
  type ObserverMode,
} from './observers';

export const RUNBOOK = 'docs/agents/network-activity-e2e.md';

export type HarnessConfig = {
  metroHost: string;
  metroPort: number;
  fixturePort: number;
  /** Fixture origin as the device reaches it. */
  fixtureBaseUrl: string;
  deviceId?: string;
  observer: ObserverMode | 'auto';
  captureTimeoutMs: number;
  /** `Platform.OS` the baselines belong to; also the snapshot directory. */
  platform: string;
  /** Recording baselines (`e2e:network:record`) rather than comparing against them. */
  record: boolean;
};

const readInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return value !== undefined && value !== '' && Number.isInteger(parsed) && parsed > 0
    ? parsed
    : fallback;
};

export const readHarnessConfig = (env: NodeJS.ProcessEnv = process.env): HarnessConfig => {
  const fixturePort = readInteger(env.ROZENITE_FIXTURE_PORT, DEFAULT_FIXTURE_PORT);
  const observer = env.ROZENITE_E2E_OBSERVER ?? 'auto';
  if (observer !== 'auto' && observer !== 'tap' && observer !== 'agent-tools') {
    throw new Error(
      `ROZENITE_E2E_OBSERVER must be "auto", "tap" or "agent-tools", got "${observer}".`,
    );
  }

  return {
    metroHost: env.ROZENITE_METRO_HOST || '127.0.0.1',
    metroPort: readInteger(env.ROZENITE_METRO_PORT, 8081),
    fixturePort,
    fixtureBaseUrl: (env.ROZENITE_FIXTURE_BASE_URL || `http://localhost:${fixturePort}`).replace(
      /\/+$/,
      '',
    ),
    deviceId: env.ROZENITE_DEVICE_ID || undefined,
    observer,
    captureTimeoutMs: readInteger(env.ROZENITE_E2E_CAPTURE_TIMEOUT_MS, 10_000),
    platform: env.ROZENITE_E2E_PLATFORM || 'ios',
    record: env.ROZENITE_E2E_RECORD === '1' || env.ROZENITE_E2E_RECORD === 'true',
  };
};

/** A setup failure with the next step spelled out, instead of a hang or a stack trace. */
export class HarnessSetupError extends Error {
  constructor(problem: string, hint: string, cause?: unknown) {
    const details = cause instanceof Error ? `\n  Details: ${cause.message}` : '';
    super(`Network Activity e2e: ${problem}\n  ${hint}\n  See ${RUNBOOK}.${details}`);
    this.name = 'HarnessSetupError';
  }
}

const METRO_PROBE_TIMEOUT_MS = 5_000;
const SESSION_OPEN_TIMEOUT_MS = 60_000;
/** A freshly launched app registers its tools after the session reports ready. */
const TOOL_REGISTRATION_TIMEOUT_MS = 15_000;
const TOOL_POLL_INTERVAL_MS = 500;
const TAP_OPEN_TIMEOUT_MS = 5_000;
/** Covers the app-side ping timeout plus the round trip through Metro. */
const FIXTURE_PING_CALL_TIMEOUT_MS = 10_000;

const APP_TOOL = `app.${NETWORK_SCENARIO_TOOL_NAME}`;
const PLUGIN_TOOL = `${NETWORK_ACTIVITY_AGENT_PLUGIN_ID}.startRecording`;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const sameNames = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().every((name, index) => name === [...b].sort()[index]);

export type Harness = {
  config: HarnessConfig;
  session: AgentSessionClient;
  transport: AgentTransport;
  observer: NetworkObserver;
  runScenario: (scenario: ScenarioName) => Promise<NetworkScenarioResult>;
  close: () => Promise<void>;
};

const guard = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  problem: string,
  hint: string,
): Promise<T> => {
  try {
    return await withTimeout(promise, timeoutMs, `Timed out after ${timeoutMs} ms`);
  } catch (error) {
    throw new HarnessSetupError(problem, hint, error);
  }
};

/**
 * Connects to Metro, opens an agent session on the playground and checks
 * that everything the suite needs is there, failing fast with a pointer to
 * the runbook when it is not.
 */
export const openHarness = async (config: HarnessConfig): Promise<Harness> => {
  const endpoint = `http://${config.metroHost}:${config.metroPort}`;
  const transport = createAgentTransport({ host: config.metroHost, port: config.metroPort });
  const client = createAgentClient({ host: config.metroHost, port: config.metroPort });

  await guard(
    transport.getInfo(),
    METRO_PROBE_TIMEOUT_MS,
    `cannot reach Metro's Rozenite agent endpoint at ${endpoint}.`,
    'Start Metro with `pnpm start:playground` (or set ROZENITE_METRO_HOST / ROZENITE_METRO_PORT).',
  );

  const targets = await guard(
    client.targets.list(),
    METRO_PROBE_TIMEOUT_MS,
    `could not list debug targets from Metro at ${endpoint}.`,
    'Make sure Metro is the playground Metro with Rozenite enabled.',
  );

  if (targets.length === 0) {
    throw new HarnessSetupError(
      `Metro at ${endpoint} has no connected React Native app.`,
      'Launch the playground on a booted simulator or emulator and wait for it to load.',
    );
  }

  // Sessions are shared per target: if one already exists (a person's own
  // `rozenite agent` session, say) the harness reuses it and leaves it running.
  const existingSessions = await guard(
    transport.listSessions(),
    METRO_PROBE_TIMEOUT_MS,
    `could not list agent sessions from Metro at ${endpoint}.`,
    'Make sure Metro is the playground Metro with Rozenite enabled.',
  );
  const existingIds = new Set(existingSessions.sessions.map((session) => session.id));

  const session = await guard(
    client.openSession(config.deviceId ? { deviceId: config.deviceId } : {}),
    SESSION_OPEN_TIMEOUT_MS,
    'could not open an agent session on the playground.',
    new Set(targets.map((target) => target.deviceId)).size > 1
      ? `Several devices are connected; set ROZENITE_DEVICE_ID to one of: ${targets
          .map((target) => `${target.deviceId} (${target.name})`)
          .join(', ')}.`
      : 'Reload the playground and try again.',
  );
  const ownsSession = !existingIds.has(session.id);
  const releaseSession = async () => {
    if (ownsSession) {
      await session.stop().catch(() => undefined);
    }
  };

  const runScenario = async (scenario: ScenarioName) =>
    (await session.tools.call({
      domain: 'app',
      tool: NETWORK_SCENARIO_TOOL_NAME,
      args: { scenario, baseUrl: config.fixtureBaseUrl },
    })) as NetworkScenarioResult;

  try {
    await waitForTools(transport, session.id);

    const ping = await guard(
      runScenario('fixture-ping'),
      FIXTURE_PING_CALL_TIMEOUT_MS,
      `the app did not answer the fixture reachability check.`,
      'Reload the playground and try again.',
    );
    if (ping.platform !== undefined && ping.platform !== config.platform) {
      throw new HarnessSetupError(
        `the connected app runs on "${ping.platform}" but ROZENITE_E2E_PLATFORM is "${config.platform}".`,
        `Set ROZENITE_E2E_PLATFORM=${ping.platform} so the right baselines are used.`,
      );
    }
    if (ping.error || ping.status !== 200) {
      throw new HarnessSetupError(
        `the app cannot reach the fixture server at ${config.fixtureBaseUrl} (${
          ping.error ? `${ping.error.name}: ${ping.error.message}` : `status ${ping.status}`
        }).`,
        config.platform === 'android'
          ? `On an emulator set ROZENITE_FIXTURE_BASE_URL=http://10.0.2.2:${config.fixturePort}, or run \`adb reverse tcp:${config.fixturePort} tcp:${config.fixturePort}\`.`
          : 'Check that the simulator can reach the host and that nothing else holds the fixture port.',
      );
    }

    const observer = await guard(
      createNetworkObserver({
        transport,
        session,
        preferred: config.observer,
        timeouts: { captureMs: config.captureTimeoutMs, tapOpenMs: TAP_OPEN_TIMEOUT_MS },
        log: (message) => process.stdout.write(`${message}\n`),
      }),
      SESSION_OPEN_TIMEOUT_MS,
      'could not start observing the Network Activity plugin.',
      'Check that the playground mounts useNetworkActivityDevTools and that the session is connected.',
    );

    return {
      config,
      session,
      transport,
      observer,
      runScenario,
      close: async () => {
        await observer.close().catch(() => undefined);
        await releaseSession();
      },
    };
  } catch (error) {
    await releaseSession();
    throw error;
  }
};

/**
 * Waits until the app has registered both the scenario tool and the Network
 * Activity plugin's tools, and checks the scenario list the app knows
 * matches this suite's.
 */
const waitForTools = async (transport: AgentTransport, sessionId: string): Promise<void> => {
  const deadline = Date.now() + TOOL_REGISTRATION_TIMEOUT_MS;
  let names = new Set<string>();
  let appTool: { inputSchema?: unknown } | undefined;

  while (Date.now() < deadline) {
    const { tools } = await withTimeout(
      transport.getSessionTools(sessionId),
      METRO_PROBE_TIMEOUT_MS,
      'Timed out listing session tools',
    ).catch((error: unknown) => {
      throw new HarnessSetupError(
        'could not list the agent tools the playground registered.',
        'Reload the playground and try again.',
        error,
      );
    });
    names = new Set(tools.map((tool) => tool.name));
    appTool = tools.find((tool) => tool.name === APP_TOOL);
    if (appTool && names.has(PLUGIN_TOOL)) {
      break;
    }
    await sleep(TOOL_POLL_INTERVAL_MS);
  }

  if (!appTool) {
    throw new HarnessSetupError(
      `the playground does not register ${APP_TOOL} (waited ${TOOL_REGISTRATION_TIMEOUT_MS / 1000} s).`,
      'Rebuild or reload the playground so it runs the current sources (see src/app/useNetworkScenarioAgentTool.ts).',
    );
  }

  if (!names.has(PLUGIN_TOOL)) {
    throw new HarnessSetupError(
      `the playground does not register the Network Activity plugin's agent tools (waited ${TOOL_REGISTRATION_TIMEOUT_MS / 1000} s).`,
      'Check that the playground mounts useNetworkActivityDevTools and that @rozenite/network-activity-plugin is built.',
    );
  }

  const schema = appTool.inputSchema as
    | { properties?: { scenario?: { enum?: unknown } } }
    | undefined;
  const known = schema?.properties?.scenario?.enum;
  if (!Array.isArray(known) || !sameNames(known.map(String), ALL_SCENARIO_NAMES)) {
    throw new HarnessSetupError(
      `the playground's ${APP_TOOL} knows a different scenario list than this suite.`,
      'Reload the playground so it runs the current sources.',
    );
  }
};
