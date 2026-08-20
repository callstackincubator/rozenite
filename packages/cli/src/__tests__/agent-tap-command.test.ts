import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerTapCommand, runTapCommand } from '../commands/agent/register-tap-command.js';

const mocks = vi.hoisted(() => ({
  createAgentTransport: vi.fn(),
  transport: {
    openSessionTap: vi.fn(),
    sendSessionTapMessage: vi.fn(),
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

  const baseOptions = {
    host: '127.0.0.1',
    port: '8081',
    session: 'session-1',
    payload: '{}',
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

  it('requires --plugin when --type is provided', async () => {
    setupTransport();
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await runTapCommand({ ...baseOptions, type: 'sqlite:query' });

    expect(stderrWrite).toHaveBeenCalledWith('--plugin is required when --type is provided\n');
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

  it('prints newline-delimited JSON with --json', async () => {
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
});
