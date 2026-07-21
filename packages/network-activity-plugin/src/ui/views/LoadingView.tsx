import { Loader2 } from 'lucide-react';

export const LoadingView = () => {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 text-accent animate-spin" />
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Loading Network Inspector
          </h2>
          <p className="text-muted text-sm">
            Initializing network monitoring...
          </p>
        </div>
      </div>
    </div>
  );
};
