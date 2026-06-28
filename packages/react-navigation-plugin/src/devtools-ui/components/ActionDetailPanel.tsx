import { JsonInspector, Surface } from '@rozenite/ui';
import type { ActionOrigin } from '../../react-native/symbolication/types';
import type { NavigationAction, NavigationState } from '../../shared';
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
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="flex flex-col gap-2">
        <DispatchOriginSection origin={origin} />

        <h3 className="text-sm font-semibold text-foreground">
          Action Payload
        </h3>
        <Surface
          className="p-3 text-sm"
          variant="secondary"
        >
          <JsonInspector
            data={action}
            shouldExpandNodeInitially={(keyPath) => keyPath.length <= 2}
          />
        </Surface>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Navigation State
        </h3>
        <Surface
          className="p-3 text-sm"
          variant="secondary"
        >
          {state ? (
            <JsonInspector
              data={state}
              shouldExpandNodeInitially={(keyPath) => keyPath.length <= 2}
            />
          ) : (
            <div className="text-sm italic text-muted">No state available</div>
          )}
        </Surface>
      </section>
    </div>
  );
};
