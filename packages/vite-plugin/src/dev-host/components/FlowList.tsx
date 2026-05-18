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
  if (status === 'running') {
    return 'Running';
  }

  if (status === 'succeeded') {
    return 'Completed';
  }

  if (status === 'failed') {
    return 'Failed';
  }

  if (status === 'aborted') {
    return 'Stopped';
  }

  return status;
};

export const FlowList = ({ flows, flowRuns, hasRunningFlow, onRunFlow, onStopFlow }: FlowListProps) => {
  if (flows.length === 0) {
    return <div className="rz-flow-empty-state">No flows were configured for this plugin.</div>;
  }

  const hasExecutionState = flowRuns.length > 0;

  return (
    <div className="rz-flow-panel">
      <div className="rz-field">
        <div className="rz-label">Available flows</div>

        <div className="rz-flow-list">
          {flows.map((flow, index) => {
            const isActive = hasRunningFlow(flow.name);

            return (
              <button
                key={`${flow.name}-${index}`}
                type="button"
                className="rz-flow-list-button"
                onClick={() => onRunFlow(flow)}
                data-active={isActive}
                title={`Run ${flow.displayName}`}
              >
                <span className="rz-flow-list-name">
                  {flow.displayName}
                  {flow.autoRun ? <span className="rz-flow-list-badge">Auto</span> : null}
                </span>
                <span className="rz-flow-list-action">{isActive ? 'Running' : 'Run'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {hasExecutionState ? (
        <div className="rz-field">
          <div className="rz-label">Flow runs</div>

          <div className="rz-flow-runs">
            {flowRuns.map((flowRun) => {
              const isRunning = flowRun.status === 'running';

              return (
                <div key={flowRun.id} className="rz-flow-state" data-status={flowRun.status}>
                  <div className="rz-flow-state-header">
                    <div className="rz-flow-state-title">
                      {flowRun.flowDisplayName}
                      {flowRun.autoRun ? <span className="rz-flow-state-badge">Auto</span> : null}
                    </div>

                    {isRunning ? (
                      <button
                        type="button"
                        className="rz-template-button rz-flow-stop-button"
                        onClick={() => onStopFlow(flowRun.id)}
                      >
                        Stop
                      </button>
                    ) : null}
                  </div>

                  <div className="rz-flow-state-status">{getStatusLabel(flowRun.status)}</div>

                  {flowRun.error ? (
                    <div className="rz-flow-state-error">{flowRun.error}</div>
                  ) : null}

                  {flowRun.result != null ? (
                    <pre className="rz-flow-state-result">
                      {formatPayloadForCommandInput(flowRun.result)}
                    </pre>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
