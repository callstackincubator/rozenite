import { describe, expect, it } from 'vitest';
import type { JSONSchema7 } from '@rozenite/agent-shared';
import {
  buildToolArguments,
  formatToolHelp,
  parseDomainInvocation,
  parseToolFlags,
  renderToolArguments,
} from '../commands/agent/tool-flags.js';

const schema: JSONSchema7 = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Node id' },
    depth: { type: 'integer' },
    ratio: { type: 'number' },
    noHost: { type: 'boolean' },
    levels: { type: 'array', items: { type: 'string', enum: ['log', 'error', 'warning'] } },
    ids: { type: 'array', items: { type: 'integer' } },
    action: { type: 'object' },
    anything: {},
    level: { enum: ['debug', 'info'] },
    maybe: { type: ['string', 'null'] },
    limit: { type: 'integer' },
    cursor: { type: 'string' },
    session: { type: 'string' },
    fields: { type: 'array', items: { type: 'string' } },
  },
  required: ['id'],
};

const parse = (tokens: string[]) =>
  parseToolFlags(tokens, { toolLabel: 'tool', inputSchema: schema });

describe('parseDomainInvocation', () => {
  it('splits positionals, CLI-owned flags and tool flags', () => {
    expect(
      parseDomainInvocation([
        'console',
        'getMessages',
        '--levels',
        'error',
        '--limit',
        '5',
        '--fields=seq,text',
        '--cursor',
        'abc',
        '--noHost',
        '--args',
        '{"a":1}',
        '--schema',
      ]),
    ).toEqual({
      positionals: ['console', 'getMessages'],
      cli: { limit: '5', fields: 'seq,text', cursor: 'abc', args: '{"a":1}', schema: true },
      toolTokens: ['--levels', 'error', '--noHost'],
    });
  });

  it('reads the old spellings', () => {
    expect(
      parseDomainInvocation([
        'react',
        'call',
        '-t',
        'getTree',
        '-a',
        '{}',
        '-v',
        '-n',
        '3',
        '-c',
        'x',
      ]),
    ).toEqual({
      positionals: ['react', 'call'],
      cli: { tool: 'getTree', args: '{}', verbose: true, limit: '3', cursor: 'x' },
      toolTokens: [],
    });
  });

  it('fails when a CLI flag has no value', () => {
    expect(() => parseDomainInvocation(['react', 'getTree', '--limit'])).toThrow(
      '--limit requires a value.',
    );
  });
});

describe('parseToolFlags', () => {
  it('reads primitives with their schema types', () => {
    expect(
      parse(['--id', '@c12', '--depth', '3', '--ratio', '0.5', '--noHost', '--maybe', 'x']),
    ).toEqual({ id: '@c12', depth: 3, ratio: 0.5, noHost: true, maybe: 'x' });
    expect(parse(['--noHost', 'false', '--id=a'])).toEqual({ noHost: false, id: 'a' });
    expect(parse(['--level', 'info'])).toEqual({ level: 'info' });
  });

  it('keeps a string value that looks like a flag or a number', () => {
    expect(parse(['--id', '-5'])).toEqual({ id: '-5' });
    expect(parse(['--id', '12'])).toEqual({ id: '12' });
  });

  it('reads arrays repeated, comma-separated, or as JSON', () => {
    expect(parse(['--levels', 'error,warning'])).toEqual({ levels: ['error', 'warning'] });
    expect(parse(['--levels', 'error', '--levels', 'warning'])).toEqual({
      levels: ['error', 'warning'],
    });
    expect(parse(['--ids', '1,2', '--ids', '3'])).toEqual({ ids: [1, 2, 3] });
    expect(parse(['--levels', '["a,b"]'])).toEqual({ levels: ['a,b'] });
  });

  it('reads objects as JSON and untyped values as JSON or text', () => {
    expect(parse(['--action', '{"type":"counter/increment"}'])).toEqual({
      action: { type: 'counter/increment' },
    });
    expect(parse(['--anything', '{"a":1}', '--maybe', 'y'])).toEqual({
      anything: { a: 1 },
      maybe: 'y',
    });
    expect(parse(['--anything', 'plain text'])).toEqual({ anything: 'plain text' });
  });

  it('accepts a flag spelled with different case, hyphens or underscores', () => {
    expect(parse(['--no-host', '--NOHOST', 'true'])).toEqual({ noHost: true });
  });

  it('rejects malformed values', () => {
    expect(() => parse(['--depth', 'x'])).toThrow('--depth expects an integer, got "x".');
    expect(() => parse(['--depth', '1.5'])).toThrow('--depth expects an integer');
    expect(() => parse(['--ratio', ''])).toThrow('--ratio expects a number');
    expect(() => parse(['--action', '{oops'])).toThrow('--action expects JSON');
    expect(() => parse(['--id'])).toThrow('--id requires a value.');
  });

  it('fails on an unknown flag with the tool argument names', () => {
    expect(() => parse(['--nope', '1'])).toThrow(
      `Unknown option "--nope" for tool "tool". Its arguments: --id, --depth, --ratio, --noHost, --levels, --ids, --action, --anything, --level, --maybe. Pass anything else with --args '<json>'.`,
    );
  });

  it('never derives a flag from an argument named like a CLI-owned flag', () => {
    expect(() => parse(['--session', 'x'])).toThrow(/Unknown option "--session"/);
    expect(() => parse(['--limit', '1'])).toThrow(/Unknown option "--limit"/);
  });

  it('fails on a stray positional', () => {
    expect(() => parse(['extra'])).toThrow('Unexpected argument "extra" for tool "tool".');
  });

  it('says when a tool takes no flags', () => {
    expect(() =>
      parseToolFlags(['--x', '1'], { toolLabel: 'ping', inputSchema: undefined }),
    ).toThrow('It takes no arguments as flags.');
  });
});

describe('buildToolArguments', () => {
  const base = {
    flagArgs: {},
    acceptsPaging: { limit: true, cursor: true },
    toolLabel: 'tool',
    requireObject: false,
  };

  it('merges explicit flags over --args, and --limit/--cursor over both', () => {
    expect(
      buildToolArguments({
        ...base,
        argsJson: { levels: ['log'], limit: 50, cursor: 'old', keep: true },
        flagArgs: { levels: ['error'] },
        limit: '10',
        cursor: 'new',
      }),
    ).toEqual({ levels: ['error'], limit: 10, cursor: 'new', keep: true });
  });

  it('passes a non-object --args through when nothing else is given', () => {
    expect(buildToolArguments({ ...base, argsJson: null })).toBeNull();
    expect(() => buildToolArguments({ ...base, argsJson: null, requireObject: true })).toThrow(
      '--args must be a JSON object',
    );
    expect(() => buildToolArguments({ ...base, argsJson: [1], flagArgs: { a: 1 } })).toThrow(
      '--args must be a JSON object',
    );
  });

  it('rejects --limit and --cursor for a tool that does not page', () => {
    const noPaging = { ...base, argsJson: {}, acceptsPaging: { limit: false, cursor: false } };
    expect(() => buildToolArguments({ ...noPaging, limit: '1' })).toThrow(
      'Tool "tool" does not page its results; --limit does not apply.',
    );
    expect(() => buildToolArguments({ ...noPaging, cursor: 'c' })).toThrow(
      /--cursor does not apply/,
    );
  });
});

describe('renderToolArguments', () => {
  it('renders arguments as the flags that parse back to them', () => {
    const args = {
      id: 'two words',
      depth: 2,
      noHost: true,
      levels: ['error', 'warning'],
      action: { type: 'x' },
      limit: 10,
      cursor: 'dropped',
    };
    const rendered = renderToolArguments(args, schema);
    expect(rendered).toEqual([
      '--id',
      'two words',
      '--depth',
      '2',
      '--noHost',
      '--levels',
      'error,warning',
      '--action',
      '{"type":"x"}',
      '--limit',
      '10',
    ]);

    const { positionals, cli, toolTokens } = parseDomainInvocation(['d', 't', ...rendered]);
    expect(positionals).toEqual(['d', 't']);
    expect({ ...parse(toolTokens), limit: Number(cli.limit) }).toEqual({
      id: 'two words',
      depth: 2,
      noHost: true,
      levels: ['error', 'warning'],
      action: { type: 'x' },
      limit: 10,
    });
  });

  it('falls back to --args for what a flag cannot carry', () => {
    expect(
      renderToolArguments(
        {
          noHost: false,
          levels: ['a,b'],
          undeclared: 1,
          session: 'reserved',
          depth: 'not a number',
          anything: '{"looks":"like json"}',
        },
        schema,
      ),
    ).toEqual([
      '--noHost',
      'false',
      '--levels',
      '["a,b"]',
      '--args',
      '{"undeclared":1,"session":"reserved","depth":"not a number","anything":"{\\"looks\\":\\"like json\\"}"}',
    ]);
  });
});

describe('formatToolHelp', () => {
  it('describes derived flags, --args-only arguments and the CLI options', () => {
    const help = formatToolHelp({
      domain: 'react',
      tool: 'getNode',
      description: 'Read one node.',
      inputSchema: schema,
      fields: { fields: ['id', 'name'], defaultFields: ['id'] },
      paged: true,
    });

    expect(help).toContain('Usage: rozenite agent react getNode [options]');
    expect(help).toContain('Read one node.');
    expect(help).toMatch(/--id <string>\s+Node id \(required\)/);
    expect(help).toMatch(/--levels <string,\.\.\.>\s+One of: log, error, warning\./);
    expect(help).toMatch(/\n {2}--noHost\n/);
    expect(help).toContain('Through --args only: session, fields');
    expect(help).toMatch(/--fields <csv\|all>\s+Columns to print: id, name \(default: id\)/);
    expect(help).toContain('--limit <n>');
    expect(help).not.toMatch(/\bcall\b|--tool/);
  });
});
