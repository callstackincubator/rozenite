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
      className="flex items-center rounded-md border border-border/60 overflow-hidden ms-2"
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
              ? 'bg-accent text-background'
              : 'text-foreground/70 hover:bg-surface-secondary',
          )}
        >
          {VIEW_LABELS[v]}
        </button>
      ))}
    </div>
  );
};
