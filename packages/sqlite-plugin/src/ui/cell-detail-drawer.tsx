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

export const CellDetailDrawer = ({
  value,
  title,
  isOpen,
  onClose,
}: CellDetailDrawerProps) => {
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
      <Modal.Backdrop
        variant="blur"
        isDismissable
        className="bg-[rgba(5,10,16,0.24)] backdrop-blur-[2px]"
      >
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog
            aria-label={title}
            className="w-full max-w-4xl overflow-hidden border border-white/10 bg-[#0a121b] p-0 text-white shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <Rows aria-hidden="true" className="h-4 w-4 text-sky-300" />
                  <h2 className="text-lg font-semibold text-white">{title}</h2>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  Inspect the selected row in full detail.
                </p>
              </div>
              <SqliteModalCloseButton onClose={onClose} />
            </div>

            <Modal.Body className="space-y-0 p-0">
              <div className="px-5 py-5">
                <div className="max-h-[70vh] overflow-auto rounded-[22px] border border-white/8 bg-white/[0.02] p-4">
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
