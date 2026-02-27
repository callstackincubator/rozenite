import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveMCPSkillRootFrom } from '../commands/mcp/skill-path.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPackageRoot = path.resolve(testDir, '..', '..');

describe('mcp skill path resolver', () => {
  it('resolves MCP skills from source-like command path', () => {
    const sourceLikeStart = path.join(cliPackageRoot, 'src', 'commands', 'mcp');
    const resolved = resolveMCPSkillRootFrom(sourceLikeStart);

    expect(resolved).toBe(path.join(cliPackageRoot, 'skills', 'mcp'));
  });

  it('resolves MCP skills from dist-like command path', () => {
    const distLikeStart = path.join(cliPackageRoot, 'dist', 'commands', 'mcp');
    const resolved = resolveMCPSkillRootFrom(distLikeStart);

    expect(resolved).toBe(path.join(cliPackageRoot, 'skills', 'mcp'));
  });

  it('resolves plugin domain doc path via MCP skill root', () => {
    const resolved = resolveMCPSkillRootFrom(path.join(cliPackageRoot, 'src'));
    const pluginDocPath = path.join(resolved, 'domains', 'plugins.md');

    expect(fs.existsSync(pluginDocPath)).toBe(true);
  });
});
