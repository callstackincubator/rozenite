import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@rozenite/ui';
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
      <a
        className="group flex items-center gap-2.5 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-2.5 outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        href={RELEASES_URL}
        rel="noreferrer"
        target="_blank"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-sidebar-accent-foreground">
            Update available
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-sidebar-foreground/65">
            Rozenite
            <Badge className="px-1.5 py-0 text-[11px]" variant="outline">
              v{latestVersion}
            </Badge>
          </span>
        </span>
        <ArrowUpRight
          aria-hidden="true"
          className="size-4 shrink-0 text-sidebar-foreground/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      </a>
    </footer>
  );
}
