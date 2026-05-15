import type { StorageEntryType, StorageEntryValue } from '../shared/types';
import { BinaryValueEditor } from './binary-value-editor';
import { EditorSwitcher } from './editor-switcher';
import { convertValue, defaultValueForType } from './type-conversion';

export type TypedValueEditorProps = {
  supportedTypes: StorageEntryType[];
  type: StorageEntryType;
  // `null` signals "the current input is unsavable" — used by the hex
  // editor for unparseable hex or empty input. Non-buffer types never
  // emit null. Callers should disable Save when value is null.
  value: StorageEntryValue | null;
  onChange: (type: StorageEntryType, value: StorageEntryValue | null) => void;
  // `id` is forwarded to the underlying input so callers can wire up
  // <label htmlFor>. The hex editor (which has no single input) ignores
  // it — there's no useful target.
  inputId?: string;
  autoFocus?: boolean;
};

// Renders the switcher + the type-specific value editor. Switching
// type runs `convertValue` so the user lands on a sensible starting
// point in the new editor instead of an empty field.
export const TypedValueEditor = ({
  supportedTypes,
  type,
  value,
  onChange,
  inputId,
  autoFocus,
}: TypedValueEditorProps) => {
  const handleTypeChange = (newType: StorageEntryType) => {
    if (newType === type) return;
    if (value === null) {
      // Source value is currently unparseable — nothing meaningful to
      // carry forward, land on the destination type's default.
      onChange(newType, defaultValueForType(newType));
      return;
    }
    onChange(newType, convertValue(type, newType, value));
  };

  return (
    <div className="space-y-2">
      <EditorSwitcher
        supportedTypes={supportedTypes}
        value={type}
        onChange={handleTypeChange}
      />

      {type === 'buffer' ? (
        <BinaryValueEditor
          initialBytes={Array.isArray(value) ? value : undefined}
          onChange={(bytes) => onChange('buffer', bytes)}
        />
      ) : type === 'boolean' ? (
        <select
          id={inputId}
          value={String(value ?? false)}
          onChange={(event) =>
            onChange('boolean', event.target.value === 'true')
          }
          className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus={autoFocus}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : type === 'number' ? (
        <input
          id={inputId}
          type="number"
          value={String(value ?? '')}
          onChange={(event) => {
            const next = event.target.value;
            const parsed = next === '' ? 0 : Number(next);
            onChange('number', Number.isNaN(parsed) ? 0 : parsed);
          }}
          placeholder="Enter number value"
          className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus={autoFocus}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          value={String(value ?? '')}
          onChange={(event) => onChange('string', event.target.value)}
          placeholder="Enter string value"
          className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus={autoFocus}
        />
      )}
    </div>
  );
};
