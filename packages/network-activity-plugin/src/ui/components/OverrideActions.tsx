import { Check, CircleSlash2, Pencil } from 'lucide-react';
import { Button } from './Button';
import { RequestOverride } from '../../shared/client';

export type OverrideActionsProps = {
  currentData: RequestOverride | undefined;
  initialData: RequestOverride | undefined;
  onOverride: () => void;
  onSaveOverride: () => void;
  onClear: () => void;
};

export const OverrideActions = ({
  currentData,
  initialData,
  onOverride,
  onSaveOverride,
  onClear,
}: OverrideActionsProps) => {
  const hasChanges =
    currentData?.body !== initialData?.body ||
    currentData?.status !== initialData?.status;

  const hasOverride = initialData !== undefined;

  const AddOverrideAction = (
    <Button
      variant="ghost"
      size="xs"
      className="text-violet-300 hover:text-violet-300"
      onClick={onOverride}
    >
      <Pencil className="h-2 w-2" />
      Override
    </Button>
  );

  const SaveOverrideAction = (
    <Button
      variant="ghost"
      size="xs"
      className="text-violet-300 hover:text-violet-300"
      onClick={onSaveOverride}
      disabled={!hasChanges}
    >
      <Check className="h-2 w-2" />
      {hasChanges ? 'Save override' : 'Saved'}
    </Button>
  );

  const ClearOverrideAction = (
    <Button
      variant="ghost"
      size="xs"
      className="text-violet-300 hover:text-violet-300 ms-2"
      onClick={onClear}
    >
      <CircleSlash2 className="h-2 w-2" />
      Clear override
    </Button>
  );

  return (
    <>
      {hasOverride && ClearOverrideAction}

      {hasOverride ? SaveOverrideAction : AddOverrideAction}
    </>
  );
};
