import { Surface } from '@rozenite/ui';
import { Loader2 } from 'lucide-react';

type ConnectingScreenProps = {
  description?: string;
  message?: string;
};

export function ConnectingScreen({
  description = 'Waiting for the device plugin to become available.',
  message = 'Connecting to React Native...',
}: ConnectingScreenProps) {
  return (
    <Surface
      className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border border-border/70 bg-surface px-4 py-8 text-center shadow-sm"
      variant="secondary"
    >
      <Loader2 className="size-8 animate-spin text-accent" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
    </Surface>
  );
}
