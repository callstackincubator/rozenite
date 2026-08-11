import { Button, Dialog, Field, Textarea } from '@rozenite/ui';
import { useEffect, useRef, useState } from 'react';
import type { JsonValue } from '../shared/types';
import { parseJsonInput } from './value-parsing';

export type JsonFlagDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flagKey: string | null;
  value: JsonValue | null;
  /** Resolves `true` on a successful write, `false` on failure. The dialog
   * stays open with the draft intact on `false` -- the caller is still
   * responsible for surfacing the error (e.g. a toast). */
  onSave: (value: JsonValue) => Promise<boolean>;
};

/** The `{…}` chip's editor for `json`-typed flags -- there's no right-hand
 * detail pane (design §10), so this dialog is the only way to edit one. */
export function JsonFlagDialog({
  open,
  onOpenChange,
  flagKey,
  value,
  onSave,
}: JsonFlagDialogProps) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Read by the reset effect below without being a dependency of it, so a
  // `flags-changed`-triggered snapshot refetch while the dialog is open
  // (which changes `value`'s identity) doesn't clobber the user's draft.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (open) {
      setDraft(JSON.stringify(valueRef.current, null, 2));
      setSaving(false);
    }
    // Reset only when the dialog opens or the target flag changes, not on
    // every new `value` identity -- see `valueRef` above.
  }, [open, flagKey]);

  const result = parseJsonInput(draft);
  const error = result.ok ? null : result.error;

  const handleSave = async () => {
    if (!result.ok) {
      return;
    }
    setSaving(true);
    try {
      const success = await onSave(result.value as JsonValue);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Edit {flagKey}</Dialog.Title>
          <Dialog.Description>Overrides this flag's value with the JSON below.</Dialog.Description>
        </Dialog.Header>
        <Field invalid={error != null}>
          <Textarea
            className="min-h-48 font-mono text-xs"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            autoFocus
          />
          {error && <Field.Error match>{error}</Field.Error>}
        </Field>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="outline" />}>Cancel</Dialog.Close>
          <Button onClick={handleSave} disabled={!result.ok || saving}>
            {saving ? 'Saving…' : 'Save override'}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
