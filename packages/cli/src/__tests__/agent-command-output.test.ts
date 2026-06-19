import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPackageJSON } from '../package-json.js';
import { registerAgentCommand } from '../commands/agent/register-agent-command.js';

const mocks = vi.hoisted(() => ({
  createAgentClient: vi.fn(),
  createAgentTransport: vi.fn(),
  client: {
    targets: {
      list: vi.fn(),
    },
    openSession: vi.fn(),
    attachSession: vi.fn(),
    withSession: vi.fn(),
  },
  session: {
    id: 'session-1',
    info: {
      id: 'session-1',
      deviceName: 'iPhone',
      status: 'connected',
    },
    stop: vi.fn(),
    domains: {
      list: vi.fn(),
    },
    tools: {
      list: vi.fn(),
      getSchema: vi.fn(),
      call: vi.fn(),
    },
  },
  transport: {
    createSession: vi.fn(),
    listSessions: vi.fn(),
    getSession: vi.fn(),
    stopSession: vi.fn(),
  },
}));

vi.mock('@rozenite/agent-sdk', () => ({
  createAgentClient: mocks.createAgentClient,
}));

vi.mock('@rozenite/agent-sdk/transport', () => ({
  createAgentTransport: mocks.createAgentTransport,
}));

describe('agent command output', () => {
  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const setupClient = () => {
    mocks.createAgentClient.mockReturnValue(mocks.client);
    mocks.client.attachSession.mockResolvedValue(mocks.session);
  };

  const setupTransport = () => {
    mocks.createAgentTransport.mockReturnValue(mocks.transport);
  };

  it('prints JSON for agent commands without requiring --json', async () => {
    setupClient();
    mocks.client.targets.list.mockResolvedValue([
      {
        id: 'device-1',
        name: 'iPhone',
        description: 'app',
        appId: 'app.test',
        pageId: 'page-1',
        title: 'title',
      },
    ]);

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'targets'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"items":[{"id":"device-1","name":"iPhone"}]}\n',
    );
    expect(mocks.createAgentClient).toHaveBeenCalledWith({
      host: 'localhost',
      port: 8081,
    });
  });

  it('accepts --json as a no-op for agent commands', async () => {
    setupClient();
    mocks.client.targets.list.mockResolvedValue([
      {
        id: 'device-1',
        name: 'iPhone',
        description: 'app',
        appId: 'app.test',
        pageId: 'page-1',
        title: 'title',
      },
    ]);

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'targets', '--json'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"items":[{"id":"device-1","name":"iPhone"}]}\n',
    );
  });

  it('prints the slim session for session create', async () => {
    setupClient();
    setupTransport();
    mocks.transport.createSession.mockResolvedValue({
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
        connectedAt: 3,
        lastError: 'none',
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

    expect(mocks.transport.createSession).toHaveBeenCalledWith({
      deviceId: undefined,
      cliVersion: getPackageJSON().version,
    });
    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"id":"device-1","deviceName":"iPhone","status":"connected"}\n',
    );
  });

  it('accepts --json as a no-op for session commands', async () => {
    setupClient();
    setupTransport();
    mocks.transport.createSession.mockResolvedValue({
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
        connectedAt: 3,
        lastError: 'none',
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
      '{"id":"device-1","deviceName":"iPhone","status":"connected"}\n',
    );
  });

  it('prints a human-readable version warning only when incompatible', async () => {
    setupClient();
    setupTransport();
    mocks.transport.createSession.mockResolvedValue({
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
        connectedAt: 3,
        lastError: 'none',
        toolCount: 3,
      },
      versionCheck:
        'Connected Rozenite agent uses version 1.5.0, but Metro is running version 1.6.0. Integration may not work correctly.',
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
      '{"id":"device-1","deviceName":"iPhone","status":"connected","versionCheck":"Connected Rozenite agent uses version 1.5.0, but Metro is running version 1.6.0. Integration may not work correctly."}\n',
    );
  });

  it('prints domains without session metadata', async () => {
    setupClient();
    mocks.session.domains.list.mockResolvedValue([
      {
        id: 'app',
        kind: 'plugin',
        description: 'Runtime tools exposed by the app itself.',
      },
      {
        id: 'console',
        kind: 'static',
        description: 'CDP-style Console domain for React Native log access.',
      },
      {
        id: 'memory',
        kind: 'static',
        description:
          'CDP memory inspection and heap profiling tools with Metro-managed artifact exports.',
      },
      {
        id: 'network',
        kind: 'static',
        description:
          'Raw CDP network recording tools with paginated request browsing.',
      },
      {
        id: 'performance',
        kind: 'static',
        description:
          'CDP performance tracing tools with Metro-managed artifact exports.',
      },
      {
        id: 'react',
        kind: 'static',
        description: 'React tree inspection and profiling tools.',
      },
    ]);

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
      '{"items":[{"id":"app","kind":"plugin"},{"id":"console","kind":"static"},{"id":"memory","kind":"static"},{"id":"network","kind":"static"},{"id":"performance","kind":"static"},{"id":"react","kind":"static"}],"page":{"limit":20,"hasMore":false}}\n',
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
    mocks.session.tools.getSchema.mockResolvedValue({
      name: 'app.echo',
      shortName: 'echo',
      inputSchema: {
        type: 'object',
        properties: { value: { type: 'string' } },
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
      '{"name":"app.echo","shortName":"echo","inputSchema":{"type":"object","properties":{"value":{"type":"string"}}}}\n',
    );
  });

  it('prints raw tool results without domain or tool metadata', async () => {
    setupClient();
    mocks.session.tools.call.mockResolvedValueOnce({
      value: 'hello',
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
    mocks.client.targets.list.mockRejectedValue(
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
    setupTransport();
    mocks.transport.createSession.mockRejectedValue(
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
    mocks.client.targets.list.mockResolvedValue([]);

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

    expect(mocks.createAgentClient).toHaveBeenCalledWith({
      host: '10.0.0.5',
      port: 9090,
    });
  });
});
