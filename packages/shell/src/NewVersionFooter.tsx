import { useEffect, useState } from 'react';
import { Link } from '@rozenite/ui';
import { getAvailableRuntimeVersion } from './new-version';

const RELEASES_URL = 'https://github.com/callstackincubator/rozenite/releases';

type NewVersionFooterProps = {
  currentVersion?: string;
};

export function NewVersionFooter({ currentVersion }: NewVersionFooterProps) {
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

  const updateLabel = latestVersion ? `Update v${latestVersion}` : null;

  if (!updateLabel) {
    return null;
  }

  return (
    <Link
      href={RELEASES_URL}
      external
      className="h-8 min-w-0 flex-1 justify-start px-2 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:no-underline focus-visible:ring-sidebar-ring"
    >
      <span className="truncate">{updateLabel}</span>
    </Link>
  );
}
