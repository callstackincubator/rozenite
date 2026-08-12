import { Switch } from '@rozenite/ui';
import { useState } from 'react';
import type { FeatureFlag, FeatureFlagValue } from '../shared/types';
import { parseNumberInput } from './value-parsing';

const JSON_PREVIEW_MAX_LENGTH = 120;

/** A one-line `JSON.stringify` preview, clipped with an ellipsis -- the
 * `{…}` chip used to be a static placeholder that never reflected the
 * flag's actual value, so two different json flags looked identical. */
const previewJson = (value: FeatureFlagValue): string => {
  const serialized = JSON.stringify(value) ?? String(value);
  return serialized.length > JSON_PREVIEW_MAX_LENGTH
    ? `${serialized.slice(0, JSON_PREVIEW_MAX_LENGTH)}…`
    : serialized;
};

export type FlagValueCellProps = {
  flag: FeatureFlag;
  disabled?: boolean;
  /** Resolves `true`/`false` for success/failure; this cell doesn't act on
   * the result (there's no draft to preserve here, unlike `JsonFlagDialog`). */
  onChange: (value: FeatureFlagValue) => Promise<boolean>;
  onOpenJson: () => void;
};

/**
 * Renders a flag's value editable inline, by type: a `Switch` for boolean
 * (one click, per design §7), a click-to-edit text field for string/number,
 * and a `{…}` chip opening `JsonFlagDialog` for json.
 */
export function FlagValueCell({
  flag,
  disabled = false,
  onChange,
  onOpenJson,
}: FlagValueCellProps) {
  if (flag.type === 'boolean') {
    return (
      <Switch
        checked={flag.value === true}
        onCheckedChange={(checked) => void onChange(checked)}
        disabled={disabled}
        aria-label={`Toggle ${flag.key}`}
      />
    );
  }

  if (flag.type === 'json') {
    return (
      <button
        type="button"
        onClick={onOpenJson}
        disabled={disabled}
        title={JSON.stringify(flag.value)}
        aria-label={`Edit JSON value for ${flag.key}`}
        className="max-w-md truncate rounded-sm border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        {previewJson(flag.value)}
      </button>
    );
  }

  return <TextValueCell flag={flag} disabled={disabled} onChange={onChange} />;
}

function TextValueCell({
  flag,
  disabled,
  onChange,
}: {
  flag: FeatureFlag;
  disabled: boolean;
  onChange: (value: FeatureFlagValue) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => String(flag.value));
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setDraft(String(flag.value));
          setError(null);
          setEditing(true);
        }}
        aria-label={`Edit value for ${flag.key}`}
        title={String(flag.value)}
        className="block w-full truncate rounded-sm px-1 py-0.5 text-left font-mono text-sm text-foreground hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-50"
      >
        {String(flag.value)}
      </button>
    );
  }

  const commit = () => {
    if (flag.type === 'number') {
      const result = parseNumberInput(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setError(null);
      // The equality shortcut is only safe when the flag is already
      // overridden to this value -- typing the *current effective* value of
      // a non-overridden flag must still create an override, otherwise
      // there's no way to pin a flag to its current value (it keeps
      // following the next remote update).
      if (!flag.overridden || result.value !== flag.value) {
        void onChange(result.value);
      }
      return;
    }

    setEditing(false);
    setError(null);
    if (!flag.overridden || draft !== flag.value) {
      void onChange(draft);
    }
  };

  return (
    <div className="flex flex-col gap-0.5">
      <input
        autoFocus
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
          } else if (event.key === 'Escape') {
            setEditing(false);
            setError(null);
          }
        }}
        aria-invalid={error != null}
        className="w-full rounded-sm border border-ring bg-transparent px-1 py-0.5 font-mono text-sm outline-none"
      />
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
