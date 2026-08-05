import { cn } from '@rozenite/ui';
import type { StorageEntryType } from '../shared/types';

const TYPE_LABELS: Record<StorageEntryType, string> = {
  string: 'Text',
  number: 'Number',
  boolean: 'Boolean',
  buffer: 'Hex',
};

// Visual ordering of the pills. Keep `string` first because it's the
// most common landing type after a fresh read on an MMKV key.
const TYPE_ORDER: StorageEntryType[] = [
  'string',
  'number',
  'boolean',
  'buffer',
];

export type EditorSwitcherProps = {
  supportedTypes: StorageEntryType[];
  value: StorageEntryType;
  onChange: (type: StorageEntryType) => void;
};

export const EditorSwitcher = ({
  supportedTypes,
  value,
  onChange,
}: EditorSwitcherProps) => {
  const available = TYPE_ORDER.filter((type) => supportedTypes.includes(type));

  // Adaptive hide: the switcher is meaningless when the backend only
  // supports one type.
  if (available.length <= 1) {
    return null;
  }

  return (
    <div
      role="tablist"
      aria-label="Edit as"
      className="inline-flex overflow-hidden rounded-md border border-border"
    >
      {available.map((type) => (
        <button
          key={type}
          type="button"
          role="tab"
          aria-selected={value === type}
          onClick={() => onChange(type)}
          className={cn(
            'px-3 py-1 text-xs font-medium transition-colors',
            value === type
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          {TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );
};
