import { Modal, useOverlayState } from '@heroui/react';
import { Rows } from 'lucide-react';
import { SqliteModalCloseButton } from './sqlite-modal-controls';
import { renderStructuredValue } from './value-utils';

type CellDetailDrawerProps = {
  value: unknown;
  title: string;
  isOpen: boolean;
  onClose: () => void;
};

export const CellDetailDrawer = ({ value, title, isOpen, onClose }: CellDetailDrawerProps) => {
  const overlay = useOverlayState({
    isOpen,
    onOpenChange: (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
  });

  return (
    <Modal state={overlay}>
      <Modal.Backdrop variant="blur" isDismissable className="bg-black/60">
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog
            aria-label={title}
            className="w-full max-w-4xl overflow-hidden border border-[var(--sqlite-line-strong)] bg-[var(--sqlite-surface)] p-0 text-white"
          >
            <div className="flex items-center justify-between gap-4 border-b border-[var(--sqlite-line)] px-5 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <Rows aria-hidden="true" className="h-4 w-4 text-[var(--sqlite-muted)]" />
                  <h2 className="text-lg font-medium text-white">{title}</h2>
                </div>
                <p className="mt-1 text-sm text-[var(--sqlite-muted)]">
                  Inspect the selected row in full detail.
                </p>
              </div>
              <SqliteModalCloseButton onClose={onClose} />
            </div>

            <Modal.Body className="space-y-0 p-0">
              <div className="px-5 py-5">
                <div className="max-h-[70vh] overflow-auto rounded-none border border-[var(--sqlite-line)] bg-white/[0.02] p-4">
                  {renderStructuredValue(value)}
                </div>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
