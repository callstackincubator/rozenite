import { ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getAvailableRuntimeVersion } from './new-version';

const RELEASES_URL = 'https://github.com/callstackincubator/rozenite/releases';

type NewVersionFooterProps = {
  currentVersion?: string;
  /** Temporarily shows the compact update affordance when no update is found. */
  forceDisplay?: boolean;
};

export function NewVersionFooter({
  currentVersion,
  forceDisplay = false,
}: NewVersionFooterProps) {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!currentVersion) {
      return;
    }

    let cancelled = false;

    void getAvailableRuntimeVersion(currentVersion)
      .then((version) => {
        if (!cancelled) {
          setLatestVersion(version);
        }
      })
      .catch(() => {
        // An unavailable registry must not affect the DevTools experience.
      });

    return () => {
      cancelled = true;
    };
  }, [currentVersion]);

  const updateLabel = latestVersion
    ? `Update v${latestVersion}`
    : forceDisplay
      ? 'Update available'
      : null;

  if (!updateLabel) {
    return null;
  }

  return (
    <a
      className="group flex h-8 min-w-0 flex-1 items-center gap-1.5 px-2 text-xs font-medium text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      href={RELEASES_URL}
      rel="noreferrer"
      target="_blank"
    >
      <span className="truncate">{updateLabel}</span>
      <ArrowUpRight
        aria-hidden="true"
        className="size-3.5 shrink-0 text-sidebar-foreground/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
      />
    </a>
  );
}
