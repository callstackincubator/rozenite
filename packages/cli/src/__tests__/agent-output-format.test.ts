import { afterEach, describe, expect, it, vi } from 'vitest';
import { printOutput } from '../commands/agent/output.js';

describe('agent output format', () => {
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    vi.restoreAllMocks();
    process.stdout.isTTY = originalIsTTY;
  });

  it('prints compact JSON when stdout is not a terminal', () => {
    process.stdout.isTTY = false;
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    printOutput({ a: 1, b: 'x' }, true);

    expect(stdoutWrite).toHaveBeenCalledWith('{"a":1,"b":"x"}\n');
  });

  it('indents JSON when stdout is a terminal', () => {
    process.stdout.isTTY = true;
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    printOutput({ a: 1 }, true);

    expect(stdoutWrite).toHaveBeenCalledWith('{\n  "a": 1\n}\n');
  });

  it('indents JSON on a pipe when --pretty is set', () => {
    process.stdout.isTTY = false;
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    printOutput({ a: 1 }, true, true);

    expect(stdoutWrite).toHaveBeenCalledWith('{\n  "a": 1\n}\n');
  });
});
