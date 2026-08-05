import { ActionWithState } from '../ActionList';
import { NavigationNode } from './NavigationNode';
import { generateColor } from './navigationTreeColors';

export type NavigationTreeProps = {
  actionHistory: ActionWithState[];
};

export function NavigationTree({ actionHistory }: NavigationTreeProps) {
  const states = actionHistory
    .map((action) => action.state)
    .filter((state) => state !== undefined);

  return (
    <div className="flex-1 flex-row-reverse overflow-auto overflow-x-scroll flex pb-[12px] h-full">
      {states.map((state, index) => (
        <div
          key={states.length - index}
          className="flex flex-col-reverse items-center overflow-auto h-full min-w-[34vw]"
        >
          <span className="font-bold text-sm text-gray-400">
            Navigation state n°{states.length - index}
          </span>
          <div className="h-4" />
          <div className="flex flex-col-reverse items-center overflow-auto h-full min-w-[34vw]">
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
