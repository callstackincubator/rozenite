import { getJson, HttpError } from './http-client';

export async function getRepositoryStars(owner: string, repo: string): Promise<number> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'rozenite-website',
  };

  // The token goes only in this header, to api.github.com. It is optional: without it the
  // request is unauthenticated and subject to the much lower anonymous rate limit. It is not
  // named GITHUB_TOKEN: Turborepo passes every GITHUB_* variable to every task, and the release
  // job sets a write-scoped GITHUB_TOKEN that must never be sent from here.
  const token = process.env.PLUGIN_DIRECTORY_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const repository = await getJson<{ stargazers_count?: unknown }>(url, headers);

  if (typeof repository?.stargazers_count !== 'number') {
    throw new HttpError(`GET ${url} returned no star count`, url);
  }

  return repository.stargazers_count;
}
