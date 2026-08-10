import { describe, expect, it } from 'vitest';
import { SkillsRegistry } from '../skills/registry.js';

const NON_DOMAIN_IDS = ['core', 'cli', 'sdk', 'sdk-patterns'];

const DOMAIN_IDS = [
  'storage',
  'mmkv',
  'console',
  'network',
  'network-activity',
  'react',
  'react-navigation',
  'redux-devtools',
  'performance',
  'memory',
  'file-system',
  'controls',
  'tanstack-query',
];

describe('SkillsRegistry', () => {
  it('lists every expected doc id', () => {
    const registry = new SkillsRegistry();
    const ids = registry.list().map((doc) => doc.id);

    for (const id of [...NON_DOMAIN_IDS, ...DOMAIN_IDS]) {
      expect(ids).toContain(id);
    }
    expect(ids).toHaveLength(NON_DOMAIN_IDS.length + DOMAIN_IDS.length);
  });

  it('gives every doc a non-empty description', () => {
    const registry = new SkillsRegistry();

    for (const doc of registry.list()) {
      expect(doc.description.length).toBeGreaterThan(0);
    }
  });

  it('sets the domain field for every domain doc, and only those', () => {
    const registry = new SkillsRegistry();

    for (const id of DOMAIN_IDS) {
      const doc = registry.get(id);
      expect(doc?.domain).toBe(id);
    }

    for (const id of NON_DOMAIN_IDS) {
      const doc = registry.get(id);
      expect(doc?.domain).toBeUndefined();
    }
  });

  it('resolves domain docs by domain token', () => {
    const registry = new SkillsRegistry();

    for (const id of DOMAIN_IDS) {
      expect(registry.getByDomain(id)?.id).toBe(id);
    }
  });

  it('returns undefined for an unknown id or domain', () => {
    const registry = new SkillsRegistry();

    expect(registry.get('does-not-exist')).toBeUndefined();
    expect(registry.getByDomain('does-not-exist')).toBeUndefined();
  });

  it('contains no cross-references between docs', () => {
    const registry = new SkillsRegistry();
    const ids = new Set(registry.list().map((doc) => doc.id));

    for (const doc of registry.list()) {
      expect(doc.body).not.toMatch(/references\//i);

      for (const otherId of ids) {
        if (otherId === doc.id) {
          continue;
        }
        // A doc must not point at another doc by filename (e.g. "mmkv.md"
        // or "domains/mmkv.md"). Referring to the id in prose without ".md"
        // (e.g. "run `npx rozenite skills show mmkv`") is fine.
        expect(doc.body).not.toMatch(new RegExp(`${otherId}\\.md`));
      }
    }
  });
});
