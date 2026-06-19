import { useState, useEffect } from 'react';
import { Button, Input, Label, Modal, TextField } from '@rozenite/ui';

export type ProfilerOptions = {
  minChainDurationMs: number;
};

export type OptionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  options: ProfilerOptions;
  onOptionsChange: (options: ProfilerOptions) => void;
};

export const OptionsModal = ({
  isOpen,
  onClose,
  options,
  onOptionsChange,
}: OptionsModalProps) => {
  const [localOptions, setLocalOptions] = useState<ProfilerOptions>(options);

  useEffect(() => {
    if (isOpen) {
      setLocalOptions(options);
    }
  }, [isOpen, options]);

  const handleSave = () => {
    onOptionsChange(localOptions);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Modal.Backdrop variant="blur">
        <Modal.Container className="w-full max-w-sm" placement="center">
          <Modal.Dialog aria-label="Profiler options">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Options</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-5 flex flex-col gap-4">
              <TextField
                className="w-full"
                name="min-duration"
                type="number"
              >
                <Label>Skip chains shorter than (ms)</Label>
                <Input
                  autoFocus
                  value={String(localOptions.minChainDurationMs)}
                  onChange={(e) => {
                    const num = parseFloat(e.target.value);
                    setLocalOptions((prev) => ({
                      ...prev,
                      minChainDurationMs: isNaN(num) ? 0 : Math.max(0, num),
                    }));
                  }}
                  placeholder="0"
                  min={0}
                  step={1}
                  variant="secondary"
                />
                <p className="text-xs text-muted mt-1">
                  Hide require chains with total duration below this threshold.
                  Useful for filtering out fast modules to focus on slow ones.
                </p>
              </TextField>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button onPress={onClose} variant="secondary">
                Cancel
              </Button>
              <Button onPress={handleSave}>Save</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
