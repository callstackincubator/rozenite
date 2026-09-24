import { createAgentClient, type AgentSessionClient } from '@rozenite/agent-sdk';
import { createAgentTransport, type AgentTransport } from '@rozenite/agent-sdk/transport';
import {
  NETWORK_SCENARIO_TOOL_NAME,
  type NetworkScenarioName,
  type NetworkScenarioResult,
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
const TOOL_LOOKUP_TIMEOUT_MS = 15_000;
const TAP_OPEN_TIMEOUT_MS = 5_000;

export type Harness = {
  config: HarnessConfig;
  session: AgentSessionClient;
  transport: AgentTransport;
  observer: NetworkObserver;
  runScenario: (scenario: NetworkScenarioName) => Promise<NetworkScenarioResult>;
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

  try {
    const appTools = await guard(
      session.tools.list({ domain: 'app' }),
      TOOL_LOOKUP_TIMEOUT_MS,
      `the playground does not expose any in-app agent tools.`,
      'Rebuild or reload the playground so it registers app.run-network-scenario.',
    );
    if (!appTools.some((tool) => tool.shortName === NETWORK_SCENARIO_TOOL_NAME)) {
      throw new HarnessSetupError(
        `the playground does not register app.${NETWORK_SCENARIO_TOOL_NAME}.`,
        'Reload the playground so it runs the current sources (see src/app/useNetworkScenarioAgentTool.ts).',
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
      runScenario: async (scenario) =>
        (await session.tools.call({
          domain: 'app',
          tool: NETWORK_SCENARIO_TOOL_NAME,
          args: { scenario, baseUrl: config.fixtureBaseUrl },
        })) as NetworkScenarioResult,
      close: async () => {
        await observer.close().catch(() => undefined);
        await session.stop().catch(() => undefined);
      },
    };
  } catch (error) {
    await session.stop().catch(() => undefined);
    throw error;
  }
};
