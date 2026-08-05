import { JsonInspector } from '@rozenite/ui';
import type { ActionOrigin } from '../../react-native/symbolication/types';
import { NavigationAction, NavigationState } from '../../shared';
import { DispatchOriginSection } from './DispatchOriginSection';

export type ActionDetailPanelProps = {
  action: NavigationAction;
  state: NavigationState | undefined;
  origin: ActionOrigin | undefined;
};

export const ActionDetailPanel = ({
  action,
  state,
  origin,
}: ActionDetailPanelProps) => {
  return (
    <div className="h-full overflow-auto bg-background">
      <div className="p-4">
        <DispatchOriginSection origin={origin} />

        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Action Payload
          </h3>
          <div className="rounded-md border border-border bg-card p-3">
            <JsonInspector data={action} defaultExpandedDepth={2} />
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Navigation State
          </h3>
          <div className="rounded-md border border-border bg-card p-3">
            {state ? (
              <JsonInspector data={state} defaultExpandedDepth={2} />
            ) : (
              <div className="text-sm italic text-muted-foreground">
                No state available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
