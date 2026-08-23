import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MetroTarget } from '@rozenite/agent-shared';

const mocks = vi.hoisted(() => ({
  isInteractive: vi.fn(),
  getMetroTargets: vi.fn(),
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

vi.mock('../commands/metro-discovery.js', () => ({
  getMetroTargets: mocks.getMetroTargets,
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

const targetA: MetroTarget = {
  id: 'device-a',
  deviceId: 'device-a',
  name: 'iPhone 15',
  appId: 'com.example.a',
  pageId: '1',
  title: 'A',
  description: '',
  webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-a&page=1',
};

const targetB: MetroTarget = {
  id: 'device-b',
  deviceId: 'device-b',
  name: 'Pixel 8',
  appId: 'com.example.b',
  pageId: '1',
  title: 'B',
  description: '',
  webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-b&page=1',
};

afterEach(() => {
  vi.clearAllMocks();
  process.exitCode = undefined;
});

describe('openCommand non-interactive refusal', () => {
  it('refuses and exits non-zero when the terminal is not interactive', async () => {
    mocks.isInteractive.mockReturnValue(false);

    await openCommand({ host: '127.0.0.1', port: 8081 });

    expect(logger.error).toHaveBeenCalledWith(NON_INTERACTIVE_MESSAGE);
    expect(process.exitCode).toBe(1);
    expect(mocks.getMetroTargets).not.toHaveBeenCalled();
  });

  it('still refuses when exactly one target would be unambiguous', async () => {
    mocks.isInteractive.mockReturnValue(false);
    mocks.getMetroTargets.mockResolvedValue([targetA]);

    await openCommand({ host: '127.0.0.1', port: 8081 });

    expect(process.exitCode).toBe(1);
    expect(mocks.getMetroTargets).not.toHaveBeenCalled();
  });

  it('still refuses when --deviceId is passed', async () => {
    mocks.isInteractive.mockReturnValue(false);
    mocks.getMetroTargets.mockResolvedValue([targetA]);

    await openCommand({ host: '127.0.0.1', port: 8081, deviceId: 'device-a' });

    expect(process.exitCode).toBe(1);
    expect(mocks.getMetroTargets).not.toHaveBeenCalled();
  });
});

describe('openCommand target selection', () => {
  it('reports no targets and points at opening the app on a device', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mocks.getMetroTargets.mockResolvedValue([]);

    await openCommand({ host: '127.0.0.1', port: 8081 });

    expect(process.exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No connected device'));
    expect(mocks.promptSelect).not.toHaveBeenCalled();
    expect(mocks.intro).toHaveBeenCalledTimes(1);
    expect(mocks.outro).toHaveBeenCalledTimes(1);
  });

  it('selects the target matching --deviceId and spawns Electron for it', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mocks.getMetroTargets.mockResolvedValue([targetA, targetB]);
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
    mocks.getMetroTargets.mockResolvedValue([targetA, targetB]);

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
    mocks.getMetroTargets.mockResolvedValue([targetA, targetB]);
    mocks.promptSelect.mockResolvedValue(targetA);
    mocks.childProcessSpawn.mockReturnValue({ unref: vi.fn() });

    await openCommand({ host: '127.0.0.1', port: 8081 });

    expect(mocks.promptSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          { value: targetA, label: 'iPhone 15 (com.example.a) — A' },
          { value: targetB, label: 'Pixel 8 (com.example.b) — B' },
        ],
      }),
    );
  });

  it('errors out when Electron cannot be launched, without any browser fallback', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mocks.getMetroTargets.mockResolvedValue([targetA]);
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
    mocks.getMetroTargets.mockResolvedValue([targetA]);
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
  const cardOne: MetroTarget = {
    id: 'device-c-1',
    deviceId: 'device-c',
    name: 'iPhone',
    appId: 'LynxExplorer',
    pageId: 'device-c-1',
    title: '/Applications/LynxExplorer.app/Resource/homepage.lynx.bundle',
    description: '',
    webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-c&page=1',
  };
  const cardTwo: MetroTarget = {
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
          { value: cardOne, label: 'iPhone (LynxExplorer) — homepage.lynx.bundle' },
          { value: cardTwo, label: 'iPhone (LynxExplorer) — main.lynx.bundle' },
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
