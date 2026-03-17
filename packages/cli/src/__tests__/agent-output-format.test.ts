import { afterEach, describe, expect, it, vi } from 'vitest';
import { printOutput } from '../commands/agent/output.js';

describe('agent output format', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints compact JSON by default', () => {
    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    printOutput({ a: 1, b: 'x' }, true);

    expect(stdoutWrite).toHaveBeenCalledWith('{"a":1,"b":"x"}\n');
  });

  it('prints pretty JSON when pretty flag is enabled', () => {
    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    printOutput({ a: 1 }, true, true);

    expect(stdoutWrite).toHaveBeenCalledWith('{\n  "a": 1\n}\n');
  });
});
