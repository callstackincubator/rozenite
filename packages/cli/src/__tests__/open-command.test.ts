import { afterEach, describe, expect, it, vi } from 'vitest';
import { AGENT_TARGETS_ROUTE, type AgentResponseEnvelope } from '@rozenite/agent-shared';
import type { OpenTarget } from '../commands/dev-servers.js';

const mocks = vi.hoisted(() => ({
  isInteractive: vi.fn(),
  promptSelect: vi.fn(),
  intro: vi.fn(),
  outro: vi.fn(),
  childProcessSpawn: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: mocks.childProcessSpawn,
}));

vi.mock('../utils/isInteractive.js', () => ({
  isInteractive: mocks.isInteractive,
}));

vi.mock('../utils/prompts.js', () => ({
  intro: mocks.intro,
  outro: mocks.outro,
  promptSelect: mocks.promptSelect,
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    success: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
    setVerbose: vi.fn(),
    isVerbose: vi.fn(() => false),
  },
}));

const { openCommand, selectTargetById, NON_INTERACTIVE_MESSAGE } =
  await import('../commands/open-command.js');
const { logger } = await import('../utils/logger.js');

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

/**
 * Stubs `fetch` for `GET .../rozenite/agent/targets`, keyed by port, so
 * tests can drive `discoverTargets` without a real dev server. A value of
 * `Error` simulates the port not answering at all (a rejected `fetch`);
 * an array is wrapped in a success envelope.
 */
const mockTargetsByPort = (targetsByPort: Record<number, OpenTarget[] | Error>): void => {
  globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    expect(url.pathname).toBe(AGENT_TARGETS_ROUTE);
    const port = Number(url.port);
    const result = targetsByPort[port] ?? [];

    if (result instanceof Error) {
      throw result;
    }

    const envelope: AgentResponseEnvelope<{ targets: OpenTarget[] }> = {
      ok: true,
      result: { targets: result },
    };
    return jsonResponse(envelope);
  }) as unknown as typeof fetch;
};

const targetA: OpenTarget = {
  id: 'device-a',
  deviceId: 'device-a',
  name: 'iPhone 15',
  appId: 'com.example.a',
  pageId: '1',
  title: 'A',
  description: '',
  webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-a&page=1',
  integration: 'react-native',
  port: 8081,
};

const targetB: OpenTarget = {
  id: 'device-b',
  deviceId: 'device-b',
  name: 'Pixel 8',
  appId: 'com.example.b',
  pageId: '1',
  title: 'B',
  description: '',
  webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-b&page=1',
  integration: 'react-native',
  port: 8081,
};

const lynxTarget: OpenTarget = {
  id: 'device-lynx-1',
  deviceId: 'device-lynx',
  name: 'iPhone',
  appId: 'LynxExplorer',
  pageId: 'device-lynx-1',
  title: 'http://localhost:3000/main.lynx.bundle?fullscreen=true',
  description: '',
  webSocketDebuggerUrl: 'ws://localhost:3000/inspector/debug?device=device-lynx&page=1',
  integration: 'lynx',
  port: 3000,
};

afterEach(() => {
  vi.clearAllMocks();
  process.exitCode = undefined;
});

describe('openCommand non-interactive refusal', () => {
  it('refuses and exits non-zero when the terminal is not interactive', async () => {
    mocks.isInteractive.mockReturnValue(false);
    mockTargetsByPort({});

    await openCommand({ host: '127.0.0.1', port: 8081 });

    expect(logger.error).toHaveBeenCalledWith(NON_INTERACTIVE_MESSAGE);
    expect(process.exitCode).toBe(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('still refuses when exactly one target would be unambiguous', async () => {
    mocks.isInteractive.mockReturnValue(false);
    mockTargetsByPort({ 8081: [targetA] });

    await openCommand({ host: '127.0.0.1', port: 8081 });

    expect(process.exitCode).toBe(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('still refuses when --deviceId is passed', async () => {
    mocks.isInteractive.mockReturnValue(false);
    mockTargetsByPort({ 8081: [targetA] });

    await openCommand({ host: '127.0.0.1', port: 8081, deviceId: 'device-a' });

    expect(process.exitCode).toBe(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('openCommand dev server discovery', () => {
  it('scans both default ports when no --port is given, labelling each by integration', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mockTargetsByPort({ 8081: [targetA], 3000: [lynxTarget] });
    mocks.promptSelect.mockImplementation(
      async ({ options }: { options: { value: OpenTarget }[] }) => options[1].value,
    );
    mocks.childProcessSpawn.mockReturnValue({ unref: vi.fn() });

    await openCommand({ host: '127.0.0.1' });

    expect(globalThis.fetch).toHaveBeenCalledWith('http://127.0.0.1:8081/rozenite/agent/targets');
    expect(globalThis.fetch).toHaveBeenCalledWith('http://127.0.0.1:3000/rozenite/agent/targets');
    expect(mocks.promptSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          expect.objectContaining({ label: 'React Native · iPhone 15 (com.example.a) — A' }),
          expect.objectContaining({ label: 'Lynx · iPhone (LynxExplorer) — main.lynx.bundle' }),
        ],
      }),
    );
  });

  it('opens the picked target on the port it was found on', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mockTargetsByPort({ 8081: [targetA], 3000: [lynxTarget] });
    mocks.childProcessSpawn.mockReturnValue({ unref: vi.fn() });

    await openCommand({ host: '127.0.0.1', deviceId: 'device-lynx-1' });

    expect(mocks.childProcessSpawn).toHaveBeenCalledWith(
      process.execPath,
      [expect.any(String), expect.stringContaining('http://127.0.0.1:3000/rozenite/app/')],
      expect.objectContaining({ detached: true }),
    );
  });

  // The common case: nobody runs Metro and a Lynx dev server at once, so
  // one of the two default ports always refuses the connection.
  it('ignores a default port that is not listening when the other one answers', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mockTargetsByPort({
      8081: new Error('connect ECONNREFUSED'),
      3000: [lynxTarget],
    });
    mocks.childProcessSpawn.mockReturnValue({ unref: vi.fn() });

    await openCommand({ host: '127.0.0.1', deviceId: 'device-lynx-1' });

    expect(logger.error).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it('reports every scanned port when none of them can be reached', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mockTargetsByPort({
      8081: new Error('connect ECONNREFUSED'),
      3000: new Error('connect ECONNREFUSED'),
    });

    await openCommand({ host: '127.0.0.1' });

    expect(process.exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Could not reach a dev server at http://127.0.0.1:8081 (React Native), http://127.0.0.1:3000 (Lynx)',
      ),
    );
  });

  it('reports the endpoint error message for a dev server that answers with a failure', async () => {
    mocks.isInteractive.mockReturnValue(true);
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: false,
        error: { message: 'No connected device is available.' },
      } satisfies AgentResponseEnvelope<never>),
    );

    await openCommand({ host: '127.0.0.1', port: 9000 });

    expect(process.exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('No connected device is available.'),
    );
  });

  it('falls back to the bare label when integration is not recognised (older middleware)', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mockTargetsByPort({
      8081: [{ ...targetA, integration: 'unknown-integration' as OpenTarget['integration'] }],
    });
    mocks.promptSelect.mockImplementation(
      async ({ options }: { options: { value: OpenTarget }[] }) => options[0].value,
    );
    mocks.childProcessSpawn.mockReturnValue({ unref: vi.fn() });

    await openCommand({ host: '127.0.0.1', port: 8081 });

    expect(mocks.promptSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [expect.objectContaining({ label: 'iPhone 15 (com.example.a) — A' })],
      }),
    );
  });

  it('reports the dev server error rather than "start your dev server" when it answered', async () => {
    mocks.isInteractive.mockReturnValue(true);
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: false,
        error: { message: 'No connected device is available.' },
      } satisfies AgentResponseEnvelope<never>),
    );

    await openCommand({ host: '127.0.0.1', port: 9000 });

    expect(logger.error).toHaveBeenCalledWith(expect.not.stringContaining('Start your dev server'));
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('No connected device is available.'),
    );
  });

  it('labels a target from its own integration field regardless of --port', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mockTargetsByPort({ 9000: [{ ...targetA, port: 9000 }] });
    mocks.promptSelect.mockImplementation(
      async ({ options }: { options: { value: OpenTarget }[] }) => options[0].value,
    );
    mocks.childProcessSpawn.mockReturnValue({ unref: vi.fn() });

    await openCommand({ host: '127.0.0.1', port: 9000 });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith('http://127.0.0.1:9000/rozenite/agent/targets');
    expect(mocks.promptSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          expect.objectContaining({ label: 'React Native · iPhone 15 (com.example.a) — A' }),
        ],
      }),
    );
  });
});

describe('openCommand target selection', () => {
  it('reports no targets and points at opening the app on a device', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mockTargetsByPort({ 8081: [] });

    await openCommand({ host: '127.0.0.1', port: 8081 });

    expect(process.exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No connected device'));
    expect(mocks.promptSelect).not.toHaveBeenCalled();
    expect(mocks.intro).toHaveBeenCalledTimes(1);
    expect(mocks.outro).toHaveBeenCalledTimes(1);
  });

  it('selects the target matching --deviceId and spawns Electron for it', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mockTargetsByPort({ 8081: [targetA, targetB] });
    mocks.childProcessSpawn.mockReturnValue({ unref: vi.fn() });

    await openCommand({ host: '127.0.0.1', port: 8081, deviceId: 'device-b' });

    expect(mocks.promptSelect).not.toHaveBeenCalled();
    expect(mocks.childProcessSpawn).toHaveBeenCalledWith(
      process.execPath,
      [expect.any(String), expect.stringContaining('appId=com.example.b')],
      expect.objectContaining({ detached: true }),
    );
    expect(process.exitCode).toBeUndefined();
  });

  it('fails gracefully, listing valid ids, for an unknown --deviceId', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mockTargetsByPort({ 8081: [targetA, targetB] });

    await expect(
      openCommand({ host: '127.0.0.1', port: 8081, deviceId: 'nope' }),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Unknown deviceId "nope". Valid device IDs: device-a, device-b',
    );
    expect(process.exitCode).toBe(1);
    expect(mocks.childProcessSpawn).not.toHaveBeenCalled();
    expect(mocks.intro).toHaveBeenCalledTimes(1);
    expect(mocks.outro).toHaveBeenCalledTimes(1);
  });

  it('prompts when there is no --deviceId', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mockTargetsByPort({ 8081: [targetA, targetB] });
    mocks.promptSelect.mockResolvedValue(targetA);
    mocks.childProcessSpawn.mockReturnValue({ unref: vi.fn() });

    await openCommand({ host: '127.0.0.1', port: 8081 });

    expect(mocks.promptSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          {
            value: { ...targetA, port: 8081 },
            label: 'React Native · iPhone 15 (com.example.a) — A',
          },
          {
            value: { ...targetB, port: 8081 },
            label: 'React Native · Pixel 8 (com.example.b) — B',
          },
        ],
      }),
    );
  });

  it('errors out when Electron cannot be launched, without any browser fallback', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mockTargetsByPort({ 8081: [targetA] });
    mocks.childProcessSpawn.mockImplementation(() => {
      throw new Error('spawn ENOENT');
    });

    await openCommand({ host: '127.0.0.1', port: 8081, deviceId: 'device-a' });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Could not launch the Rozenite standalone app'),
    );
    expect(process.exitCode).toBe(1);
    expect(logger.success).not.toHaveBeenCalled();
  });
});

describe('openCommand Electron opening (default)', () => {
  it('spawns the @rozenite/electron-app launcher', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mockTargetsByPort({ 8081: [targetA] });
    mocks.childProcessSpawn.mockReturnValue({ unref: vi.fn() });

    await openCommand({ host: '127.0.0.1', port: 8081, deviceId: 'device-a' });

    expect(mocks.childProcessSpawn).toHaveBeenCalledWith(
      process.execPath,
      [expect.stringContaining('launch.js'), expect.stringContaining('appId=com.example.a')],
      expect.objectContaining({ detached: true }),
    );
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('iPhone 15'));
    expect(process.exitCode).toBeUndefined();
  });
});

describe('selectTargetById', () => {
  // Two cards of one Lynx app: same device, one target each. This is the
  // shape that used to be unreachable, because a device collapsed to a
  // single target and the lowest page id always won.
  const cardOne: OpenTarget = {
    id: 'device-c-1',
    deviceId: 'device-c',
    name: 'iPhone',
    appId: 'LynxExplorer',
    pageId: 'device-c-1',
    title: '/Applications/LynxExplorer.app/Resource/homepage.lynx.bundle',
    description: '',
    webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-c&page=1',
    integration: 'lynx',
    port: 8081,
  };
  const cardTwo: OpenTarget = {
    ...cardOne,
    id: 'device-c-2',
    pageId: 'device-c-2',
    title: 'http://localhost:3000/main.lynx.bundle?fullscreen=true',
    webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-c&page=2',
  };

  it('returns the matching target', async () => {
    await expect(selectTargetById([targetA, targetB], 'device-b')).resolves.toBe(targetB);
  });

  it('resolves a device id that names exactly one target, without prompting', async () => {
    await expect(selectTargetById([targetA, targetB], 'device-a')).resolves.toBe(targetA);
    expect(mocks.promptSelect).not.toHaveBeenCalled();
  });

  it('accepts a target id that names one card of a multi-card device', async () => {
    await expect(selectTargetById([cardOne, cardTwo], 'device-c-2')).resolves.toBe(cardTwo);
    expect(mocks.promptSelect).not.toHaveBeenCalled();
  });

  it('asks which card when the id names a device hosting several', async () => {
    mocks.promptSelect.mockResolvedValue(cardTwo);

    await expect(selectTargetById([cardOne, cardTwo], 'device-c')).resolves.toBe(cardTwo);

    // Only that device's cards are offered, each labelled by its bundle so
    // the app's card is distinguishable from LynxExplorer's home screen.
    expect(mocks.promptSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          {
            value: cardOne,
            label: 'Lynx · iPhone (LynxExplorer) — homepage.lynx.bundle',
          },
          {
            value: cardTwo,
            label: 'Lynx · iPhone (LynxExplorer) — main.lynx.bundle',
          },
        ],
      }),
    );
  });

  it('throws listing valid ids when the id is unknown', async () => {
    await expect(selectTargetById([targetA, targetB], 'nope')).rejects.toThrow(
      'Unknown deviceId "nope". Valid device IDs: device-a, device-b',
    );
  });
});
