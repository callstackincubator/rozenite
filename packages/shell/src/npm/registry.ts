const ABBREVIATED_PACKUMENT_ACCEPT = 'application/vnd.npm.install-v1+json';

type AbbreviatedPackument = {
  'dist-tags'?: {
    latest?: unknown;
  };
};

// Module-level cache for the lifetime of the shell document. Mounting and
// unmounting consumers (NewVersionFooter, the Plugins screen) must not
// refetch a package once its latest version is known.
const latestVersionCache = new Map<string, string>();

// In-flight requests are deduped here, not at call sites, so that two
// consumers asking about the same package concurrently share one request.
const inFlightRequests = new Map<string, Promise<string | null>>();

// Debug-only: pretend a package publishes a given version. Persisted in
// sessionStorage so a reload keeps the emulated state, which is what makes
// the initial-load and welcome-dialog paths testable.
const OVERRIDES_STORAGE_KEY = 'rozenite.debug.versionOverrides';

function loadVersionOverrides(): Map<string, string> {
  try {
    const stored = sessionStorage.getItem(OVERRIDES_STORAGE_KEY);
    return stored
      ? new Map(Object.entries(JSON.parse(stored) as Record<string, string>))
      : new Map();
  } catch {
    return new Map();
  }
}

const versionOverrides = loadVersionOverrides();
const overrideListeners = new Set<() => void>();
let overridesRevision = 0;

async function fetchLatestVersion(packageName: string): Promise<string | null> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
      headers: { Accept: ABBREVIATED_PACKUMENT_ACCEPT },
    });

    if (!response.ok) {
      return null;
    }

    const packument = (await response.json()) as AbbreviatedPackument;
    const latest = packument['dist-tags']?.latest;

    return typeof latest === 'string' ? latest : null;
  } catch {
    // A registry outage must never surface an error in DevTools. The
    // package is simply omitted from the result.
    return null;
  }
}

function getLatestVersion(packageName: string): Promise<string | null> {
  // Debug overrides short-circuit both the cache and the network so that the
  // emulated state travels the same path a real published version would.
  const override = versionOverrides.get(packageName);
  if (override !== undefined) {
    return Promise.resolve(override);
  }

  const cached = latestVersionCache.get(packageName);
  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  const inFlight = inFlightRequests.get(packageName);
  if (inFlight) {
    return inFlight;
  }

  const request = fetchLatestVersion(packageName)
    .then((version) => {
      if (version !== null) {
        latestVersionCache.set(packageName, version);
      }
      return version;
    })
    .finally(() => {
      inFlightRequests.delete(packageName);
    });

  inFlightRequests.set(packageName, request);
  return request;
}

/** Latest published version for each package, from the CDN-cached
 *  abbreviated packument. Packages that fail to resolve are omitted. */
export async function getLatestVersions(packageNames: string[]): Promise<Map<string, string>> {
  const entries = await Promise.all(
    packageNames.map(async (name) => [name, await getLatestVersion(name)] as const),
  );

  return new Map(entries.filter((entry): entry is [string, string] => entry[1] !== null));
}

/** Debug only. Makes `packageName` resolve to `version` instead of hitting
 *  the registry, or clears the override when `version` is null. */
export function setVersionOverride(packageName: string, version: string | null): void {
  if (version === null) {
    versionOverrides.delete(packageName);
  } else {
    versionOverrides.set(packageName, version);
  }

  try {
    sessionStorage.setItem(
      OVERRIDES_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(versionOverrides)),
    );
  } catch {
    // Overrides stay in memory for this document if storage is unavailable.
  }

  overridesRevision++;
  for (const listener of overrideListeners) {
    listener();
  }
}

/** Debug only. The currently overridden packages. */
export function getVersionOverrides(): ReadonlyMap<string, string> {
  return versionOverrides;
}

/** Bumped whenever an override changes, so consumers can re-resolve. */
export function getVersionOverridesRevision(): number {
  return overridesRevision;
}

export function subscribeToVersionOverrides(listener: () => void): () => void {
  overrideListeners.add(listener);
  return () => overrideListeners.delete(listener);
}

function parseVersionCore(version: string): number[] {
  // Semver-ish: only the dot-separated numeric core is compared.
  // Prerelease/build metadata (`-beta.1`, `+build.5`) is stripped rather
  // than ranked, so a differently-tagged build of the same release never
  // reads as an update.
  const core = version.split(/[-+]/, 1)[0];
  return core.split('.').map((segment) => {
    const value = Number.parseInt(segment, 10);
    return Number.isNaN(value) ? 0 : value;
  });
}

/** Semver-ish comparison. Returns false when `candidate` is not strictly
 *  newer, including when it is a local or prerelease build ahead of npm. */
export function isNewerVersion(current: string, candidate: string): boolean {
  const currentParts = parseVersionCore(current);
  const candidateParts = parseVersionCore(candidate);
  const length = Math.max(currentParts.length, candidateParts.length);

  for (let i = 0; i < length; i++) {
    const currentSegment = currentParts[i] ?? 0;
    const candidateSegment = candidateParts[i] ?? 0;

    if (candidateSegment > currentSegment) {
      return true;
    }

    if (candidateSegment < currentSegment) {
      return false;
    }
  }

  return false;
}
