import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveAgentSkillRootFrom } from '../commands/agent/skill-path.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPackageRoot = path.resolve(testDir, '..', '..');

describe('agent skill path resolver', () => {
  it('resolves Agent skills from source-like command path', () => {
    const sourceLikeStart = path.join(cliPackageRoot, 'src', 'commands', 'agent');
    const resolved = resolveAgentSkillRootFrom(sourceLikeStart);

    expect(resolved).toBe(path.join(cliPackageRoot, 'skills', 'agent'));
  });

  it('resolves Agent skills from dist-like command path', () => {
    const distLikeStart = path.join(cliPackageRoot, 'dist', 'commands', 'agent');
    const resolved = resolveAgentSkillRootFrom(distLikeStart);

    expect(resolved).toBe(path.join(cliPackageRoot, 'skills', 'agent'));
  });

  it('resolves plugin domain doc path via Agent skill root', () => {
    const resolved = resolveAgentSkillRootFrom(path.join(cliPackageRoot, 'src'));
    const pluginDocPath = path.join(resolved, 'domains', 'plugins.md');

    expect(fs.existsSync(pluginDocPath)).toBe(true);
  });
});
