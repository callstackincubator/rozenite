import { Button } from './Button';
import { Circle, Square, Trash2 } from 'lucide-react';
import { useIsRecording, useNetworkActivityActions } from '../state/hooks';

export const Toolbar = () => {
  const actions = useNetworkActivityActions();
  const isRecording = useIsRecording();

  const onToggleRecording = (): void => {
    actions.setRecording(!isRecording);
  };

  const onClearRequests = (): void => {
    actions.clearRequests();
  };

  return (
    <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleRecording}
        className={`h-8 w-8 p-0 ${
          isRecording
            ? 'text-red-400 hover:text-red-300'
            : 'text-gray-400 hover:text-blue-400'
        }`}
      >
        {isRecording ? (
          <Circle className="h-4 w-4 fill-current" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearRequests}
        className="h-8 w-8 p-0 text-gray-400 hover:text-blue-400"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};
