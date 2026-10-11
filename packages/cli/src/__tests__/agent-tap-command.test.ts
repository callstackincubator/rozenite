import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerTapCommand, runTapCommand } from '../commands/agent/register-tap-command.js';

const mocks = vi.hoisted(() => ({
  createAgentTransport: vi.fn(),
  transport: {
    openSessionTap: vi.fn(),
    sendSessionTapMessage: vi.fn(),
    createSession: vi.fn(),
    listTargets: vi.fn(),
  },
}));

vi.mock('@rozenite/agent-sdk/transport', () => ({
  createAgentTransport: mocks.createAgentTransport,
}));

type Handlers = {
  onOpen?: () => void;
  onEvent: (event: unknown) => void;
  onError: (error: Error) => void;
  onEnd: () => void;
};

describe('rozenite agent tap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    process.exitCode = undefined;
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
  });

  const setupTransport = () => {
    mocks.createAgentTransport.mockReturnValue(mocks.transport);
  };

  // A terminal unless a test says otherwise: arrow lines, errors on stderr.
  const baseOptions = {
    host: '127.0.0.1',
    port: '8081',
    session: 'session-1',
    payload: '{}',
    tty: true,
  };

  it('rejects invalid --payload JSON before opening a session', async () => {
    setupTransport();
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await runTapCommand({ ...baseOptions, payload: 'not-json' });

    expect(stderrWrite).toHaveBeenCalledWith('--payload must be valid JSON\n');
    expect(process.exitCode).toBe(1);
    expect(mocks.transport.openSessionTap).not.toHaveBeenCalled();
  });

  it('reports invalid --payload as a JSON envelope in --json mode', async () => {
    setupTransport();
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runTapCommand({ ...baseOptions, payload: 'not-json', json: true });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"error":{"message":"--payload must be valid JSON"}}\n',
    );
    expect(process.exitCode).toBe(1);
  });

  it('requires a plugin when a message is sent', async () => {
    setupTransport();
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await runTapCommand({ ...baseOptions, type: 'sqlite:query' });

    expect(stderrWrite).toHaveBeenCalledWith(
      'A plugin is required to send a message: rozenite agent tap <plugin> --send <type>\n',
    );
    expect(mocks.transport.openSessionTap).not.toHaveBeenCalled();
  });

  it('opens the stream filtered to --plugin only, not --type', async () => {
    setupTransport();
    let handlers: Handlers | undefined;
    mocks.transport.openSessionTap.mockImplementation((_sessionId, _filter, h: Handlers) => {
      handlers = h;
      return { close: vi.fn() };
    });

    const done = runTapCommand({
      ...baseOptions,
      plugin: '@acme/sqlite-plugin',
    });
    await vi.waitFor(() => expect(mocks.transport.openSessionTap).toHaveBeenCalled());

    expect(mocks.transport.openSessionTap).toHaveBeenCalledWith(
      'session-1',
      { pluginId: '@acme/sqlite-plugin' },
      expect.any(Object),
    );

    handlers?.onEnd();
    await done;
  });

  it('prints a human-readable line per event by default', async () => {
    setupTransport();
    let handlers: Handlers | undefined;
    mocks.transport.openSessionTap.mockImplementation((_sessionId, _filter, h: Handlers) => {
      handlers = h;
      return { close: vi.fn() };
    });
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const done = runTapCommand(baseOptions);
    await vi.waitFor(() => expect(handlers).toBeDefined());

    handlers?.onEvent({
      direction: 'in',
      timestamp: 0,
      pluginId: '@acme/sqlite-plugin',
      type: 'list-tables-request',
      payload: { requestId: 'a1' },
    });
    handlers?.onEnd();
    await done;

    const printedLine = stdoutWrite.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(printedLine).toContain('←');
    expect(printedLine).toContain('list-tables-request');
    expect(printedLine).toContain('{"requestId":"a1"}');
  });

  it('prints newline-delimited JSON when stdout is not a terminal', async () => {
    setupTransport();
    let handlers: Handlers | undefined;
    mocks.transport.openSessionTap.mockImplementation((_sessionId, _filter, h: Handlers) => {
      handlers = h;
      return { close: vi.fn() };
    });
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const done = runTapCommand({ ...baseOptions, tty: false });
    await vi.waitFor(() => expect(handlers).toBeDefined());

    const event = {
      direction: 'in' as const,
      timestamp: 5,
      pluginId: '@acme/sqlite-plugin',
      type: 'result',
      payload: { rows: 1 },
    };
    handlers?.onEvent(event);
    handlers?.onError(new Error('gone'));
    await done;

    expect(stdoutWrite).toHaveBeenCalledWith(`${JSON.stringify(event)}\n`);
    expect(stdoutWrite).toHaveBeenCalledWith('{"error":{"message":"gone"}}\n');
  });

  it('prints newline-delimited JSON with --json on a terminal', async () => {
    setupTransport();
    let handlers: Handlers | undefined;
    mocks.transport.openSessionTap.mockImplementation((_sessionId, _filter, h: Handlers) => {
      handlers = h;
      return { close: vi.fn() };
    });
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const done = runTapCommand({ ...baseOptions, json: true });
    await vi.waitFor(() => expect(handlers).toBeDefined());

    const event = {
      direction: 'out' as const,
      timestamp: 5,
      pluginId: '@acme/sqlite-plugin',
      type: 'query',
      payload: { sql: 'select 1' },
    };
    handlers?.onEvent(event);
    handlers?.onEnd();
    await done;

    expect(stdoutWrite).toHaveBeenCalledWith(`${JSON.stringify(event)}\n`);
  });

  it('sends one message once the stream is open, then keeps watching', async () => {
    setupTransport();
    let handlers: Handlers | undefined;
    mocks.transport.openSessionTap.mockImplementation((_sessionId, _filter, h: Handlers) => {
      handlers = h;
      return { close: vi.fn() };
    });
    mocks.transport.sendSessionTapMessage.mockResolvedValue({ sent: true });

    const done = runTapCommand({
      ...baseOptions,
      plugin: '@acme/sqlite-plugin',
      type: 'sqlite:query',
      payload: '{"sql":"select 1"}',
    });
    await vi.waitFor(() => expect(handlers).toBeDefined());

    handlers?.onOpen?.();
    await vi.waitFor(() =>
      expect(mocks.transport.sendSessionTapMessage).toHaveBeenCalledWith('session-1', {
        pluginId: '@acme/sqlite-plugin',
        type: 'sqlite:query',
        payload: { sql: 'select 1' },
      }),
    );

    handlers?.onEnd();
    await done;
  });

  it('reports a send failure and closes the stream', async () => {
    setupTransport();
    let handlers: Handlers | undefined;
    const close = vi.fn();
    mocks.transport.openSessionTap.mockImplementation((_sessionId, _filter, h: Handlers) => {
      handlers = h;
      return { close };
    });
    mocks.transport.sendSessionTapMessage.mockRejectedValue(new Error('boom'));
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const done = runTapCommand({
      ...baseOptions,
      plugin: '@acme/sqlite-plugin',
      type: 'sqlite:query',
    });
    await vi.waitFor(() => expect(handlers).toBeDefined());
    handlers?.onOpen?.();

    await done;

    expect(stderrWrite).toHaveBeenCalledWith('boom\n');
    expect(process.exitCode).toBe(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('reports a stream error and stops', async () => {
    setupTransport();
    let handlers: Handlers | undefined;
    mocks.transport.openSessionTap.mockImplementation((_sessionId, _filter, h: Handlers) => {
      handlers = h;
      return { close: vi.fn() };
    });
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const done = runTapCommand(baseOptions);
    await vi.waitFor(() => expect(handlers).toBeDefined());

    handlers?.onError(new Error('Unknown session "session-1"'));
    await done;

    expect(stderrWrite).toHaveBeenCalledWith('Unknown session "session-1"\n');
    expect(process.exitCode).toBe(1);
  });

  it('closes the tap and exits cleanly on SIGINT', async () => {
    setupTransport();
    const close = vi.fn();
    mocks.transport.openSessionTap.mockImplementation(() => ({ close }));

    const done = runTapCommand(baseOptions);
    await vi.waitFor(() => expect(mocks.transport.openSessionTap).toHaveBeenCalled());

    process.emit('SIGINT');
    await done;

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('registers under `agent` and inherits its host/port globals', async () => {
    setupTransport();
    mocks.transport.openSessionTap.mockImplementation((_sessionId, _filter, h: Handlers) => {
      // End the stream immediately so `parseAsync` (which awaits the action)
      // doesn't hang waiting for a Ctrl-C that never comes in this test.
      queueMicrotask(() => h.onEnd());
      return { close: vi.fn() };
    });

    const program = new Command();
    const agentCommand = program
      .command('agent')
      .option('--host <host>', 'Metro host', '127.0.0.1')
      .option('--port <port>', 'Metro port', '8081');
    registerTapCommand(agentCommand);

    const tapCommand = agentCommand.commands.find((command) => command.name() === 'tap');
    expect(tapCommand).toBeDefined();
    expect(program.commands.some((command) => command.name() === 'tap')).toBe(false);
    expect(tapCommand?.options.some((option) => option.long === '--payload')).toBe(true);
    expect(tapCommand?.options.find((option) => option.long === '--payload')?.defaultValue).toBe(
      '{}',
    );
    // `--host`/`--port` come from the parent `agent` command, so `tap` must
    // not redeclare them.
    expect(tapCommand?.options.some((option) => option.long === '--host')).toBe(false);
    expect(tapCommand?.options.some((option) => option.long === '--port')).toBe(false);

    await program.parseAsync(
      [
        'node',
        'test',
        'agent',
        '--host',
        '10.0.0.5',
        '--port',
        '9090',
        'tap',
        '--session',
        'session-1',
      ],
      { from: 'node' },
    );

    expect(mocks.createAgentTransport).toHaveBeenCalledWith({
      host: '10.0.0.5',
      port: 9090,
    });
  });

  describe('command line', () => {
    const runTap = async (...argv: string[]) => {
      const program = new Command();
      registerTapCommand(program.command('agent'));
      await program.parseAsync(['node', 'test', 'agent', 'tap', ...argv], { from: 'node' });
    };

    const setupStream = () => {
      setupTransport();
      mocks.transport.sendSessionTapMessage.mockResolvedValue({ sent: true });
      mocks.transport.openSessionTap.mockImplementation((_sessionId, _filter, h: Handlers) => {
        queueMicrotask(() => {
          h.onOpen?.();
          queueMicrotask(() => h.onEnd());
        });
        return { close: vi.fn() };
      });
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    };

    it('takes the plugin as a positional and sends with --send/--payload', async () => {
      setupStream();

      await runTap(
        '@acme/sqlite-plugin',
        '--send',
        'ping',
        '--payload',
        '{"a":1}',
        '--session',
        's-1',
      );

      expect(mocks.transport.openSessionTap).toHaveBeenCalledWith(
        's-1',
        { pluginId: '@acme/sqlite-plugin' },
        expect.any(Object),
      );
      expect(mocks.transport.sendSessionTapMessage).toHaveBeenCalledWith('s-1', {
        pluginId: '@acme/sqlite-plugin',
        type: 'ping',
        payload: { a: 1 },
      });
    });

    it('still parses --plugin, --type, -a and --json', async () => {
      setupStream();

      await runTap(
        '-s',
        's-1',
        '-p',
        '@acme/sqlite-plugin',
        '-t',
        'ping',
        '-a',
        '{"a":1}',
        '--json',
      );

      expect(mocks.transport.sendSessionTapMessage).toHaveBeenCalledWith('s-1', {
        pluginId: '@acme/sqlite-plugin',
        type: 'ping',
        payload: { a: 1 },
      });
    });

    it('resolves the session implicitly when none is given', async () => {
      setupStream();
      mocks.transport.createSession.mockResolvedValue({
        session: { id: 'device-1-1', deviceName: 'iPhone', createdAt: 1 },
      });

      await runTap('@acme/sqlite-plugin');

      expect(mocks.transport.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: undefined }),
      );
      expect(mocks.transport.openSessionTap).toHaveBeenCalledWith(
        'device-1-1',
        { pluginId: '@acme/sqlite-plugin' },
        expect.any(Object),
      );
    });
  });
});
