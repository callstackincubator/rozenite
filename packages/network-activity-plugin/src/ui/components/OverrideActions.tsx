import { Check, CircleSlash2, Pencil } from 'lucide-react';
import { Button } from './Button';

export type OverrideActionsProps = {
  currentData: string | null;
  initialData: string | null;
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
  const hasChanges = currentData !== initialData;

  const hasOverride = initialData !== null;

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
