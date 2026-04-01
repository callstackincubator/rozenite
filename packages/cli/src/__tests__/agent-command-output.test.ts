import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerAgentCommand } from '../commands/agent/register-agent-command.js';

const mocks = vi.hoisted(() => ({
  createAgentHttpClient: vi.fn(),
  client: {
    listTargets: vi.fn(),
    createSession: vi.fn(),
    listSessions: vi.fn(),
    getSession: vi.fn(),
    stopSession: vi.fn(),
    getSessionTools: vi.fn(),
    callSessionTool: vi.fn(),
  },
}));

vi.mock('../commands/agent/http-client.js', () => ({
  createAgentHttpClient: mocks.createAgentHttpClient,
}));

describe('agent command output', () => {
  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const setupClient = () => {
    mocks.createAgentHttpClient.mockReturnValue(mocks.client);
  };

  it('prints JSON for agent commands without requiring --json', async () => {
    setupClient();
    mocks.client.listTargets.mockResolvedValue({
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
    expect(mocks.createAgentHttpClient).toHaveBeenCalledWith({
      host: 'localhost',
      port: 8081,
      pretty: false,
      session: undefined,
    });
  });

  it('accepts --json as a no-op for agent commands', async () => {
    setupClient();
    mocks.client.listTargets.mockResolvedValue({
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
    setupClient();
    mocks.client.createSession.mockResolvedValue({
      session: {
        id: 'device-1',
        host: 'localhost',
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
      '{"id":"device-1","host":"localhost","port":8081,"deviceId":"device-1","deviceName":"iPhone","appId":"app.test","pageId":"page-1","status":"connected","createdAt":1,"lastActivityAt":2,"toolCount":3}\n',
    );
  });

  it('accepts --json as a no-op for session commands', async () => {
    setupClient();
    mocks.client.createSession.mockResolvedValue({
      session: {
        id: 'device-1',
        host: 'localhost',
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

    await program.parseAsync(
      ['node', 'test', 'agent', 'session', 'create', '--json'],
      {
        from: 'node',
      },
    );

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"id":"device-1","host":"localhost","port":8081,"deviceId":"device-1","deviceName":"iPhone","appId":"app.test","pageId":"page-1","status":"connected","createdAt":1,"lastActivityAt":2,"toolCount":3}\n',
    );
  });

  it('prints domains without session metadata', async () => {
    setupClient();
    mocks.client.getSessionTools.mockResolvedValue({
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

    await program.parseAsync(
      ['node', 'test', 'agent', 'domains', '--session', 'session-1'],
      {
        from: 'node',
      },
    );

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"items":[{"id":"app","kind":"plugin","pluginId":"app","slug":"app"},{"id":"console","kind":"static"},{"id":"memory","kind":"static"},{"id":"network","kind":"static"},{"id":"performance","kind":"static"},{"id":"react","kind":"static"}],"page":{"limit":20,"hasMore":false}}\n',
    );
  });

  it('does not expose daemon lifecycle commands in help output', () => {
    setupClient();
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

    const help = stdoutWrite.mock.calls
      .map(([chunk]) => String(chunk))
      .join('');
    expect(help).not.toMatch(/\n\s+daemon(?:\s|\n)/);
    expect(help).not.toContain('kill-all');
    expect(help).not.toMatch(/\n\s+ps(?:\s|\n)/);
    expect(help).toContain('session');
    expect(help).toContain('targets');
  });

  it('prints tool schemas without the domain envelope', async () => {
    setupClient();
    mocks.client.getSessionTools.mockResolvedValue({
      tools: [
        {
          name: 'app.echo',
          description: 'Echo',
          inputSchema: {
            type: 'object',
            properties: { value: { type: 'string' } },
          },
        },
      ],
    });

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(
      [
        'node',
        'test',
        'agent',
        'app',
        'schema',
        '--tool',
        'echo',
        '--session',
        'session-1',
      ],
      {
        from: 'node',
      },
    );

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"name":"app.echo","shortName":"echo","description":"Echo","inputSchema":{"type":"object","properties":{"value":{"type":"string"}}}}\n',
    );
  });

  it('prints raw tool results without domain or tool metadata', async () => {
    setupClient();
    mocks.client.getSessionTools.mockResolvedValueOnce({
      tools: [
        {
          name: 'app.echo',
          description: 'Echo',
          inputSchema: { type: 'object' },
        },
      ],
    });
    mocks.client.callSessionTool.mockResolvedValueOnce({
      result: {
        value: 'hello',
      },
    });

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(
      [
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
      ],
      {
        from: 'node',
      },
    );

    expect(stdoutWrite).toHaveBeenCalledWith('{"value":"hello"}\n');
  });

  it('prints JSON errors for agent command failures', async () => {
    setupClient();
    mocks.client.listTargets.mockRejectedValue(
      new Error(
        'Unable to reach Metro at http://127.0.0.1:8081. Make sure Metro is running and reachable, then try again.',
      ),
    );

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

  it('preserves agent API validation errors instead of rewriting them as connection failures', async () => {
    setupClient();
    mocks.client.createSession.mockRejectedValue(
      new Error('Multiple Metro targets detected. Pass --deviceId.'),
    );

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'session', 'create'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"error":{"message":"Multiple Metro targets detected. Pass --deviceId."}}\n',
    );
  });

  it('passes custom host and port into the HTTP client', async () => {
    setupClient();
    mocks.client.listTargets.mockResolvedValue({ targets: [] });

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(
      [
        'node',
        'test',
        'agent',
        'targets',
        '--host',
        '10.0.0.5',
        '--port',
        '9090',
      ],
      {
        from: 'node',
      },
    );

    expect(mocks.createAgentHttpClient).toHaveBeenCalledWith({
      host: '10.0.0.5',
      port: 9090,
      pretty: false,
      session: undefined,
    });
  });
});
