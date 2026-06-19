import { Button } from './Button';
import { Circle, Download, Square, Trash2 } from 'lucide-react';
import { useIsRecording, useNetworkActivityActions } from '../state/hooks';
import { useNetworkActivitySessionExport } from '../hooks/useNetworkActivitySessionExport';

export const Toolbar = () => {
  const actions = useNetworkActivityActions();
  const isRecording = useIsRecording();
  const { canExportSession, exportSession } = useNetworkActivitySessionExport();

  const onToggleRecording = (): void => {
    actions.setRecording(!isRecording);
  };

  const onClearRequests = (): void => {
    actions.clearRequests();
  };

  return (
    <div className="flex items-center gap-2 p-2 border-b border-border/60 bg-surface">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleRecording}
        className={`h-8 w-8 p-0 ${
          isRecording
            ? 'text-danger hover:text-danger/80'
            : 'text-muted hover:text-accent'
        }`}
        title={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? (
          <Square className="h-4 w-4 fill-current" />
        ) : (
          <Circle className="h-4 w-4 fill-current" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearRequests}
        className="h-8 w-8 p-0 text-muted hover:text-accent"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={exportSession}
        disabled={!canExportSession}
        className="ml-auto h-8 w-8 p-0 text-muted hover:text-accent"
        title="Export session"
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
};
