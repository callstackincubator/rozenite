import { JSONTree } from 'react-json-tree';
import { NavigationAction, NavigationState } from '../../shared';

export type ActionDetailPanelProps = {
  action: NavigationAction;
  state: NavigationState | undefined;
};

const jsonTreeTheme = {
  base00: '#1f2937', // gray-800
  base01: '#374151', // gray-700
  base02: '#4b5563', // gray-600
  base03: '#6b7280', // gray-500
  base04: '#9ca3af', // gray-400
  base05: '#d1d5db', // gray-300
  base06: '#e5e7eb', // gray-200
  base07: '#f3f4f6', // gray-100
  base08: '#ef4444', // red-500
  base09: '#f97316', // orange-500
  base0A: '#eab308', // yellow-500
  base0B: '#22c55e', // green-500
  base0C: '#06b6d4', // cyan-500
  base0D: '#3b82f6', // blue-500
  base0E: '#a855f7', // purple-500
  base0F: '#92400e', // amber-800
};

export const ActionDetailPanel = ({
  action,
  state,
}: ActionDetailPanelProps) => {
  return (
    <div className="flex-1 overflow-auto bg-gray-900">
      <div className="p-4">
        <div className="mb-6">
          <h3 className="mb-3 text-base font-bold text-gray-100">
            Action Payload
          </h3>
          <div className="border border-gray-700 rounded bg-gray-800 p-3 text-sm">
            <JSONTree
              data={action}
              theme={jsonTreeTheme}
              invertTheme={false}
              shouldExpandNodeInitially={(keyPath) => keyPath.length <= 2}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-base font-bold text-gray-100">
            Navigation State
          </h3>
          <div className="border border-gray-700 rounded bg-gray-800 p-3 text-sm">
            {state ? (
              <JSONTree
                data={state}
                theme={jsonTreeTheme}
                invertTheme={false}
                shouldExpandNodeInitially={(keyPath) => keyPath.length <= 2}
              />
            ) : (
              <div className="text-gray-400 italic">No state available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
