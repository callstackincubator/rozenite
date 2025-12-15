import { RawData } from 'react-flame-graph';
import { formatTime } from '../transformations';

export type InfoBarProps = {
  totalTime: number;
  totalModules: number;
  entryName: string | undefined;
};

export const InfoBar = ({
  totalTime,
  totalModules,
  entryName,
}: InfoBarProps) => {
  return (
    <div className="info-bar">
      <div className="info-bar-left">
        <div className="info-item">
          <span>Total Time:</span>
          <span className="info-item-value">{formatTime(totalTime)}</span>
        </div>
        <div className="info-item">
          <span>Modules:</span>
          <span className="info-item-value">
            {totalModules.toLocaleString()}
          </span>
        </div>
        <div className="info-item">
          <span>Entry:</span>
          <span className="info-item-value">{entryName ?? 'N/A'}</span>
        </div>
      </div>
      <div className="info-bar-right">
        <span className="shortcuts-hint">
          Click to zoom in, <kbd>Esc</kbd> to reset
        </span>
      </div>
    </div>
  );
};
