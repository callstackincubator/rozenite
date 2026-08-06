import { useEffect, useId, useRef, useState } from 'react';
import { Button, Dialog, ScrollArea } from '@rozenite/ui';
import { ReleaseContent } from './ReleaseContent';
import {
  readWelcomeDismissal,
  shouldShowWelcomeDialog,
  writeWelcomeDismissal,
} from './welcome-dialog-state';

type WelcomeDialogProps = {
  runtimeVersion?: string;
};

export function WelcomeDialog({ runtimeVersion }: WelcomeDialogProps) {
  const [open, setOpen] = useState(false);
  const dismissedRuntimeVersion = useRef<string | null>(null);
  const dismissButtonId = useId();

  useEffect(() => {
    if (runtimeVersion === undefined) {
      setOpen(false);
      return;
    }

    const dismissedVersion =
      dismissedRuntimeVersion.current === runtimeVersion
        ? runtimeVersion
        : readWelcomeDismissal();

    setOpen(shouldShowWelcomeDialog(runtimeVersion, dismissedVersion));
  }, [runtimeVersion]);

  const dismiss = () => {
    if (runtimeVersion !== undefined) {
      dismissedRuntimeVersion.current = runtimeVersion;
      writeWelcomeDismissal(runtimeVersion);
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          dismiss();
        }
      }}
    >
      <Dialog.Content
        className="max-w-xl"
        initialFocus={() => document.getElementById(dismissButtonId)}
        showCloseButton={false}
      >
        <ScrollArea className="max-h-80 pr-4">
          <ReleaseContent />
        </ScrollArea>
        <Dialog.Footer>
          <Button id={dismissButtonId} onClick={dismiss}>
            Got it
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
