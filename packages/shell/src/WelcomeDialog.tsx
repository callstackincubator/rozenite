import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, ScrollArea } from '@rozenite/ui';
import { ReleaseContent, WELCOME_RELEASE_ID } from './ReleaseContent';
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
  const dismissedReleaseId = useRef<string | null>(null);

  useEffect(() => {
    const isDismissed =
      dismissedReleaseId.current === WELCOME_RELEASE_ID ||
      readWelcomeDismissal(WELCOME_RELEASE_ID);

    setOpen(
      shouldShowWelcomeDialog(
        runtimeVersion,
        WELCOME_RELEASE_ID,
        isDismissed,
      ),
    );
  }, [runtimeVersion]);

  const dismiss = () => {
    dismissedReleaseId.current = WELCOME_RELEASE_ID;
    writeWelcomeDismissal(WELCOME_RELEASE_ID);
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
      <Dialog.Content className="max-w-xl" showCloseButton={false}>
        <Dialog.Header>
          <Dialog.Title>Welcome to Rozenite {WELCOME_RELEASE_ID}</Dialog.Title>
          <Dialog.Description>
            Here is what is new in this release.
          </Dialog.Description>
        </Dialog.Header>
        <ScrollArea className="max-h-80 pr-4">
          <ReleaseContent />
        </ScrollArea>
        <Dialog.Footer>
          <Button onClick={dismiss}>Got it</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
