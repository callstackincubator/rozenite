import { useState } from 'react';
import { Button, Card, Input, Surface, TextField } from '@rozenite/ui';

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
    <div className="flex h-full min-h-0 overflow-auto">
      <Card className="h-fit w-full max-w-2xl">
        <Card.Header>
          <Card.Title>Link Tester</Card.Title>
          <Card.Description className="mt-1 text-xs">
            Open a deep link against the connected app and keep the last value
            handy while you debug.
          </Card.Description>
        </Card.Header>

        <Card.Content className="space-y-4">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-start"
            onSubmit={handleOpenLink}
          >
            <TextField
              aria-label="Deep link URL"
              className="min-w-0 flex-1"
              name="url-input"
              type="text"
            >
              <Input
                autoComplete="off"
                fullWidth
                onChange={(event) => setUrl(event.target.value)}
                placeholder="myapp://screen/param"
                value={url}
                variant="secondary"
              />
            </TextField>

            <Button isDisabled={!url.trim()} type="submit">
              Open
            </Button>
          </form>

          {lastOpened ? (
            <Surface className="space-y-1 text-sm" variant="secondary">
              <div className="font-medium text-foreground">Last opened</div>
              <div className="break-all font-mono text-muted">
                {lastOpened}
              </div>
            </Surface>
          ) : null}
        </Card.Content>
      </Card>
    </div>
  );
};
