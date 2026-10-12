/**
 * The implicit session (ADR 0005, decision 3). Every agent command that
 * needs a session resolves one in this order:
 *
 * 1. `--session <id>`;
 * 2. the session for `--device <id>` (or the undocumented `--deviceId`),
 *    created or reused by the server;
 * 3. `ROZENITE_SESSION`;
 * 4. the session for `ROZENITE_DEVICE`, created or reused;
 * 5. the session for the only connected device, created or reused;
 * 6. otherwise an error that lists the targets to choose from.
 *
 * The environment variables are defaults for the flags, so a flag the user
 * typed always beats either of them.
 *
 * Steps 2, 4 and 5 are one `POST /rozenite/agent/sessions`, the request
 * `session create` makes: the server already creates a session or hands back
 * the running one for a device.
 */
import type { AgentSessionInfo, MetroTarget } from '@rozenite/agent-shared';
import type { AgentTransport } from '@rozenite/agent-sdk/transport';
import { getPackageJSON } from '../../package-json.js';

export const SESSION_ENV = 'ROZENITE_SESSION';
export const DEVICE_ENV = 'ROZENITE_DEVICE';

export type SessionSelection = {
  session?: string;
  device?: string;
  deviceId?: string;
};

type Env = Record<string, string | undefined>;

const nonEmpty = (value: string | undefined): string | undefined =>
  value !== undefined && value.trim().length > 0 ? value.trim() : undefined;

/** `--device`, then the undocumented `--deviceId`, then `ROZENITE_DEVICE`. */
export const getRequestedDevice = (
  selection: SessionSelection,
  env: Env = process.env,
): string | undefined =>
  nonEmpty(selection.device) ?? nonEmpty(selection.deviceId) ?? nonEmpty(env[DEVICE_ENV]);

/** What a command runs against: a session id, or the device to resolve one for. */
export type SessionTarget = { session: string } | { device: string | undefined };

/**
 * Applies the precedence above without contacting the server:
 * `--session` → `--device`/`--deviceId` → `ROZENITE_SESSION` →
 * `ROZENITE_DEVICE` → the only connected device (`device: undefined`).
 */
export const selectSessionTarget = (
  selection: SessionSelection,
  env: Env = process.env,
): SessionTarget => {
  const session = nonEmpty(selection.session);
  if (session) {
    return { session };
  }
  const device = nonEmpty(selection.device) ?? nonEmpty(selection.deviceId);
  if (device) {
    return { device };
  }
  const envSession = nonEmpty(env[SESSION_ENV]);
  if (envSession) {
    return { session: envSession };
  }
  return { device: nonEmpty(env[DEVICE_ENV]) };
};

/** The server's answer when no device was named and more than one is connected. */
const isMultipleDevicesError = (error: unknown): boolean =>
  error instanceof Error && /multiple connected devices/i.test(error.message);

export const formatTargetChoice = (targets: readonly MetroTarget[]): string =>
  targets.map((target) => `${target.id} (${target.name}, ${target.integration})`).join('; ');

const createMultipleTargetsError = (targets: readonly MetroTarget[]): Error =>
  new Error(
    `More than one device is connected. Pass --device <id> or set ${DEVICE_ENV}. Targets: ${formatTargetChoice(targets)}.`,
  );

/**
 * Asks the server for the session of `device`, or of the only connected
 * device. When the server cannot pick one, the error names the targets.
 */
export const createOrReuseSession = async (
  transport: Pick<AgentTransport, 'createSession' | 'listTargets'>,
  device: string | undefined,
): Promise<{ session: AgentSessionInfo; created?: boolean; versionCheck?: string }> => {
  try {
    return await transport.createSession({
      deviceId: device,
      cliVersion: getPackageJSON().version,
    });
  } catch (error) {
    if (device === undefined && isMultipleDevicesError(error)) {
      const { targets } = await transport.listTargets();
      throw createMultipleTargetsError(targets);
    }
    throw error;
  }
};

/**
 * How long a freshly created session is given to collect the device's
 * tools before the command runs. The server reports a session connected as
 * soon as the debugger handshake completes; plugins and the app register
 * their tools a moment later, so the first command on a brand-new session
 * used to see only the built-in domains. Polling stops once `toolCount`
 * has not changed across `SETTLE_STABLE_READS` consecutive reads.
 */
export const SETTLE_INTERVAL_MS = 200;
export const SETTLE_STABLE_READS = 3;
export const SETTLE_MAX_WAIT_MS = 3000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const waitForToolsToSettle = async (
  transport: Pick<AgentTransport, 'getSession'>,
  sessionId: string,
  initialToolCount: number,
  options: { intervalMs?: number; stableReads?: number; maxWaitMs?: number } = {},
): Promise<void> => {
  const intervalMs = options.intervalMs ?? SETTLE_INTERVAL_MS;
  const stableReads = options.stableReads ?? SETTLE_STABLE_READS;
  const maxWaitMs = options.maxWaitMs ?? SETTLE_MAX_WAIT_MS;
  const startedAt = Date.now();
  let lastCount = initialToolCount;
  let stable = 1;

  while (stable < stableReads && Date.now() - startedAt < maxWaitMs) {
    await sleep(intervalMs);
    let count: number;
    try {
      count = (await transport.getSession(sessionId)).session.toolCount;
    } catch {
      // A read that fails here is the command's problem to report, not ours.
      return;
    }
    stable = count === lastCount ? stable + 1 : 1;
    lastCount = count;
  }
};

export type ResolvedSession = {
  sessionId: string;
  /** Present when the session was resolved for a device, not given as an id. */
  info?: AgentSessionInfo;
};

/**
 * Resolves the session an agent command runs against. The first time a
 * session is created implicitly, one line on stderr names the device and how
 * to stop the session, since an open session holds the device's only
 * debugger connection.
 */
export const resolveAgentSession = async (
  transport: Pick<AgentTransport, 'createSession' | 'listTargets' | 'getSession'>,
  selection: SessionSelection,
  env: Env = process.env,
  settle: Parameters<typeof waitForToolsToSettle>[3] = {},
): Promise<ResolvedSession> => {
  const target = selectSessionTarget(selection, env);
  if ('session' in target) {
    return { sessionId: target.session };
  }

  const { device } = target;
  const { session, created, versionCheck } = await createOrReuseSession(transport, device);

  if (versionCheck) {
    process.stderr.write(`${versionCheck}\n`);
  }
  // Only a server that says it created the session gets the notice; an
  // older server does not send `created`, and a guess would be wrong.
  if (created === true) {
    process.stderr.write(
      `Started an agent session on ${session.deviceName || session.deviceId || 'the device'}. Stop it when done: npx rozenite agent session stop${
        device ? ` --device ${device}` : ''
      }\n`,
    );
  }

  if (created === true) {
    await waitForToolsToSettle(transport, session.id, session.toolCount, settle);
  }

  return { sessionId: session.id, info: session };
};

const sessionMatchesDevice = (session: AgentSessionInfo, device: string): boolean =>
  session.id === device ||
  session.deviceId === device ||
  // A session's `deviceId` is the target id, `<device>-<page>`.
  session.deviceId.startsWith(`${device}-`);

/**
 * `session stop` with no id: the session the other commands would resolve,
 * found without creating one.
 */
export const findSessionToStop = async (
  transport: Pick<AgentTransport, 'listSessions'>,
  selection: SessionSelection,
  env: Env = process.env,
): Promise<string> => {
  const target = selectSessionTarget(selection, env);
  if ('session' in target) {
    return target.session;
  }

  const { device } = target;
  const running = (await transport.listSessions()).sessions.filter(
    (session) => session.status !== 'stopped',
  );
  const candidates = device
    ? running.filter((session) => sessionMatchesDevice(session, device))
    : running;

  if (candidates.length === 1) {
    return candidates[0]!.id;
  }

  if (candidates.length === 0) {
    throw new Error(
      device ? `No running agent session for device "${device}".` : 'No agent session is running.',
    );
  }

  throw new Error(
    `More than one agent session is running. Pass a session id or --device <id>. Sessions: ${candidates
      .map((session) => `${session.id} (${session.deviceName})`)
      .join('; ')}.`,
  );
};
