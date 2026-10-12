import { Circle, Download, Square } from 'lucide-react';
import { IconButton, Text, Toolbar, Trash2 } from '@rozenite/ui';
import { useIsRecording, useNetworkActivityActions } from '../state/hooks';
import { useNetworkActivitySessionExport } from '../hooks/useNetworkActivitySessionExport';
import type { FilterState } from '../state/filter';
import { FilterBar } from './FilterBar';

export type RequestToolbarProps = {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
  /** Requests currently listed, and every request captured. */
  visibleCount: number;
  totalCount: number;
};

export const RequestToolbar = ({
  filter,
  onFilterChange,
  visibleCount,
  totalCount,
}: RequestToolbarProps) => {
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
    <Toolbar className="shrink-0 gap-2">
      <IconButton
        label={isRecording ? 'Stop recording' : 'Start recording'}
        tone={isRecording ? 'primary' : 'neutral'}
        variant="ghost"
        size="sm"
        aria-pressed={isRecording}
        onClick={onToggleRecording}
      >
        {isRecording ? <Square className="fill-current" /> : <Circle className="fill-current" />}
      </IconButton>
      <IconButton
        label="Clear requests"
        tone="neutral"
        variant="ghost"
        size="sm"
        onClick={onClearRequests}
      >
        <Trash2 />
      </IconButton>

      <Toolbar.Separator />

      <FilterBar filter={filter} onFilterChange={onFilterChange} />

      <Toolbar.Separator />

      <Text variant="label" className="whitespace-nowrap tabular-nums">
        {visibleCount === totalCount ? totalCount : `${visibleCount} / ${totalCount}`}{' '}
        {totalCount === 1 ? 'request' : 'requests'}
      </Text>

      <IconButton
        label="Export session"
        tone="neutral"
        variant="ghost"
        size="sm"
        onClick={exportSession}
        disabled={!canExportSession}
      >
        <Download />
      </IconButton>
    </Toolbar>
  );
};
