import { Chip, Surface } from '@rozenite/ui';
import type { ActionWithState } from '../ActionList';
import { NavigationNode } from './NavigationNode';
import { generateColor } from './navigationTreeColors';

export type NavigationTreeProps = {
  actionHistory: ActionWithState[];
};

export function NavigationTree({ actionHistory }: NavigationTreeProps) {
  const states = actionHistory
    .map((action) => action.state)
    .filter((state) => state !== undefined);

  if (states.length === 0) {
    return (
      <Surface className="text-sm text-muted" variant="secondary">
        No navigation state has been captured yet.
      </Surface>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-row-reverse gap-4 overflow-auto pb-3">
      {states.map((state, index) => (
        <div
          key={states.length - index}
          className="flex h-full min-w-[34vw] flex-col-reverse items-center gap-4 overflow-auto"
        >
          <Chip size="sm" variant="secondary">
            Navigation state n°{states.length - index}
          </Chip>
          <div className="flex h-full min-w-[34vw] flex-col-reverse items-center overflow-auto">
            {state && (
              <NavigationNode
                name="root"
                state={state}
                parentColor={generateColor(state.key)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
