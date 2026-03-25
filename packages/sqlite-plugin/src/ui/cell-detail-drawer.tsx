import { Modal, useOverlayState } from '@heroui/react';
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
            className="w-full max-w-4xl border border-white/10 bg-[#0a121b] text-white shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
          >
            <div className="flex justify-end px-4 pt-4">
              <Modal.CloseTrigger />
            </div>

            <Modal.Body className="px-5 pb-5 pt-0">
              <div className="max-h-[70vh] overflow-auto rounded-[22px] border border-white/8 bg-white/[0.02] p-4">
                {renderStructuredValue(value)}
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
