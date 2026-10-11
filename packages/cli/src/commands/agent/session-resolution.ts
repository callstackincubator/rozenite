/**
 * The implicit session (ADR 0005, decision 3). Every agent command that
 * needs a session resolves one in this order:
 *
 * 1. `--session <id>`;
 * 2. `ROZENITE_SESSION`;
 * 3. the session for `--device <id>` (or `--deviceId`, or `ROZENITE_DEVICE`),
 *    created or reused by the server;
 * 4. the session for the only connected device, created or reused;
 * 5. otherwise an error that lists the targets to choose from.
 *
 * Steps 3 and 4 are one `POST /rozenite/agent/sessions`, the request
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

/** `--session`, then `ROZENITE_SESSION`. */
export const getExplicitSession = (
  selection: SessionSelection,
  env: Env = process.env,
): string | undefined => nonEmpty(selection.session) ?? nonEmpty(env[SESSION_ENV]);

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
): Promise<{ session: AgentSessionInfo; versionCheck?: string }> => {
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

export type ResolvedSession = {
  sessionId: string;
  /** Present when the session came from steps 3–4, not from an explicit id. */
  info?: AgentSessionInfo;
};

/**
 * Resolves the session an agent command runs against. The first time a
 * session is created implicitly, one line on stderr names the device and how
 * to stop the session, since an open session holds the device's only
 * debugger connection.
 */
export const resolveAgentSession = async (
  transport: Pick<AgentTransport, 'createSession' | 'listTargets'>,
  selection: SessionSelection,
  env: Env = process.env,
): Promise<ResolvedSession> => {
  const explicit = getExplicitSession(selection, env);
  if (explicit) {
    return { sessionId: explicit };
  }

  const device = getRequestedDevice(selection, env);
  const requestedAt = Date.now();
  const { session, versionCheck } = await createOrReuseSession(transport, device);

  if (versionCheck) {
    process.stderr.write(`${versionCheck}\n`);
  }
  // The server reports when a session was created, not whether this request
  // created it; a session younger than the request is one it just made.
  if (typeof session.createdAt === 'number' && session.createdAt >= requestedAt) {
    process.stderr.write(
      `Started an agent session on ${session.deviceName || session.deviceId || 'the device'}. Stop it when done: npx rozenite agent session stop${
        device ? ` --device ${device}` : ''
      }\n`,
    );
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
  const explicit = getExplicitSession(selection, env);
  if (explicit) {
    return explicit;
  }

  const device = getRequestedDevice(selection, env);
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
