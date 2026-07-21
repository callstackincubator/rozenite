import { Drawer, Surface } from '@rozenite/ui';
import { Rows } from 'lucide-react';
import { renderStructuredValue } from './value-utils';

type CellDetailDrawerProps = {
  value: unknown;
  title: string;
  isOpen: boolean;
  onClose: () => void;
};

export const CellDetailDrawer = ({
  value,
  title,
  isOpen,
  onClose,
}: CellDetailDrawerProps) => {
  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <Drawer.Backdrop variant="blur">
        <Drawer.Content className="w-full max-w-4xl" placement="right">
          <Drawer.Dialog
            aria-label={title}
            className="flex h-full flex-col overflow-hidden"
          >
            <Drawer.Header className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Rows aria-hidden="true" className="size-4 text-info" />
                  <Drawer.Heading className="truncate">{title}</Drawer.Heading>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Inspect the selected row in full detail.
                </p>
              </div>
              <Drawer.CloseTrigger aria-label="Close row details" />
            </Drawer.Header>

            <Drawer.Body className="min-h-0 flex-1 overflow-auto p-5">
              <Surface
                className="min-h-full rounded-xl border border-border/70 bg-surface-secondary p-4"
                variant="secondary"
              >
                {renderStructuredValue(value)}
              </Surface>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
};
