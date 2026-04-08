/**
 * Path helpers that work with:
 * - Bare RN paths: `/data/user/0/...`
 * - Expo FileSystem URIs: `file:///data/user/0/...`
 */

export function normalizeDirPath(path: string): string {
  if (!path) return path;
  // Keep "file://" URIs intact; just ensure directories end with a trailing slash
  const isFileUri = path.startsWith("file://");
  if (isFileUri) {
    return path.endsWith("/") ? path : `${path}/`;
  }
  return path.endsWith("/") ? path : `${path}/`;
}

export function joinPath(dir: string, name: string): string {
  if (!dir) return name;
  if (!name) return dir;
  const d = dir.endsWith("/") ? dir : `${dir}/`;
  return `${d}${name}`;
}

export function parentPath(path: string): string | null {
  if (!path) return null;
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) {
    // `file:///` or `/`
    if (normalized.startsWith("file://")) return "file:///";
    return "/";
  }
  return normalized.slice(0, idx + 1);
}

export function isLikelyImageFile(nameOrPath: string): boolean {
  const lower = nameOrPath.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".heic") ||
    lower.endsWith(".heif")
  );
}

export function isJsonFile(nameOrPath: string): boolean {
  return nameOrPath.toLowerCase().endsWith(".json");
}

export function isLikelyTextFile(nameOrPath: string): boolean {
  const lower = nameOrPath.toLowerCase();
  return (
    lower.endsWith(".txt") ||
    lower.endsWith(".json") ||
    lower.endsWith(".xml") ||
    lower.endsWith(".log") ||
    lower.endsWith(".md") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".html") ||
    lower.endsWith(".css") ||
    lower.endsWith(".js") ||
    lower.endsWith(".ts") ||
    lower.endsWith(".jsx") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".sh") ||
    lower.endsWith(".env") ||
    lower.endsWith(".gitignore") ||
    lower.endsWith(".config") ||
    lower.endsWith(".ini") ||
    lower.endsWith(".plist")
  );
}

export function mimeTypeFromName(nameOrPath: string): string | null {
  const lower = nameOrPath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  return null;
}
