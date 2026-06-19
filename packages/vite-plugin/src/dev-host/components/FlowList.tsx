import { formatPayloadForCommandInput } from '../utils.js';
import type { DevHostFlowEntry, DevHostFlowRunState } from '../types.js';
import { Button } from './ui/Button.js';

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
              <Button
                key={`${flow.name}-${index}`}
                type="button"
                onClick={() => onRunFlow(flow)}
                variant="default"
                isSelected={isActive}
                title={`Run ${flow.displayName}`}
                overrides={{
                  BaseButton: {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      width: '100%',
                      borderRadius: '8px',
                      backgroundColor: isActive ? 'rgba(130, 50, 255, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                      borderColor: isActive ? 'rgba(130, 50, 255, 0.45)' : 'rgba(255, 255, 255, 0.08)',
                      color: 'rgba(255, 255, 255, 0.88)',
                      paddingTop: '10px',
                      paddingRight: '12px',
                      paddingBottom: '10px',
                      paddingLeft: '12px',
                      textAlign: 'left',
                    },
                  },
                }}
              >
                <span className="rz-flow-list-name">
                  {flow.displayName}
                  {flow.autoRun ? <span className="rz-flow-list-badge">Auto</span> : null}
                </span>
                <span className="rz-flow-list-action">{isActive ? 'Running' : 'Run'}</span>
              </Button>
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
                      <Button
                        type="button"
                        variant="pill"
                        onClick={() => onStopFlow(flowRun.id)}
                        overrides={{
                          BaseButton: {
                            style: {
                              flexShrink: 0,
                            },
                          },
                        }}
                      >
                        Stop
                      </Button>
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
