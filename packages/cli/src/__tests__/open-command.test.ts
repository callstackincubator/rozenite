import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MetroTarget } from '@rozenite/agent-shared';

const mocks = vi.hoisted(() => ({
  isInteractive: vi.fn(),
  getMetroTargets: vi.fn(),
  promptSelect: vi.fn(),
  spawn: vi.fn(),
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

vi.mock('../utils/spawn.js', () => ({
  spawn: mocks.spawn,
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

const {
  openCommand,
  selectTargetById,
  getBrowserOpenerCommand,
  getBrowserOpenerArgs,
  NON_INTERACTIVE_MESSAGE,
} = await import('../commands/open-command.js');
const { logger } = await import('../utils/logger.js');

const targetA: MetroTarget = {
  id: 'device-a',
  name: 'iPhone 15',
  appId: 'com.example.a',
  pageId: '1',
  title: 'A',
  description: '',
  webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-a&page=1',
};

const targetB: MetroTarget = {
  id: 'device-b',
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

  it('selects the target matching --deviceId and falls back to the browser when Electron is unavailable', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mocks.getMetroTargets.mockResolvedValue([targetA, targetB]);
    mocks.childProcessSpawn.mockImplementation(() => {
      throw new Error('spawn ENOENT');
    });
    mocks.spawn.mockResolvedValue(undefined);

    await openCommand({ host: '127.0.0.1', port: 8081, deviceId: 'device-b' });

    expect(mocks.promptSelect).not.toHaveBeenCalled();
    expect(mocks.spawn).toHaveBeenCalledWith(
      expect.any(String),
      [expect.stringContaining('appId=com.example.b')],
      expect.any(Object),
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
    expect(mocks.spawn).not.toHaveBeenCalled();
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
          { value: targetA, label: 'iPhone 15 (com.example.a)' },
          { value: targetB, label: 'Pixel 8 (com.example.b)' },
        ],
      }),
    );
  });

  it('prints the URL when neither Electron nor the browser can be opened', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mocks.getMetroTargets.mockResolvedValue([targetA]);
    mocks.childProcessSpawn.mockImplementation(() => {
      throw new Error('spawn ENOENT');
    });
    mocks.spawn.mockRejectedValue(new Error('spawn ENOENT'));

    await openCommand({ host: '127.0.0.1', port: 8081, deviceId: 'device-a' });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not open Electron or a browser'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('http://127.0.0.1:8081/rozenite/app/'),
    );
  });
});

describe('openCommand Electron opening (default)', () => {
  it('spawns the @rozenite/electron-app launcher and never falls back to the browser opener', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mocks.getMetroTargets.mockResolvedValue([targetA]);
    mocks.childProcessSpawn.mockReturnValue({ unref: vi.fn() });

    await openCommand({ host: '127.0.0.1', port: 8081, deviceId: 'device-a' });

    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.childProcessSpawn).toHaveBeenCalledWith(
      process.execPath,
      [expect.stringContaining('launch.js'), expect.stringContaining('appId=com.example.a')],
      expect.objectContaining({ detached: true }),
    );
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('iPhone 15'));
    expect(process.exitCode).toBeUndefined();
  });

  it('falls back to the browser opener when @rozenite/electron-app cannot be resolved or spawned', async () => {
    mocks.isInteractive.mockReturnValue(true);
    mocks.getMetroTargets.mockResolvedValue([targetA]);
    mocks.childProcessSpawn.mockImplementation(() => {
      throw new Error('spawn ENOENT');
    });
    mocks.spawn.mockResolvedValue(undefined);

    await openCommand({ host: '127.0.0.1', port: 8081, deviceId: 'device-a' });

    expect(mocks.spawn).toHaveBeenCalledWith(
      expect.any(String),
      [expect.stringContaining('appId=com.example.a')],
      expect.any(Object),
    );
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('in your browser'));
  });
});

describe('getBrowserOpenerCommand', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('uses "open" on darwin', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    expect(getBrowserOpenerCommand()).toBe('open');
  });

  it('uses "start" on win32', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    expect(getBrowserOpenerCommand()).toBe('start');
  });

  it('uses "xdg-open" on linux and other platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    expect(getBrowserOpenerCommand()).toBe('xdg-open');

    Object.defineProperty(process, 'platform', { value: 'freebsd' });
    expect(getBrowserOpenerCommand()).toBe('xdg-open');
  });
});

describe('getBrowserOpenerArgs', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('passes the URL alone on darwin and linux', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    expect(getBrowserOpenerArgs('http://localhost:8081/rozenite/app/')).toEqual([
      'http://localhost:8081/rozenite/app/',
    ]);

    Object.defineProperty(process, 'platform', { value: 'linux' });
    expect(getBrowserOpenerArgs('http://localhost:8081/rozenite/app/')).toEqual([
      'http://localhost:8081/rozenite/app/',
    ]);
  });

  it('prefixes an empty title on win32 so "start" does not treat the URL as the window title', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    expect(getBrowserOpenerArgs('http://localhost:8081/rozenite/app/')).toEqual([
      '',
      'http://localhost:8081/rozenite/app/',
    ]);
  });
});

describe('selectTargetById', () => {
  it('returns the matching target', () => {
    expect(selectTargetById([targetA, targetB], 'device-b')).toBe(targetB);
  });

  it('throws listing valid ids when the id is unknown', () => {
    expect(() => selectTargetById([targetA, targetB], 'nope')).toThrow(
      'Unknown deviceId "nope". Valid device IDs: device-a, device-b',
    );
  });
});
