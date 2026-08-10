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

  // Structural markers that make a slash-adjacent mention a location
  // reference rather than prose. Bare `./` or `../` are deliberately
  // excluded: they show up constantly in legitimate, non-doc-referencing
  // content here, such as the `sdk` doc's plugin `./sdk` export subpath.
  // `core` also legitimately uses bare `scope/name`-shaped examples (e.g.
  // "evil/mmkv", "avasapp/ably") to illustrate plugin domain token
  // provenance; those aren't location references either. A `docs/`,
  // `domains/`, or `references/` directory marker in front of (or a ".md"
  // right after) a known doc id is what actually distinguishes a real
  // location reference like "domains/storage" or "./docs/core" from that
  // legitimate prose.
  const PATH_MARKERS = ['docs/', 'domains/', 'references/'];

  const isPathReference = (body: string, id: string): boolean => {
    if (new RegExp(`${id}\\.md`, 'i').test(body)) {
      return true;
    }

    return PATH_MARKERS.some((marker) => {
      const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`${escapedMarker}${id}(?:[^a-z0-9-]|$)`, 'i').test(body);
    });
  };

  it('flags marker-adjacent doc ids but not bare scope/name prose', () => {
    // Guards the `isPathReference` helper itself against the exact shapes
    // called out for this invariant, independent of current doc content.
    expect(isPathReference('see domains/storage.md for tools', 'storage')).toBe(true);
    expect(isPathReference('read ./docs/core first', 'core')).toBe(true);
    expect(isPathReference('read references/core.md', 'core')).toBe(true);
    expect(isPathReference('mmkv.md has the tools', 'mmkv')).toBe(true);

    expect(isPathReference('`evil/mmkv` and `mmkv` are never the same plugin', 'mmkv')).toBe(false);
    expect(isPathReference('`avasapp/ably` is a third-party scoped plugin', 'ably')).toBe(false);
    expect(isPathReference('run `npx rozenite skills show core`', 'core')).toBe(false);
    expect(isPathReference('call the plugin `./sdk` export', 'sdk')).toBe(false);
  });

  it('contains no cross-references between docs', () => {
    const registry = new SkillsRegistry();
    const ids = new Set(registry.list().map((doc) => doc.id));

    for (const doc of registry.list()) {
      // No doc may point at another doc by location: neither a bundled-repo
      // path like "domains/*.md" nor a "references/" directory.
      expect(doc.body).not.toMatch(/references\//i);
      expect(doc.body).not.toMatch(/domains\//i);

      for (const otherId of ids) {
        if (otherId === doc.id) {
          continue;
        }

        // A doc must not point at another doc by filename (e.g. "mmkv.md")
        // or by path (e.g. "domains/mmkv", "./docs/core"). Referring to the
        // id in prose with no path marker (e.g. "run `npx rozenite skills
        // show mmkv`", or the `core` doc's "evil/mmkv" provenance example)
        // is fine.
        expect(isPathReference(doc.body, otherId)).toBe(false);
      }
    }
  });
});
