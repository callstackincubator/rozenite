import { RawData } from 'react-flame-graph';
import { formatTime } from '../transformations';
import { EmptyState } from './EmptyState';

export type SidebarProps = {
  selectedNode: RawData | null;
};

export const Sidebar = ({ selectedNode }: SidebarProps) => {
  return (
    <aside className="w-80 bg-surface border-l border-border flex flex-col overflow-hidden shrink-0">
      <div className="flex items-center px-4 py-3 border-b border-border shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          Module Details
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {selectedNode ? (
          <>
            <div className="mb-5">
              <div className="text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                Evaluation Time
              </div>
              <div className="text-2xl font-semibold tabular-nums text-accent">
                {formatTime(selectedNode.value)}
              </div>
            </div>
            <div className="mb-5">
              <div className="text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                Module Name
              </div>
              <div className="text-sm text-foreground break-all">{selectedNode.name}</div>
            </div>
            <div className="mb-5">
              <div className="text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                Full Path
              </div>
              <div className="text-xs font-mono text-foreground bg-background border border-border rounded p-2 break-all leading-relaxed">
                {selectedNode.tooltip ?? selectedNode.name}
              </div>
            </div>
            {selectedNode.children && selectedNode.children.length > 0 && (
              <div className="mb-5">
                <div className="text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                  Direct Dependencies
                </div>
                <div className="text-sm text-foreground">
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
