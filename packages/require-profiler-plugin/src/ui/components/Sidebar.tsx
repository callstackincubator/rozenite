import { RawData } from 'react-flame-graph';
import { formatTime } from '../transformations';
import { EmptyState } from './EmptyState';

export type SidebarProps = {
  selectedNode: RawData | null;
};

export const Sidebar = ({ selectedNode }: SidebarProps) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Module Details</span>
      </div>
      <div className="sidebar-content">
        {selectedNode ? (
          <>
            <div className="detail-section">
              <div className="detail-label">Evaluation Time</div>
              <div className="detail-value detail-value-large">
                {formatTime(selectedNode.value)}
              </div>
            </div>
            <div className="detail-section">
              <div className="detail-label">Module Name</div>
              <div className="detail-value">{selectedNode.name}</div>
            </div>
            <div className="detail-section">
              <div className="detail-label">Full Path</div>
              <div className="detail-value detail-value-path">
                {selectedNode.tooltip ?? selectedNode.name}
              </div>
            </div>
            {selectedNode.children && selectedNode.children.length > 0 && (
              <div className="detail-section">
                <div className="detail-label">Direct Dependencies</div>
                <div className="detail-value">
                  {selectedNode.children.length} module
                  {selectedNode.children.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState message="Click on a module in the flame graph to view its details" />
        )}
      </div>
    </aside>
  );
};
