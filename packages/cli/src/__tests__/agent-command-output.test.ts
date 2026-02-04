import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerAgentCommand } from '../commands/agent/register-agent-command.js';

const mocks = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  listRegisteredDaemons: vi.fn(),
  shutdownAllRegisteredDaemons: vi.fn(),
  shutdownRunningDaemon: vi.fn(),
}));

vi.mock('../commands/agent/daemon-client.js', () => ({
  callDaemon: mocks.callDaemon,
  listRegisteredDaemons: mocks.listRegisteredDaemons,
  shutdownAllRegisteredDaemons: mocks.shutdownAllRegisteredDaemons,
  shutdownRunningDaemon: mocks.shutdownRunningDaemon,
}));

describe('agent command output', () => {
  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('prints JSON for agent commands without requiring --json', async () => {
    mocks.callDaemon.mockResolvedValue({
      targets: [
        {
          id: 'device-1',
          name: 'iPhone',
          description: 'app',
          appId: 'app.test',
          pageId: 'page-1',
          title: 'title',
        },
      ],
    });

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'targets'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"items":[{"id":"device-1","name":"iPhone","description":"app","app":"app.test","pageId":"page-1","title":"title"}]}\n',
    );
  });

  it('accepts --json as a no-op for agent commands', async () => {
    mocks.callDaemon.mockResolvedValue({
      targets: [
        {
          id: 'device-1',
          name: 'iPhone',
          description: 'app',
          appId: 'app.test',
          pageId: 'page-1',
          title: 'title',
        },
      ],
    });

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'targets', '--json'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"items":[{"id":"device-1","name":"iPhone","description":"app","app":"app.test","pageId":"page-1","title":"title"}]}\n',
    );
  });

  it('prints the raw session for session create', async () => {
    mocks.callDaemon.mockResolvedValue({
      session: {
        id: 'session-1',
        host: '127.0.0.1',
        port: 8081,
        deviceId: 'device-1',
        deviceName: 'iPhone',
        appId: 'app.test',
        pageId: 'page-1',
        status: 'connected',
        createdAt: 1,
        lastActivityAt: 2,
        toolCount: 3,
      },
    });

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'session', 'create'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"id":"session-1","host":"127.0.0.1","port":8081,"deviceId":"device-1","deviceName":"iPhone","appId":"app.test","pageId":"page-1","status":"connected","createdAt":1,"lastActivityAt":2,"toolCount":3}\n',
    );
  });

  it('accepts --json as a no-op for session commands', async () => {
    mocks.callDaemon.mockResolvedValue({
      session: {
        id: 'session-1',
        host: '127.0.0.1',
        port: 8081,
        deviceId: 'device-1',
        deviceName: 'iPhone',
        appId: 'app.test',
        pageId: 'page-1',
        status: 'connected',
        createdAt: 1,
        lastActivityAt: 2,
        toolCount: 3,
      },
    });

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'session', 'create', '--json'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"id":"session-1","host":"127.0.0.1","port":8081,"deviceId":"device-1","deviceName":"iPhone","appId":"app.test","pageId":"page-1","status":"connected","createdAt":1,"lastActivityAt":2,"toolCount":3}\n',
    );
  });

  it('prints domains without session metadata', async () => {
    mocks.callDaemon.mockResolvedValue({
      tools: [
        {
          name: 'app.echo',
          description: 'Echo',
          inputSchema: { type: 'object' },
        },
      ],
    });

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'domains', '--session', 'session-1'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"items":[{"id":"app","kind":"plugin","pluginId":"app","slug":"app"},{"id":"console","kind":"static"},{"id":"memory","kind":"static"},{"id":"network","kind":"static"},{"id":"performance","kind":"static"},{"id":"react","kind":"static"}],"page":{"limit":20,"hasMore":false}}\n',
    );
  });

  it('prints kill-all results', async () => {
    mocks.shutdownAllRegisteredDaemons.mockResolvedValue({
      killed: ['/tmp/a'],
      alreadyStopped: ['/tmp/b'],
      failed: [{ workspace: '/tmp/c', message: 'boom' }],
      pruned: ['/tmp/d'],
    });

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'kill-all'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"killed":["/tmp/a"],"alreadyStopped":["/tmp/b"],"failed":[{"workspace":"/tmp/c","message":"boom"}],"pruned":["/tmp/d"]}\n',
    );
  });

  it('prints registered daemons for ps', async () => {
    mocks.listRegisteredDaemons.mockResolvedValue({
      items: [
        {
          workspace: '/tmp/app',
          pid: 12,
          transportKind: 'unix-socket',
          address: '/tmp/app.sock',
          metadataPath: '/tmp/app/.rozenite/agent-daemon.json',
          startedAt: 1,
          sessionCount: 2,
          lastSeenAt: 3,
          status: 'running',
        },
      ],
      pruned: ['/tmp/stale'],
    });

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'ps'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"items":[{"workspace":"/tmp/app","pid":12,"transportKind":"unix-socket","address":"/tmp/app.sock","metadataPath":"/tmp/app/.rozenite/agent-daemon.json","startedAt":1,"sessionCount":2,"lastSeenAt":3,"status":"running"}],"pruned":["/tmp/stale"]}\n',
    );
  });

  it('hides the internal daemon command from agent help output', () => {
    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    expect(() =>
      program.parse(['node', 'test', 'agent', '--help'], {
        from: 'node',
      }),
    ).toThrow();

    const help = stdoutWrite.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(help).not.toContain('Internal Agent daemon entrypoint');
    expect(help).not.toMatch(/\n\s+daemon(?:\s|\n)/);
    expect(help).toContain('session');
    expect(help).toContain('kill-all');
  });

  it('prints tool schemas without the domain envelope', async () => {
    mocks.callDaemon.mockResolvedValue({
      tools: [
        {
          name: 'app.echo',
          description: 'Echo',
          inputSchema: { type: 'object', properties: { value: { type: 'string' } } },
        },
      ],
    });

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync([
      'node',
      'test',
      'agent',
      'app',
      'schema',
      '--tool',
      'echo',
      '--session',
      'session-1',
    ], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"name":"app.echo","shortName":"echo","description":"Echo","inputSchema":{"type":"object","properties":{"value":{"type":"string"}}}}\n',
    );
  });

  it('prints raw tool results without domain or tool metadata', async () => {
    mocks.callDaemon
      .mockResolvedValueOnce({
        tools: [
          {
            name: 'app.echo',
            description: 'Echo',
            inputSchema: { type: 'object' },
          },
        ],
      })
      .mockResolvedValueOnce({
        result: {
          value: 'hello',
        },
      });

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync([
      'node',
      'test',
      'agent',
      'app',
      'call',
      '--tool',
      'echo',
      '--args',
      '{"value":"hello"}',
      '--session',
      'session-1',
    ], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith('{"value":"hello"}\n');
  });

  it('prints JSON errors for agent command failures', async () => {
    mocks.callDaemon.mockRejectedValue(new Error('Unable to reach Metro at http://127.0.0.1:8081. Make sure Metro is running and reachable, then try again.'));

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'targets'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"error":{"message":"Unable to reach Metro at http://127.0.0.1:8081. Make sure Metro is running and reachable, then try again."}}\n',
    );
  });
});
