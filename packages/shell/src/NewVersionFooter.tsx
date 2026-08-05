import { ArrowUpRight } from 'lucide-react';
import { Badge, buttonVariants, cn } from '@rozenite/ui';
import { useEffect, useState } from 'react';
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

  if (!latestVersion) {
    return null;
  }

  return (
    <footer className="shrink-0 border-t border-sidebar-border p-2">
      <div className="rounded-md bg-sidebar-accent p-2">
        <p className="text-xs font-medium text-sidebar-accent-foreground">
          New version available
        </p>
        <Badge className="mt-1" variant="outline">
          {latestVersion}
        </Badge>
        <a
          className={cn(
            buttonVariants({ variant: 'secondary', size: 'compact' }),
            'mt-2 w-full',
          )}
          href={RELEASES_URL}
          rel="noreferrer"
          target="_blank"
        >
          View release
          <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
    </footer>
  );
}
