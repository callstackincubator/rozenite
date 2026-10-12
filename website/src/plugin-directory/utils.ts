import type { PluginDirectoryReference, ValidatedPluginReference } from './types';

// npm package names: lowercase, an optional `@scope/`, no leading `.` or `_`, at most 214 characters.
const NPM_NAME_PART = '[a-z0-9-~][a-z0-9-._~]*';
const NPM_URL_PATTERN = new RegExp(
  `^https://www\\.npmjs\\.com/package/((?:@${NPM_NAME_PART}/)?${NPM_NAME_PART})/?$`,
);
const NPM_NAME_MAX_LENGTH = 214;

const GITHUB_OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const GITHUB_REPO_PATTERN = /^[A-Za-z0-9._-]+$/;

const parseNpmUrl = (npmUrl: string): string | null => {
  const name = NPM_URL_PATTERN.exec(npmUrl)?.[1];
  return name && name.length <= NPM_NAME_MAX_LENGTH ? name : null;
};

// `https://github.com/<owner>/<repo>`, optionally followed by a path. The canonical URL keeps the
// path but drops any query or fragment.
const parseGithubUrl = (
  githubUrl: string,
): { owner: string; repo: string; githubUrl: string } | null => {
  if (!githubUrl.startsWith('https://github.com/')) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(githubUrl);
  } catch {
    return null;
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== ''
  ) {
    return null;
  }

  const [owner, repo] = url.pathname.split('/').filter(Boolean);

  if (
    !owner ||
    !repo ||
    !GITHUB_OWNER_PATTERN.test(owner) ||
    !GITHUB_REPO_PATTERN.test(repo) ||
    repo === '.' ||
    repo === '..'
  ) {
    return null;
  }

  return { owner, repo, githubUrl: `https://github.com${url.pathname}` };
};

/**
 * Checks one `plugin-directory.json` entry and returns its canonical form. Throws on anything
 * else, so a bad entry fails the build rather than being rendered or requested.
 */
export function validatePluginReference(entry: unknown, index: number): ValidatedPluginReference {
  const fail = (reason: string): never => {
    throw new Error(`plugin-directory.json entry ${index}: ${reason}`);
  };

  if (typeof entry !== 'object' || entry === null) {
    return fail('expected an object with "npmUrl" and "githubUrl".');
  }

  const { npmUrl, githubUrl } = entry as Partial<PluginDirectoryReference>;

  if (typeof npmUrl !== 'string' || typeof githubUrl !== 'string') {
    return fail('"npmUrl" and "githubUrl" must be strings.');
  }

  const packageName = parseNpmUrl(npmUrl);
  if (!packageName) {
    return fail(
      `"npmUrl" must be https://www.npmjs.com/package/<name> with a valid npm package name, got ${JSON.stringify(npmUrl)}.`,
    );
  }

  const github = parseGithubUrl(githubUrl);
  if (!github) {
    return fail(
      `"githubUrl" must be https://github.com/<owner>/<repo>, optionally followed by a path, got ${JSON.stringify(githubUrl)}.`,
    );
  }

  return {
    packageName,
    npmUrl: `https://www.npmjs.com/package/${packageName}`,
    githubUrl: github.githubUrl,
    owner: github.owner,
    repo: github.repo,
  };
}

export function validatePluginReferences(entries: unknown): ValidatedPluginReference[] {
  if (!Array.isArray(entries)) {
    throw new Error('plugin-directory.json must contain an array.');
  }
  return entries.map(validatePluginReference);
}
