import { JsonInspector, Surface } from '@rozenite/ui';
import type { NavigationAction, NavigationState } from '../../shared';

export type ActionDetailPanelProps = {
  action: NavigationAction;
  state: NavigationState | undefined;
};

export const ActionDetailPanel = ({
  action,
  state,
}: ActionDetailPanelProps) => {
  return (
    <div className="grid min-h-0 flex-1 gap-4 overflow-auto xl:grid-cols-2">
      <section className="flex min-h-0 flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Action Payload
        </h3>
        <Surface
          className="min-h-0 flex-1 overflow-auto p-3 text-sm"
          variant="secondary"
        >
          <JsonInspector
            data={action}
            shouldExpandNodeInitially={(keyPath) => keyPath.length <= 2}
            theme="dark"
          />
        </Surface>
      </section>

      <section className="flex min-h-0 flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Navigation State
        </h3>
        <Surface
          className="min-h-0 flex-1 overflow-auto p-3 text-sm"
          variant="secondary"
        >
          {state ? (
            <JsonInspector
              data={state}
              shouldExpandNodeInitially={(keyPath) => keyPath.length <= 2}
              theme="dark"
            />
          ) : (
            <div className="text-sm italic text-muted">No state available</div>
          )}
        </Surface>
      </section>
    </div>
  );
};
