import { describe, expect, it } from 'vitest';
import { validatePluginReference, validatePluginReferences } from './utils';

const NPM = 'https://www.npmjs.com/package/rozenite-preview';
const GITHUB = 'https://github.com/matinzd/rozenite-preview';

const validate = (entry: unknown) => validatePluginReference(entry, 0);

describe('validatePluginReference', () => {
  it('returns the canonical form of a scoped package in a monorepo', () => {
    expect(
      validate({
        npmUrl: 'https://www.npmjs.com/package/@rozenite/storage-plugin',
        githubUrl:
          'https://github.com/callstackincubator/rozenite/tree/main/packages/storage-plugin',
      }),
    ).toEqual({
      packageName: '@rozenite/storage-plugin',
      npmUrl: 'https://www.npmjs.com/package/@rozenite/storage-plugin',
      githubUrl: 'https://github.com/callstackincubator/rozenite/tree/main/packages/storage-plugin',
      owner: 'callstackincubator',
      repo: 'rozenite',
    });
  });

  it('returns the canonical form of an unscoped package', () => {
    expect(validate({ npmUrl: `${NPM}/`, githubUrl: GITHUB })).toEqual({
      packageName: 'rozenite-preview',
      npmUrl: NPM,
      githubUrl: GITHUB,
      owner: 'matinzd',
      repo: 'rozenite-preview',
    });
  });

  it('drops the query and fragment of a GitHub URL', () => {
    expect(validate({ npmUrl: NPM, githubUrl: `${GITHUB}/issues?q=1#top` }).githubUrl).toBe(
      `${GITHUB}/issues`,
    );
  });

  it.each([
    ['javascript: URL', 'javascript:alert(1)'],
    ['http scheme', 'http://github.com/a/b'],
    ['look-alike subdomain', 'https://github.com.evil.com/a/b'],
    ['userinfo', 'https://x@github.com/a/b'],
    ['userinfo that spoofs the host', 'https://github.com@evil.com/a/b'],
    ['explicit port', 'https://github.com:443/a/b'],
    ['other host', 'https://gitlab.com/a/b'],
    ['no repository', 'https://github.com/a'],
    ['dot segments that leave no repository', 'https://github.com/a/%2e%2e'],
    ['encoded slash in the owner', 'https://github.com/a%2Fb/c'],
    ['encoded slash in the repository', 'https://github.com/a/b%2Fc'],
    ['owner that starts with a hyphen', 'https://github.com/-a/b'],
    ['repository named ..', 'https://github.com/a/..'],
    ['whitespace', 'https://github.com/a/b c'],
    ['empty string', ''],
  ])('rejects a githubUrl with %s', (_, githubUrl) => {
    expect(() => validate({ npmUrl: NPM, githubUrl })).toThrow(/githubUrl/);
  });

  it.each([
    ['javascript: URL', 'javascript:alert(1)'],
    ['http scheme', 'http://www.npmjs.com/package/foo'],
    ['npmjs.com without www', 'https://npmjs.com/package/foo'],
    ['look-alike host', 'https://www.npmjs.com.evil.com/package/foo'],
    ['userinfo', 'https://x@www.npmjs.com/package/foo'],
    ['explicit port', 'https://www.npmjs.com:443/package/foo'],
    ['uppercase name', 'https://www.npmjs.com/package/Foo'],
    ['query string', 'https://www.npmjs.com/package/foo?activeTab=versions'],
    ['fragment', 'https://www.npmjs.com/package/foo#readme'],
    ['extra path', 'https://www.npmjs.com/package/foo/v/1.0.0'],
    ['extra path on a scoped name', 'https://www.npmjs.com/package/@a/b/c'],
    ['leading underscore', 'https://www.npmjs.com/package/_foo'],
    ['leading dot', 'https://www.npmjs.com/package/.foo'],
    ['encoded slash', 'https://www.npmjs.com/package/@a%2Fb'],
    ['name over 214 characters', `https://www.npmjs.com/package/${'a'.repeat(215)}`],
    ['empty name', 'https://www.npmjs.com/package/'],
  ])('rejects an npmUrl with %s', (_, npmUrl) => {
    expect(() => validate({ npmUrl, githubUrl: GITHUB })).toThrow(/npmUrl/);
  });

  it.each([
    ['null', null],
    ['a string', 'https://www.npmjs.com/package/foo'],
    ['an object without githubUrl', { npmUrl: NPM }],
    ['an object without npmUrl', { githubUrl: GITHUB }],
    ['non-string fields', { npmUrl: 1, githubUrl: GITHUB }],
  ])('rejects %s', (_, entry) => {
    expect(() => validate(entry)).toThrow(/plugin-directory\.json entry 0/);
  });

  it('normalizes dot segments, so the request path stays /repos/<owner>/<repo>', () => {
    const attempts = [
      'https://github.com/a/b/../../x/y',
      'https://github.com/a/%2e%2e/%2e%2e/orgs/y',
      'https://github.com/./x/y/z',
    ];

    for (const githubUrl of attempts) {
      const { owner, repo } = validate({ npmUrl: NPM, githubUrl });
      const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
      expect(path).toMatch(/^\/repos\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/);
      expect(path).not.toContain('%');
    }
    expect(validate({ npmUrl: NPM, githubUrl: attempts[0] })).toMatchObject({
      owner: 'x',
      repo: 'y',
    });
  });
});

describe('validatePluginReferences', () => {
  it('accepts an array of valid entries', () => {
    expect(validatePluginReferences([{ npmUrl: NPM, githubUrl: GITHUB }])).toHaveLength(1);
  });

  it.each([
    ['an object', {}],
    ['null', null],
    ['a string', 'plugins'],
  ])('rejects %s instead of an array', (_, value) => {
    expect(() => validatePluginReferences(value)).toThrow(/must contain an array/);
  });

  it('names the index of the entry that fails', () => {
    expect(() =>
      validatePluginReferences([{ npmUrl: NPM, githubUrl: GITHUB }, { npmUrl: NPM }]),
    ).toThrow(/entry 1/);
  });
});
