import { useState } from 'react';
import { Button, Input } from '@rozenite/ui';

export type LinkingTesterProps = {
  onLinkOpen: (url: string) => void;
};

export const LinkingTester = ({ onLinkOpen }: LinkingTesterProps) => {
  const [url, setUrl] = useState('');
  const [lastOpened, setLastOpened] = useState<string | null>(null);

  const handleOpenLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!url.trim()) {
      return;
    }

    setLastOpened(url.trim());
    onLinkOpen(url.trim());
  };

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="max-w-2xl">
        <div className="space-y-4">
          {/* URL Input */}
          <form onSubmit={handleOpenLink} className="flex gap-2">
            <Input
              id="url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="myapp://screen/param"
              className="flex-1"
              autoComplete="off"
            />
            <Button type="submit" disabled={!url.trim()}>
              Open
            </Button>
          </form>

          {/* Last Opened */}
          {lastOpened && (
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-sm text-foreground">
                <span className="text-primary">Last opened:</span> {lastOpened}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
