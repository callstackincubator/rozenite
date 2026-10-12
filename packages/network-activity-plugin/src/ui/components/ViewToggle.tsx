import { Tabs } from '@rozenite/ui';
import type { ResponseView } from '../response-renderers';

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
    <Tabs value={value} onValueChange={(view) => onChange(view as ResponseView)}>
      <Tabs.List size="sm">
        {views.map((v) => (
          <Tabs.Tab
            key={v}
            value={v}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {VIEW_LABELS[v]}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
};
