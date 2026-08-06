import { Badge, Button, EmptyState } from '@rozenite/ui';
import { Play, Square } from 'lucide-react';
import { formatPayloadForCommandInput } from '../utils.js';
import type { DevHostFlowEntry, DevHostFlowRunState } from '../types.js';

type FlowListProps = {
  flows: DevHostFlowEntry[];
  flowRuns: DevHostFlowRunState[];
  hasRunningFlow: (flowName: string) => boolean;
  onRunFlow: (flow: DevHostFlowEntry) => void;
  onStopFlow: (runId: string) => void;
};

const getStatusLabel = (status: DevHostFlowRunState['status']) => {
  switch (status) {
    case 'running':
      return 'Running';
    case 'succeeded':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'aborted':
      return 'Stopped';
  }
};

export const FlowList = ({
  flows,
  flowRuns,
  hasRunningFlow,
  onRunFlow,
  onStopFlow,
}: FlowListProps) => {
  if (flows.length === 0) {
    return (
      <EmptyState
        className="h-full"
        title="No flows configured"
        description="Add flows to rozenite.config.ts to run them here."
      />
    );
  }

  return (
    <div className="dev-host-flow-list">
      <div className="dev-host-field">
        <span className="dev-host-label">Available flows</span>
        <div className="grid gap-2">
          {flows.map((flow) => {
            const isRunning = hasRunningFlow(flow.name);

            return (
              <Button
                key={flow.name}
                variant={isRunning ? 'secondary' : 'outline'}
                className="dev-host-flow-button"
                onClick={() => onRunFlow(flow)}
                aria-label={`Run ${flow.displayName}`}
              >
                <span className="dev-host-flow-name">
                  <Play />
                  {flow.displayName}
                  {flow.autoRun ? <Badge variant="outline">Auto</Badge> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isRunning ? 'Running' : 'Run'}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      {flowRuns.length > 0 ? (
        <div className="dev-host-field">
          <span className="dev-host-label">Flow runs</span>
          <div className="dev-host-flow-runs">
            {flowRuns.map((flowRun) => (
              <div key={flowRun.id} className="dev-host-flow-state" data-status={flowRun.status}>
                <div className="dev-host-flow-state-header">
                  <span className="dev-host-flow-title">
                    {flowRun.flowDisplayName}
                    {flowRun.autoRun ? <Badge variant="outline">Auto</Badge> : null}
                  </span>
                  {flowRun.status === 'running' ? (
                    <Button variant="ghost" size="compact" onClick={() => onStopFlow(flowRun.id)}>
                      <Square />
                      Stop
                    </Button>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground">
                  {getStatusLabel(flowRun.status)}
                </span>
                {flowRun.error ? (
                  <div className="dev-host-flow-state-error">{flowRun.error}</div>
                ) : null}
                {flowRun.result != null ? (
                  <pre className="dev-host-flow-state-result">
                    {formatPayloadForCommandInput(flowRun.result)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
