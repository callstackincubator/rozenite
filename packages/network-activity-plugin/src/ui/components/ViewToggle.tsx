import type { ResponseView } from '../response-renderers';
import { cn } from '../utils/cn';

const VIEW_LABELS: Record<ResponseView, string> = {
  preview: 'Preview',
  raw: 'Raw',
};

export type ViewToggleProps = {
  views: ResponseView[];
  value: ResponseView;
  onChange: (view: ResponseView) => void;
};

export const ViewToggle = ({ views, value, onChange }: ViewToggleProps) => {
  if (views.length <= 1) return null;
  return (
    <div
      role="tablist"
      className="flex items-center rounded-md border border-gray-700 overflow-hidden ms-2"
    >
      {views.map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={(e) => {
            e.stopPropagation();
            onChange(v);
          }}
          className={cn(
            'px-2 py-0.5 text-xs transition-colors',
            value === v
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:bg-gray-700',
          )}
        >
          {VIEW_LABELS[v]}
        </button>
      ))}
    </div>
  );
};
