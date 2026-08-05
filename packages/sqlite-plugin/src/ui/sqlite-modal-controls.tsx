import { X } from 'lucide-react';

const toneButtonClassName =
  'sqlite-button inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium';

export const sqliteSecondaryButtonClassName = `${toneButtonClassName} sqlite-button-secondary`;
export const sqlitePrimaryButtonClassName = `${toneButtonClassName} sqlite-button-primary`;
export const sqliteModalIconButtonClassName = `${sqliteSecondaryButtonClassName} h-10 w-10 shrink-0 px-0 py-0`;

type SqliteModalCloseButtonProps = {
  onClose: () => void;
  disabled?: boolean;
  ariaLabel?: string;
};

export const SqliteModalCloseButton = ({
  onClose,
  disabled = false,
  ariaLabel = 'Close modal',
}: SqliteModalCloseButtonProps) => {
  return (
    <button
      type="button"
      className={sqliteModalIconButtonClassName}
      aria-label={ariaLabel}
      onClick={onClose}
      disabled={disabled}
    >
      <X aria-hidden="true" className="h-4 w-4" />
    </button>
  );
};
