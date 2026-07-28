import { Command } from 'commander';
import { execFileSync } from 'node:child_process';
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
      host: '127.0.0.1',
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
      '{"cols":["id","kind"],"rows":[["app","plugin"],["console","static"],["memory","static"],["network","static"],["performance","static"],["react","static"]]}\n',
    );
  });

  it('prints a runnable next command instead of a pagination envelope', async () => {
    setupClient();
    mocks.session.domains.list.mockResolvedValue([
      { id: 'app', kind: 'plugin' },
      { id: 'console', kind: 'static' },
    ]);

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
        'domains',
        '--session',
        'session 1',
        '--limit',
        '1',
      ],
      { from: 'node' },
    );

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"items":[{"id":"app","kind":"plugin"}],"next":"rozenite agent domains --host 127.0.0.1 --port 8081 --session \'session 1\' --limit 1 --cursor eyJ2IjoxLCJraW5kIjoiZG9tYWlucyIsInNjb3BlIjoiYWxsIiwiaW5kZXgiOjF9"}\n',
    );
  });

  it('uses the requested field order for columnar tool listings', async () => {
    setupClient();
    mocks.session.tools.list.mockResolvedValue([
      {
        name: 'network.listRequests',
        shortName: 'listRequests',
        description: 'List requests',
      },
      {
        name: 'network.getRequestDetails',
        shortName: 'getRequestDetails',
        description: 'Get details',
      },
    ]);

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
        'network',
        'tools',
        '--session',
        'session-1',
        '--fields',
        'description,name',
      ],
      { from: 'node' },
    );

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"cols":["description","name"],"rows":[["Get details","network.getRequestDetails"],["List requests","network.listRequests"]]}\n',
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

  it('columnar-encodes terminal getTree rows using requested fields', async () => {
    setupClient();
    mocks.session.tools.call.mockResolvedValueOnce({
      roots: [1],
      totalCount: 2,
      items: [
        { nodeId: 1, displayName: 'App', childIds: [2] },
        { nodeId: 2, displayName: 'Screen' },
      ],
      page: { limit: 20, hasMore: false },
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
        'react',
        'call',
        '--tool',
        'getTree',
        '--args',
        '{}',
        '--fields',
        'displayName,nodeId,childIds',
        '--session',
        'session-1',
      ],
      { from: 'node' },
    );

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"roots":[1],"totalCount":2,"cols":["displayName","nodeId","childIds"],"rows":[["App",1,[2]],["Screen",2,null]]}\n',
    );
  });

  it('keeps an empty getTree result expanded without terminal page metadata', async () => {
    setupClient();
    mocks.session.tools.call.mockResolvedValueOnce({
      roots: [],
      totalCount: 0,
      items: [],
      page: { limit: 20, hasMore: false },
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
        'react',
        'call',
        '--tool',
        'getTree',
        '--session',
        'session-1',
      ],
      { from: 'node' },
    );

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"roots":[],"totalCount":0,"items":[]}\n',
    );
  });

  it('keeps one row tool results expanded and prints a complete continuation', async () => {
    setupClient();
    mocks.session.tools.call.mockResolvedValueOnce({
      recording: { isRecording: true },
      items: [
        {
          requestId: 'request-1',
          method: 'GET',
          url: 'https://example.test',
          status: null,
          type: 'fetch',
          startTimeMs: 1,
          endTimeMs: null,
          durationMs: null,
          transferSize: null,
          encodedDataLength: null,
          outcome: 'in-flight',
        },
      ],
      page: { limit: 1, hasMore: true, nextCursor: "next ' cursor" },
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
        'network domain',
        'call',
        '--tool',
        'listRequests',
        '--args',
        '{"limit":1,"filter":"two words"}',
        '--fields',
        'url,status',
        '--session',
        'session id',
        '--pretty',
      ],
      { from: 'node' },
    );

    const rawOutput = String(stdoutWrite.mock.calls[0][0]);
    expect(rawOutput).toMatch(/^\{\n\s{2}"recording"/);
    const output = JSON.parse(rawOutput);
    expect(output).toMatchObject({
      recording: { isRecording: true },
      items: [{ requestId: 'request-1', status: null }],
      next: expect.stringContaining("rozenite agent 'network domain' call"),
    });

    const continuation = output.next;
    const args = execFileSync(
      'zsh',
      ['-c', `for arg in ${continuation}; do print -r -- "$arg"; done`],
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n');
    expect(args).toEqual([
      'rozenite',
      'agent',
      'network domain',
      'call',
      '--host',
      '127.0.0.1',
      '--port',
      '8081',
      '--session',
      'session id',
      '--tool',
      'listRequests',
      '--args',
      '{"limit":1,"filter":"two words","cursor":"next \' cursor"}',
      '--fields',
      'url,status',
      '--pretty',
    ]);
  });

  it('uses the fixed default schema for two-row listRequests results', async () => {
    setupClient();
    mocks.session.tools.call.mockResolvedValueOnce({
      items: [
        { requestId: 'one', method: 'GET', url: '/', status: 200 },
        { requestId: 'two', method: 'POST', url: '/two', status: null },
      ],
      page: { limit: 20, hasMore: false },
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
        'network',
        'call',
        '--tool',
        'listRequests',
        '--args',
        '{}',
        '--session',
        'session-1',
      ],
      { from: 'node' },
    );

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"cols":["requestId","method","url","status","type","startTimeMs","endTimeMs","durationMs","transferSize","encodedDataLength","outcome"],"rows":[["one","GET","/",200,null,null,null,null,null,null,null],["two","POST","/two",null,null,null,null,null,null,null,null]]}\n',
    );
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
