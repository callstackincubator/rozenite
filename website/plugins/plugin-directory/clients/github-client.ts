interface GitHubRepository {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

interface GitHubError {
  message: string;
  documentation_url?: string;
}

async function getGitHubRepository(
  repository: string
): Promise<GitHubRepository> {
  const response = await fetch(`https://api.github.com/repos/${repository}`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'rozenite-website',
    },
  });

  if (!response.ok) {
    const error: GitHubError = await response.json();
    throw new Error(`GitHub API error: ${error.message}`);
  }

  return response.json();
}

export async function getRepositoryStars(repository: string): Promise<number> {
  try {
    const repoData = await getGitHubRepository(repository);
    return repoData.stargazers_count;
  } catch (error) {
    console.error(`Failed to fetch stars for ${repository}:`, error);
    return 0;
  }
}

export function getRepositoryFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);

    if (urlObj.hostname !== 'github.com') {
      return null;
    }

    const pathSegments = urlObj.pathname.split('/').filter(Boolean);

    if (pathSegments.length < 2) {
      return null;
    }

    const [owner, repo] = pathSegments;

    if (!owner || !repo) {
      return null;
    }

    return `${owner}/${repo}`;
  } catch (error) {
    return null;
  }
}
