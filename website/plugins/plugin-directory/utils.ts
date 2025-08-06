export function extractPackageNameFromNpmUrl(npmUrl: string): string | null {
  try {
    const url = new URL(npmUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts[0] === 'package' && pathParts.length >= 2) {
      if (pathParts[1].startsWith('@') && pathParts.length >= 3) {
        return `${pathParts[1]}/${pathParts[2]}`;
      }
      return pathParts[1];
    }

    return null;
  } catch (error) {
    return null;
  }
}

export function getPackageNamesFromReferences(
  references: Array<{ npmUrl: string }>
): string[] {
  return references
    .map((ref) => extractPackageNameFromNpmUrl(ref.npmUrl))
    .filter(Boolean) as string[];
}
