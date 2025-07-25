import React from 'react';
import { Button, Toolbar } from './components';
import styles from './network-toolbar.module.css';

interface NetworkToolbarProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  onClear: () => void;
  requestCount: number;
}

export const NetworkToolbar: React.FC<NetworkToolbarProps> = ({
  isRecording,
  onToggleRecording,
  onClear,
  requestCount,
}) => {
  return (
    <Toolbar>
      <Button
        onClick={onToggleRecording}
        variant={isRecording ? 'danger' : 'success'}
        size="small"
        className={styles.recordingButton}
      >
        {isRecording ? 'Stop' : 'Start'} Recording
      </Button>
      <Button onClick={onClear} variant="secondary" size="small">
        Clear
      </Button>
      <div className={styles.requestCount}>{requestCount} requests</div>
    </Toolbar>
  );
};
