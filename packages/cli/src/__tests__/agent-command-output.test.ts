import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      resolve: vi.fn(),
      call: vi.fn(),
    },
  },
  transport: {
    createSession: vi.fn(),
    listTargets: vi.fn(),
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
  const reactTreeFields = [
    'nodeId',
    'label',
    'displayName',
    'elementType',
    'key',
    'childCount',
    'parentId',
    'parentLabel',
    'childIds',
    'depth',
  ];
  const networkRequestFields = [
    'requestId',
    'method',
    'url',
    'status',
    'type',
    'startTimeMs',
    'endTimeMs',
    'durationMs',
    'transferSize',
    'encodedDataLength',
    'outcome',
  ];

  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const setupClient = () => {
    mocks.createAgentTransport.mockReturnValue(mocks.transport);
    mocks.createAgentClient.mockReturnValue(mocks.client);
    mocks.client.attachSession.mockResolvedValue(mocks.session);
    mocks.session.tools.resolve.mockResolvedValue({
      domainId: 'domain',
      schema: {
        name: 'plugin.tool',
        shortName: 'tool',
        inputSchema: { type: 'object', properties: {} },
      },
      call: mocks.session.tools.call,
    });
  };

  const setupPaginatedTool = (fields: string[], defaultFields?: string[]) => {
    mocks.session.tools.resolve.mockResolvedValue({
      domainId: 'domain',
      schema: {
        name: 'plugin.list',
        shortName: 'list',
        inputSchema: { type: 'object', properties: {} },
        pagination: {
          kind: 'cursor',
          fields,
          ...(defaultFields ? { defaultFields } : {}),
        },
      },
      call: mocks.session.tools.call,
    });
  };

  const setupTransport = () => {
    mocks.createAgentTransport.mockReturnValue(mocks.transport);
  };

  const listingCursor = (key: string, scope: string) =>
    Buffer.from(JSON.stringify({ v: 2, k: key, s: scope }), 'utf8').toString('base64url');

  it('does not expose SDK auto-pagination flags', () => {
    const program = new Command();
    registerAgentCommand(program);

    const agentCommand = program.commands.find((command) => command.name() === 'agent');
    expect(agentCommand).toBeDefined();

    const optionNames = agentCommand!.options.flatMap((option) => [option.short, option.long]);

    expect(optionNames).not.toContain('-p');
    expect(optionNames).not.toContain('--pages');
    expect(optionNames).not.toContain('-m');
    expect(optionNames).not.toContain('--max-items');
  });

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
        integration: 'react-native',
      },
    ]);

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'targets'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"items":[{"id":"device-1","name":"iPhone","integration":"react-native"}]}\n',
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
        integration: 'react-native',
      },
    ]);

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'targets', '--json'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"items":[{"id":"device-1","name":"iPhone","integration":"react-native"}]}\n',
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

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

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

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'session', 'create', '--json'], {
      from: 'node',
    });

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

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

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
        availability: 'degraded',
        unavailableReason: 'Allocation sampling is unavailable on this target.',
      },
      {
        id: 'network',
        kind: 'static',
        description: 'Raw CDP network recording tools with paginated request browsing.',
        availability: 'unsupported',
        unavailableReason: 'Lynx registers no CDP Network domain.',
        fallback: '@rozenite/network-activity-plugin',
      },
      {
        id: 'performance',
        kind: 'static',
        description: 'CDP performance tracing tools with Metro-managed artifact exports.',
      },
      {
        id: 'react',
        kind: 'static',
        description: 'React tree inspection and profiling tools.',
      },
    ]);

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', 'domains', '--session', 'session-1'], {
      from: 'node',
    });

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"cols":["id","kind","availability","fallback"],"rows":[["app","plugin","supported",null],["console","static","supported",null],["memory","static","degraded",null],["network","static","unsupported","@rozenite/network-activity-plugin"],["performance","static","supported",null],["react","static","supported",null]]}\n',
    );
  });

  it('prints a runnable next command instead of a pagination envelope', async () => {
    setupClient();
    mocks.session.domains.list.mockResolvedValue([
      { id: 'app', kind: 'plugin' },
      { id: 'console', kind: 'static' },
    ]);

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(
      ['node', 'test', 'agent', 'domains', '--session', 'session 1', '--limit', '1'],
      { from: 'node' },
    );

    // The next command is the user's command with --cursor appended: no
    // connection options and no session id.
    expect(stdoutWrite).toHaveBeenCalledWith(
      `{"items":[{"id":"app","kind":"plugin","availability":"supported"}],"next":"npx rozenite agent domains --limit 1 --cursor ${listingCursor('app', 'domains')}"}\n`,
    );
  });

  it('prints short names, descriptions, and traits for tool listings', async () => {
    setupClient();
    mocks.session.tools.list.mockResolvedValue([
      {
        name: 'network.listRequests',
        shortName: 'listRequests',
        description: 'List requests',
        readOnly: true,
        destructive: false,
        idempotent: true,
      },
      {
        name: 'network.getRequestDetails',
        shortName: 'getRequestDetails',
        description: 'Get details',
        readOnly: true,
      },
    ]);

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(
      ['node', 'test', 'agent', 'network', 'tools', '--session', 'session-1'],
      { from: 'node' },
    );

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"cols":["name","description","readOnly","destructive","idempotent"],"rows":[["getRequestDetails","Get details",true,null,null],["listRequests","List requests",true,false,true]]}\n',
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

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
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
      '{"cols":["description","name"],"rows":[["Get details","getRequestDetails"],["List requests","listRequests"]]}\n',
    );
  });

  it('does not expose daemon lifecycle commands in help output', async () => {
    setupClient();
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(['node', 'test', 'agent', '--help'], { from: 'node' });

    const help = stdoutWrite.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(help).not.toMatch(/\n\s+daemon(?:\s|\n)/);
    expect(help).not.toContain('kill-all');
    expect(help).not.toMatch(/\n\s+ps(?:\s|\n)/);
    expect(help).toContain('session');
    expect(help).toContain('targets');
  });

  it('teaches only the new grammar in help output', async () => {
    setupClient();
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const oldSpellings =
      /list-tools|get-tool-schema|call-tool|list-domains|> call|> schema|> tools|--tool\b|--deviceId|--json|--verbose|-j,|-v,|--plugin|--type\b/;

    for (const argv of [
      ['agent', '--help'],
      ['agent'],
      ['agent', 'console', '--help'],
      ['agent', 'domains', '--help'],
      ['agent', 'targets', '--help'],
      ['agent', 'tap', '--help'],
      ['agent', 'session', '--help'],
      ['agent', 'session', 'create', '--help'],
      ['agent', 'session', 'list', '--help'],
      ['agent', 'session', 'stop', '--help'],
    ]) {
      stdoutWrite.mockClear();
      const program = new Command().exitOverride();
      registerAgentCommand(program);
      await program.parseAsync(['node', 'test', ...argv], { from: 'node' }).catch(() => undefined);

      const help = stdoutWrite.mock.calls.map(([chunk]) => String(chunk)).join('');
      expect(help, argv.join(' ')).toMatch(/Usage:/);
      expect(help, argv.join(' ')).not.toMatch(oldSpellings);
    }
  });

  it('documents --fields all on CLI-owned listings', () => {
    setupClient();

    const program = new Command();
    registerAgentCommand(program);

    const agentCommand = program.commands.find((command) => command.name() === 'agent');
    for (const name of ['domains', 'targets']) {
      const listing = agentCommand?.commands.find((command) => command.name() === name);
      const fieldsOption = listing?.options.find((option) => option.long === '--fields');
      expect(fieldsOption?.description).toContain('`all`');
    }
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

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(
      ['node', 'test', 'agent', 'app', 'schema', '--tool', 'echo', '--session', 'session-1'],
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

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

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
    setupPaginatedTool(reactTreeFields);
    mocks.session.tools.call.mockResolvedValueOnce({
      roots: [1],
      totalCount: 2,
      items: [
        { nodeId: 1, displayName: 'App', childIds: [2] },
        { nodeId: 2, displayName: 'Screen' },
      ],
      page: { limit: 20, hasMore: false },
    });

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
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
    setupPaginatedTool(reactTreeFields);
    mocks.session.tools.call.mockResolvedValueOnce({
      roots: [],
      totalCount: 0,
      items: [],
      page: { limit: 20, hasMore: false },
    });

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(
      ['node', 'test', 'agent', 'react', 'call', '--tool', 'getTree', '--session', 'session-1'],
      { from: 'node' },
    );

    expect(stdoutWrite).toHaveBeenCalledWith('{"roots":[],"totalCount":0,"items":[]}\n');
  });

  it('keeps one row tool results expanded and prints a complete continuation', async () => {
    setupClient();
    setupPaginatedTool(networkRequestFields);
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

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
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
      items: [{ url: 'https://example.test', status: null }],
      next: expect.stringContaining('npx rozenite agent domain listRequests'),
    });
    expect(mocks.session.tools.call).toHaveBeenCalledTimes(1);
    expect(mocks.session.tools.call).toHaveBeenCalledWith({
      limit: 1,
      filter: 'two words',
    });

    // Emitted in the new grammar even though the call used the old one.
    expect(output.next).toBe(
      `npx rozenite agent domain listRequests --limit 1 --args '{"filter":"two words"}' --fields url,status --cursor 'next '"'"' cursor'`,
    );
  });

  it('rejects non-object --args for a declared paginated tool instead of silently using {}', async () => {
    setupClient();
    setupPaginatedTool(networkRequestFields);

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
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
        'null',
        '--fields',
        'url,status',
        '--session',
        'session-1',
      ],
      { from: 'node' },
    );

    expect(mocks.session.tools.call).not.toHaveBeenCalled();
    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"error":{"message":"--args must be a JSON object"}}\n',
    );
  });

  it('still normalizes non-object --args for non-paginated tools', async () => {
    setupClient();
    mocks.session.tools.call.mockResolvedValueOnce({ value: 'hello' });

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
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
        'null',
        '--session',
        'session-1',
      ],
      { from: 'node' },
    );

    expect(mocks.session.tools.call).toHaveBeenCalledWith(null);
    expect(stdoutWrite).toHaveBeenCalledWith('{"value":"hello"}\n');
  });

  it('validates declared row fields before invoking the remote tool', async () => {
    setupClient();
    setupPaginatedTool(networkRequestFields);

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
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
        '--fields',
        'name',
        '--session',
        'session-1',
      ],
      { from: 'node' },
    );

    expect(mocks.session.tools.call).not.toHaveBeenCalled();
    expect(stdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining(
        '"message":"Unknown fields: name. Allowed fields: requestId, method, url, status',
      ),
    );
  });

  it('degrades to unshaped output on stdout with a stderr warning for invalid pagination metadata', async () => {
    setupClient();
    mocks.session.tools.resolve.mockResolvedValue({
      domainId: 'broken-plugin',
      schema: {
        name: 'plugin.list',
        shortName: 'list',
        inputSchema: { type: 'object', properties: {} },
        pagination: { kind: 'cursor', fields: [] },
      },
      call: mocks.session.tools.call,
    });
    const result = {
      items: [{ id: 'one' }],
      page: { limit: 20, hasMore: false },
    };
    mocks.session.tools.call.mockResolvedValueOnce(result);

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(
      [
        'node',
        'test',
        'agent',
        'broken-plugin',
        'call',
        '--tool',
        'list',
        '--args',
        '{}',
        '--session',
        'session-1',
      ],
      { from: 'node' },
    );

    expect(stdoutWrite).toHaveBeenCalledWith(`${JSON.stringify(result)}\n`);
    expect(stderrWrite).toHaveBeenCalledWith(
      expect.stringContaining('invalid pagination metadata'),
    );
  });

  it('degrades to unshaped output when tool metadata collides with a shaped output key', async () => {
    setupClient();
    setupPaginatedTool(networkRequestFields);
    const result = {
      cols: 'owned by the tool, not the shaping contract',
      items: [
        { requestId: 'one', method: 'GET', url: '/', status: 200 },
        { requestId: 'two', method: 'POST', url: '/two', status: null },
      ],
      page: { limit: 20, hasMore: false },
    };
    mocks.session.tools.call.mockResolvedValueOnce(result);

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
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

    expect(stdoutWrite).toHaveBeenCalledWith(`${JSON.stringify(result)}\n`);
  });

  it('elides columns that are null on every row of a default projection', async () => {
    setupClient();
    setupPaginatedTool(networkRequestFields);
    mocks.session.tools.call.mockResolvedValueOnce({
      items: [
        { requestId: 'one', method: 'GET', url: '/', status: 200 },
        { requestId: 'two', method: 'POST', url: '/two', status: null },
      ],
      page: { limit: 20, hasMore: false },
    });

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
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
      '{"cols":["requestId","method","url","status"],"rows":[["one","GET","/",200],["two","POST","/two",null]]}\n',
    );
  });

  it('leaves a plugin tool with a colliding short name unchanged', async () => {
    setupClient();
    const result = {
      items: [{ pluginValue: 'preserve me' }],
      page: { limit: 1, hasMore: false },
    };
    mocks.session.tools.call.mockResolvedValueOnce(result);

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(
      [
        'node',
        'test',
        'agent',
        'third-party-plugin',
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

    expect(stdoutWrite).toHaveBeenCalledWith(`${JSON.stringify(result)}\n`);
  });

  it('shapes an arbitrary third-party plugin from its declared pagination metadata', async () => {
    setupClient();
    setupPaginatedTool(['url', 'requestId', 'status']);
    mocks.session.tools.call.mockResolvedValueOnce({
      items: [
        { requestId: 'request-1', url: 'https://example.test' },
        {
          requestId: 'request-2',
          url: 'https://example.test/two',
          status: 200,
        },
      ],
      page: { limit: 2, hasMore: false },
    });

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(
      [
        'node',
        'test',
        'agent',
        'at-rozenite__network-activity-plugin',
        'call',
        '--tool',
        'listRequests',
        '--args',
        '{}',
        '--fields',
        'url,requestId,status',
        '--session',
        'session-1',
      ],
      { from: 'node' },
    );

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"cols":["url","requestId","status"],"rows":[["https://example.test","request-1",null],["https://example.test/two","request-2",200]]}\n',
    );
  });

  it('uses a third-party tool default projection without a CLI allowlist', async () => {
    setupClient();
    setupPaginatedTool(['id', 'label', 'details'], ['id', 'label']);
    mocks.session.tools.call.mockResolvedValueOnce({
      items: [
        { id: 'one', label: 'First', details: { size: 1 } },
        { id: 'two', label: 'Second', details: { size: 2 } },
      ],
      page: { limit: 2, hasMore: false },
    });

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(
      [
        'node',
        'test',
        'agent',
        '@example/plugin',
        'call',
        '--tool',
        'list',
        '--session',
        'session-1',
      ],
      { from: 'node' },
    );

    expect(stdoutWrite).toHaveBeenCalledWith(
      '{"cols":["id","label"],"rows":[["one","First"],["two","Second"]]}\n',
    );
  });

  it('drops connection options and --pretty from listing continuations', async () => {
    setupClient();
    mocks.session.tools.list.mockResolvedValue([
      {
        name: 'network.getRequestDetails',
        shortName: 'getRequestDetails',
        domainId: 'network',
      },
      {
        name: 'network.listRequests',
        shortName: 'listRequests',
        domainId: 'network',
      },
    ]);

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const program = new Command();
    registerAgentCommand(program);

    await program.parseAsync(
      [
        'node',
        'test',
        'agent',
        'network domain',
        'tools',
        '--session',
        'session id',
        '--limit',
        '1',
        '--pretty',
      ],
      { from: 'node' },
    );

    const output = JSON.parse(String(stdoutWrite.mock.calls[0][0]));
    expect(output.next).toBe(
      `npx rozenite agent network --limit 1 --cursor ${listingCursor('getRequestDetails', 'domain:network')}`,
    );
  });

  it('prints JSON errors for agent command failures', async () => {
    setupClient();
    mocks.client.targets.list.mockRejectedValue(
      new Error(
        'Unable to reach Metro at http://127.0.0.1:8081. Make sure Metro is running and reachable, then try again.',
      ),
    );

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

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

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

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
      ['node', 'test', 'agent', 'targets', '--host', '10.0.0.5', '--port', '9090'],
      {
        from: 'node',
      },
    );

    expect(mocks.createAgentClient).toHaveBeenCalledWith({
      host: '10.0.0.5',
      port: 9090,
    });
  });

  describe('grammar v3', () => {
    const consoleSchema = {
      name: 'getMessages',
      shortName: 'getMessages',
      description: 'Read console messages.',
      inputSchema: {
        type: 'object',
        properties: {
          levels: { type: 'array', items: { type: 'string' } },
          search: { type: 'string' },
          limit: { type: 'integer' },
          cursor: { type: 'string' },
        },
      },
      pagination: { kind: 'cursor', fields: ['seq', 'level', 'text', 'source'] },
    };

    const setupConsoleTool = (schema: Record<string, unknown> = consoleSchema) => {
      mocks.session.tools.resolve.mockResolvedValue({
        domainId: 'console',
        schema,
        call: mocks.session.tools.call,
      });
    };

    const createdSession = (overrides: Record<string, unknown> = {}) => ({
      session: {
        id: 'device-1-1',
        deviceId: 'device-1-1',
        deviceName: 'iPhone 17',
        status: 'connected',
        createdAt: Date.now() + 1_000,
        ...overrides,
      },
    });

    const run = async (...argv: string[]) => {
      const program = new Command();
      registerAgentCommand(program);
      await program.parseAsync(['node', 'test', 'agent', ...argv], { from: 'node' });
    };

    const output = (stdoutWrite: { mock: { calls: unknown[][] } }) =>
      stdoutWrite.mock.calls.map(([chunk]) => String(chunk)).join('');

    const ENV_KEYS = ['ROZENITE_SESSION', 'ROZENITE_DEVICE'] as const;
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
      for (const key of ENV_KEYS) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }
    });

    afterEach(() => {
      for (const key of ENV_KEYS) {
        if (savedEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = savedEnv[key];
        }
      }
    });

    it('calls a tool with schema-derived flags on an implicit session', async () => {
      setupClient();
      setupConsoleTool();
      mocks.transport.createSession.mockResolvedValue(createdSession({ createdAt: 1 }));
      mocks.session.tools.call.mockResolvedValueOnce({
        items: [],
        page: { limit: 5, hasMore: false },
      });
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run(
        'console',
        'getMessages',
        '--levels',
        'error,warning',
        '--search',
        'boom',
        '--limit',
        '5',
      );

      expect(mocks.transport.createSession).toHaveBeenCalledWith({
        deviceId: undefined,
        cliVersion: getPackageJSON().version,
      });
      expect(mocks.client.attachSession).toHaveBeenCalledWith('device-1-1');
      expect(mocks.session.tools.resolve).toHaveBeenCalledWith({
        domain: 'console',
        tool: 'getMessages',
      });
      expect(mocks.session.tools.call).toHaveBeenCalledWith({
        levels: ['error', 'warning'],
        search: 'boom',
        limit: 5,
      });
    });

    it('merges --args under explicit flags', async () => {
      setupClient();
      setupConsoleTool();
      mocks.session.tools.call.mockResolvedValueOnce({
        items: [],
        page: { limit: 20, hasMore: false },
      });
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run(
        'console',
        'getMessages',
        '--args',
        '{"levels":["log"],"search":"kept"}',
        '--levels',
        'error',
        '--session',
        'session-1',
      );

      expect(mocks.session.tools.call).toHaveBeenCalledWith({ levels: ['error'], search: 'kept' });
    });

    it('parses every old spelling to the same call as the new one', async () => {
      const spellings = [
        ['console', 'getMessages', '--levels', 'error', '--limit', '3'],
        ['console', 'call', '--tool', 'getMessages', '--args', '{"levels":["error"],"limit":3}'],
        ['console', 'call-tool', '-t', 'getMessages', '-a', '{"levels":["error"],"limit":3}'],
        ['console', 'getMessages', '--args', '{"levels":["error"],"limit":3}'],
        ['console', 'call', '--tool', 'getMessages', '--levels', 'error', '-n', '3'],
      ];

      for (const spelling of spellings) {
        vi.clearAllMocks();
        setupClient();
        setupConsoleTool();
        mocks.session.tools.call.mockResolvedValueOnce({ value: 1 });
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

        await run(...spelling, '--session', 'session-1', '--json');

        expect(mocks.session.tools.resolve, spelling.join(' ')).toHaveBeenCalledWith({
          domain: 'console',
          tool: 'getMessages',
        });
        expect(mocks.session.tools.call, spelling.join(' ')).toHaveBeenCalledWith({
          levels: ['error'],
          limit: 3,
        });
      }
    });

    it('parses old discovery spellings to the same requests as the new ones', async () => {
      const listings = [['console'], ['console', 'tools'], ['console', 'list-tools']];
      for (const spelling of listings) {
        vi.clearAllMocks();
        setupClient();
        mocks.session.tools.list.mockResolvedValue([]);
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        await run(...spelling, '--session', 'session-1');
        expect(mocks.session.tools.list, spelling.join(' ')).toHaveBeenCalledWith({
          domain: 'console',
        });
      }

      const schemas = [
        ['console', 'getMessages', '--schema'],
        ['console', 'schema', '--tool', 'getMessages'],
        ['console', 'get-tool-schema', '-t', 'getMessages'],
      ];
      for (const spelling of schemas) {
        vi.clearAllMocks();
        setupClient();
        mocks.session.tools.getSchema.mockResolvedValue({ name: 'getMessages' });
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        await run(...spelling, '--session', 'session-1');
        expect(mocks.session.tools.getSchema, spelling.join(' ')).toHaveBeenCalledWith({
          domain: 'console',
          tool: 'getMessages',
        });
      }

      for (const spelling of [['domains'], ['list-domains']]) {
        vi.clearAllMocks();
        setupClient();
        mocks.session.domains.list.mockResolvedValue([{ id: 'console', kind: 'static' }]);
        const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        await run(...spelling, '--session', 'session-1');
        expect(output(stdoutWrite), spelling.join(' ')).toBe(
          '{"items":[{"id":"console","kind":"static","availability":"supported"}]}\n',
        );
      }
    });

    it('treats --verbose as --fields all and --deviceId as --device', async () => {
      setupClient();
      mocks.transport.createSession.mockResolvedValue(createdSession({ createdAt: 1 }));
      mocks.session.tools.list.mockResolvedValue([
        { name: 'console.a', shortName: 'a', description: 'A' },
        { name: 'console.b', shortName: 'b', description: 'B' },
      ]);
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run('console', '-v', '--deviceId', 'device-1');
      const verbose = output(stdoutWrite);
      expect(mocks.transport.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: 'device-1' }),
      );

      stdoutWrite.mockClear();
      await run('console', '--fields', 'all', '--device', 'device-1');
      expect(output(stdoutWrite)).toBe(verbose);
      expect(verbose).toBe(
        '{"cols":["name","description","readOnly","destructive","idempotent"],"rows":[["a","A",null,null,null],["b","B",null,null,null]]}\n',
      );
    });

    it('elides trait columns nobody declares from a default tool listing', async () => {
      setupClient();
      mocks.session.tools.list.mockResolvedValue([
        { name: 'console.a', shortName: 'a', description: 'A' },
        { name: 'console.b', shortName: 'b', description: 'B' },
      ]);
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run('console', '--session', 'session-1');

      expect(output(stdoutWrite)).toBe(
        '{"cols":["name","description"],"rows":[["a","A"],["b","B"]]}\n',
      );
    });

    it('keeps the qualified name for short names two tools share', async () => {
      setupClient();
      mocks.session.tools.list.mockResolvedValue([
        { name: 'app.alpha.echo', shortName: 'echo', description: 'A' },
        { name: 'app.beta.echo', shortName: 'echo', description: 'B' },
        { name: 'app.ping', shortName: 'ping', description: 'C' },
      ]);
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run('app', '--session', 'session-1', '--fields', 'name');

      expect(output(stdoutWrite)).toBe(
        '{"cols":["name"],"rows":[["app.alpha.echo"],["app.beta.echo"],["ping"]]}\n',
      );
    });

    describe('implicit session', () => {
      const setupImplicit = () => {
        setupClient();
        mocks.session.tools.list.mockResolvedValue([]);
        mocks.transport.createSession.mockResolvedValue(createdSession({ createdAt: 1 }));
        return vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      };

      it('uses --session without creating one', async () => {
        setupImplicit();
        await run('console', '--session', 'explicit-1');
        expect(mocks.transport.createSession).not.toHaveBeenCalled();
        expect(mocks.client.attachSession).toHaveBeenCalledWith('explicit-1');
      });

      it('uses ROZENITE_SESSION when --session is absent', async () => {
        setupImplicit();
        process.env.ROZENITE_SESSION = 'from-env';
        await run('console');
        expect(mocks.transport.createSession).not.toHaveBeenCalled();
        expect(mocks.client.attachSession).toHaveBeenCalledWith('from-env');

        vi.clearAllMocks();
        setupImplicit();
        await run('console', '--session', 'flag-wins');
        expect(mocks.client.attachSession).toHaveBeenCalledWith('flag-wins');
      });

      it('creates or reuses the session for --device, then ROZENITE_DEVICE', async () => {
        setupImplicit();
        await run('console', '--device', 'device-2');
        expect(mocks.transport.createSession).toHaveBeenCalledWith({
          deviceId: 'device-2',
          cliVersion: getPackageJSON().version,
        });
        expect(mocks.client.attachSession).toHaveBeenCalledWith('device-1-1');

        vi.clearAllMocks();
        setupImplicit();
        process.env.ROZENITE_DEVICE = 'device-env';
        await run('console');
        expect(mocks.transport.createSession).toHaveBeenCalledWith(
          expect.objectContaining({ deviceId: 'device-env' }),
        );
      });

      it('uses the only connected target when no device is named', async () => {
        setupImplicit();
        await run('domains');
        expect(mocks.transport.createSession).toHaveBeenCalledWith({
          deviceId: undefined,
          cliVersion: getPackageJSON().version,
        });
        expect(mocks.transport.listTargets).not.toHaveBeenCalled();
      });

      it('lists the targets when more than one device is connected', async () => {
        const stdoutWrite = setupImplicit();
        mocks.transport.createSession.mockRejectedValue(
          new Error(
            'Multiple connected devices detected. Run `rozenite agent targets` and provide --deviceId <id>.',
          ),
        );
        mocks.transport.listTargets.mockResolvedValue({
          targets: [
            { id: 'ios-1', name: 'iPhone 17', integration: 'react-native' },
            { id: 'android-1', name: 'Pixel 9', integration: 'react-native' },
          ],
        });

        await run('console', 'getMessages');

        expect(mocks.session.tools.resolve).not.toHaveBeenCalled();
        expect(output(stdoutWrite)).toBe(
          '{"error":{"message":"More than one device is connected. Pass --device <id> or set ROZENITE_DEVICE. Targets: ios-1 (iPhone 17, react-native); android-1 (Pixel 9, react-native)."}}\n',
        );
        expect(process.exitCode).toBe(1);
      });

      it('says once on stderr which device a new session attached to', async () => {
        setupImplicit();
        const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        mocks.transport.createSession.mockResolvedValue(createdSession());

        await run('console');
        expect(stderrWrite).toHaveBeenCalledWith(
          'Started an agent session on iPhone 17. Stop it when done: npx rozenite agent session stop\n',
        );

        stderrWrite.mockClear();
        mocks.transport.createSession.mockResolvedValue(createdSession({ createdAt: 1 }));
        await run('console');
        expect(stderrWrite).not.toHaveBeenCalled();
      });

      it('stops the resolved session when session stop has no id', async () => {
        const stdoutWrite = setupImplicit();
        mocks.transport.listSessions.mockResolvedValue({
          sessions: [
            { id: 'device-1-1', deviceId: 'device-1-1', deviceName: 'iPhone', status: 'connected' },
          ],
        });
        mocks.transport.stopSession.mockResolvedValue({ stopped: true });

        await run('session', 'stop');

        expect(mocks.transport.createSession).not.toHaveBeenCalled();
        expect(mocks.transport.stopSession).toHaveBeenCalledWith('device-1-1');
        expect(output(stdoutWrite)).toBe('{"stopped":true}\n');
      });

      it('picks the device session to stop, and refuses to guess between several', async () => {
        const stdoutWrite = setupImplicit();
        mocks.transport.listSessions.mockResolvedValue({
          sessions: [
            { id: 'ios-1', deviceId: 'ios-1', deviceName: 'iPhone', status: 'connected' },
            { id: 'android-1', deviceId: 'android-1', deviceName: 'Pixel', status: 'connected' },
          ],
        });
        mocks.transport.stopSession.mockResolvedValue({ stopped: true });

        await run('session', 'stop', '--device', 'android');
        expect(mocks.transport.stopSession).toHaveBeenCalledWith('android-1');

        mocks.transport.stopSession.mockClear();
        stdoutWrite.mockClear();
        await run('session', 'stop');
        expect(mocks.transport.stopSession).not.toHaveBeenCalled();
        expect(output(stdoutWrite)).toContain('More than one agent session is running');

        await run('session', 'stop', 'ios-1');
        expect(mocks.transport.stopSession).toHaveBeenCalledWith('ios-1');
      });
    });

    it('fails on an unknown flag with the tool arguments, before calling the tool', async () => {
      setupClient();
      setupConsoleTool();
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run('console', 'getMessages', '--level', 'error', '--session', 'session-1');

      expect(mocks.session.tools.call).not.toHaveBeenCalled();
      expect(output(stdoutWrite)).toBe(
        `{"error":{"message":"Unknown option \\"--level\\" for tool \\"getMessages\\". Its arguments: --levels, --search. Pass anything else with --args '<json>'."}}\n`,
      );
    });

    it('prints a next command in the new grammar, with only --cursor changed', async () => {
      setupClient();
      setupConsoleTool();
      mocks.session.tools.call.mockResolvedValueOnce({
        items: [
          { seq: 119, level: 'error', text: 'a' },
          { seq: 120, level: 'error', text: 'b' },
        ],
        page: { limit: 2, hasMore: true, nextCursor: '120' },
      });
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run(
        'console',
        'getMessages',
        '--levels',
        'error',
        '--cursor',
        '118',
        '--session',
        'session-1',
        '--host',
        '127.0.0.1',
        '--pretty',
      );

      const printed = JSON.parse(output(stdoutWrite));
      expect(printed.next).toBe(
        'npx rozenite agent console getMessages --levels error --cursor 120',
      );
      expect(mocks.session.tools.call).toHaveBeenCalledWith({ levels: ['error'], cursor: '118' });
    });

    it('rejects --fields for a tool that declares no rows', async () => {
      setupClient();
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run('app', 'echo', '--fields', 'value', '--session', 'session-1');

      expect(mocks.session.tools.call).not.toHaveBeenCalled();
      expect(output(stdoutWrite)).toContain('does not declare row fields');
    });

    it('prints only the metadata a paginated tool declares', async () => {
      setupClient();
      setupConsoleTool({
        ...consoleSchema,
        pagination: { ...consoleSchema.pagination, meta: ['total'] },
      });
      mocks.session.tools.call.mockResolvedValueOnce({
        total: 9,
        recording: { isRecording: true },
        items: [{ seq: 1, level: 'log', text: 'x' }],
        page: { limit: 20, hasMore: false },
      });
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run('console', 'getMessages', '--session', 'session-1');

      expect(output(stdoutWrite)).toBe(
        '{"total":9,"items":[{"seq":1,"level":"log","text":"x"}]}\n',
      );
    });

    it('reads rows from a declared itemsKey', async () => {
      setupClient();
      setupConsoleTool({
        name: 'file-system.list-entries',
        shortName: 'list-entries',
        inputSchema: { type: 'object', properties: {} },
        pagination: {
          kind: 'cursor',
          fields: ['name', 'size'],
          itemsKey: 'entries',
          meta: ['path'],
        },
      });
      mocks.session.tools.call.mockResolvedValueOnce({
        provider: 'expo',
        path: '/docs',
        entries: [
          { name: 'a', size: 1 },
          { name: 'b', size: 2 },
        ],
        page: { limit: 20, hasMore: false },
      });
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run('file-system', 'list-entries', '--session', 'session-1');

      expect(output(stdoutWrite)).toBe(
        '{"path":"/docs","cols":["name","size"],"rows":[["a",1],["b",2]]}\n',
      );
    });

    it('shapes a non-paginated tool that declares rows', async () => {
      setupClient();
      setupConsoleTool({
        name: '@rozenite/storage-plugin.list-storages',
        shortName: 'list-storages',
        inputSchema: { type: 'object', properties: {} },
        rows: { key: 'storages', fields: ['id', 'name', 'adapter'], defaultFields: ['id', 'name'] },
      });
      const result = {
        storages: [
          { id: 'mmkv', name: 'MMKV', adapter: 'mmkv' },
          { id: 'async', name: 'AsyncStorage', adapter: 'async-storage' },
        ],
      };
      mocks.session.tools.call.mockResolvedValue(result);
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run('storage', 'list-storages', '--session', 'session-1');
      expect(output(stdoutWrite)).toBe(
        '{"cols":["id","name"],"rows":[["mmkv","MMKV"],["async","AsyncStorage"]]}\n',
      );

      stdoutWrite.mockClear();
      await run('storage', 'list-storages', '--fields', 'adapter', '--session', 'session-1');
      expect(output(stdoutWrite)).toBe(
        '{"cols":["adapter"],"rows":[["mmkv"],["async-storage"]]}\n',
      );

      stdoutWrite.mockClear();
      await run('storage', 'list-storages', '--fields', 'nope', '--session', 'session-1');
      expect(output(stdoutWrite)).toContain(
        'Unknown fields: nope. Allowed fields: id, name, adapter',
      );
    });

    it('keeps a column --fields named even when it is null on every row', async () => {
      setupClient();
      setupPaginatedTool(networkRequestFields);
      mocks.session.tools.call.mockResolvedValueOnce({
        items: [
          { requestId: 'one', status: null },
          { requestId: 'two', status: null },
        ],
        page: { limit: 20, hasMore: false },
      });
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run(
        'network',
        'listRequests',
        '--fields',
        'requestId,status',
        '--session',
        'session-1',
      );

      expect(output(stdoutWrite)).toBe(
        '{"cols":["requestId","status"],"rows":[["one",null],["two",null]]}\n',
      );
    });

    it('generates tool help from the schema', async () => {
      setupClient();
      setupConsoleTool();
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      mocks.session.tools.list.mockResolvedValue([
        { name: 'getMessages', shortName: 'getMessages', description: 'Read console messages.' },
      ]);

      await run('console', 'getMessages', '--help', '--session', 'session-1');

      const help = output(stdoutWrite);
      expect(help).toContain('Usage: rozenite agent console getMessages [options]');
      expect(help).toContain('Read console messages.');
      expect(help).toContain('--levels <string,...>');
      expect(help).toContain('--fields <csv|all>');
      expect(mocks.session.tools.call).not.toHaveBeenCalled();
    });

    it('shapes targets as rows and pages them with the CLI pager', async () => {
      setupClient();
      mocks.client.targets.list.mockResolvedValue([
        { id: 'ios-1', name: 'iPhone', integration: 'react-native', appId: 'a', deviceId: 'ios' },
        {
          id: 'android-1',
          name: 'Pixel',
          integration: 'react-native',
          appId: 'b',
          deviceId: 'android',
        },
        { id: 'lynx-1', name: 'Lynx', integration: 'lynx', appId: 'c', deviceId: 'lynx' },
      ]);
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run('targets');
      expect(output(stdoutWrite)).toBe(
        '{"cols":["id","name","integration"],"rows":[["ios-1","iPhone","react-native"],["android-1","Pixel","react-native"],["lynx-1","Lynx","lynx"]]}\n',
      );

      stdoutWrite.mockClear();
      await run('targets', '--fields', 'id,appId', '--limit', '2');
      expect(output(stdoutWrite)).toBe(
        `{"cols":["id","appId"],"rows":[["ios-1","a"],["android-1","b"]],"next":"npx rozenite agent targets --fields id,appId --limit 2 --cursor ${listingCursor('android-1', 'targets')}"}\n`,
      );
    });

    it('shapes session list as rows', async () => {
      setupClient();
      mocks.transport.listSessions.mockResolvedValue({
        sessions: [
          { id: 's-1', deviceName: 'iPhone', status: 'connected', toolCount: 3 },
          { id: 's-2', deviceName: 'Pixel', status: 'connecting', toolCount: 0 },
        ],
      });
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run('session', 'list');

      expect(output(stdoutWrite)).toBe(
        '{"cols":["id","deviceName","status"],"rows":[["s-1","iPhone","connected"],["s-2","Pixel","connecting"]]}\n',
      );
    });

    it('rejects a tool name given after flags with a pointer to the grammar', async () => {
      setupClient();
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run('console', '--limit', '5', 'getMessages', '--session', 'session-1');

      expect(output(stdoutWrite)).toContain('Unexpected argument \\"getMessages\\"');
    });
  });
});
