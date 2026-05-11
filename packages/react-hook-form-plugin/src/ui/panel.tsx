import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { RHFEventMap, RHFUpdateEvent } from '../shared/messaging';
import type { FieldError, FormSnapshot } from '../shared/types';
import './globals.css';

const PLUGIN_ID = '@rozenite/react-hook-form-plugin';

function Badge({
  label,
  active,
  color,
}: {
  label: string;
  active: boolean;
  color: string;
}) {
  if (!active) return null;
  return (
    <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${color}`}>
      {label}
    </span>
  );
}

function ErrorBadge({ error }: { error?: FieldError }) {
  if (!error?.type && !error?.message) return null;
  return (
    <span
      className="px-1.5 py-0.5 text-xs rounded font-medium bg-red-900 text-red-200 truncate max-w-[200px]"
      title={error.message}
    >
      {error.message || error.type}
    </span>
  );
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function FormStateBar({ formState }: { formState: FormSnapshot['formState'] }) {
  const badges = [
    { label: 'valid', active: formState.isValid, color: 'bg-green-800 text-green-200' },
    { label: 'invalid', active: !formState.isValid, color: 'bg-red-900 text-red-200' },
    { label: 'dirty', active: formState.isDirty, color: 'bg-yellow-800 text-yellow-200' },
    { label: 'submitting', active: formState.isSubmitting, color: 'bg-blue-800 text-blue-200' },
    { label: 'submitted', active: formState.isSubmitted, color: 'bg-purple-800 text-purple-200' },
    { label: 'validating', active: formState.isValidating, color: 'bg-orange-800 text-orange-200' },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {badges.map((b) => (
        <Badge key={b.label} {...b} />
      ))}
      <span className="text-xs text-gray-400 ml-1">
        submits: {formState.submitCount}
      </span>
    </div>
  );
}

function FieldTable({
  snapshot,
  searchTerm,
}: {
  snapshot: FormSnapshot;
  searchTerm: string;
}) {
  const fieldNames = Object.keys(snapshot.formValues);
  const filtered = useMemo(
    () =>
      fieldNames.filter((name) =>
        name.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [fieldNames, searchTerm]
  );

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center w-full">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">No fields found</h3>
        <p className="text-gray-400 text-sm">
          {searchTerm ? 'Try adjusting your search' : 'No registered fields'}
        </p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead className="sticky top-0 bg-gray-800 z-10">
        <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
          <th className="px-3 py-2 font-medium border-b border-gray-700 w-1/3">Field</th>
          <th className="px-3 py-2 font-medium border-b border-gray-700">Value</th>
          <th className="px-3 py-2 font-medium border-b border-gray-700 w-40">State</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((name) => {
          const value = snapshot.formValues[name];
          const error = snapshot.formState.errors[name];
          const dirty = snapshot.formState.dirtyFields[name];
          const touched = snapshot.formState.touchedFields[name];

          return (
            <tr
              key={name}
              className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
            >
              <td className="px-3 py-2 text-gray-200 font-mono text-xs truncate max-w-[200px]" title={name}>
                {name}
              </td>
              <td className="px-3 py-2 text-gray-300 font-mono text-xs">
                <span className="truncate block max-w-[300px]" title={formatValue(value)}>
                  {formatValue(value)}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge label="dirty" active={!!dirty} color="bg-yellow-800 text-yellow-200" />
                  <Badge label="touched" active={!!touched} color="bg-blue-900 text-blue-200" />
                  <ErrorBadge error={error} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function ReactHookFormPanel() {
  const [snapshots, setSnapshots] = useState<Map<string, FormSnapshot>>(new Map());
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const client = useRozeniteDevToolsClient<RHFEventMap>({ pluginId: PLUGIN_ID });

  useEffect(() => {
    if (!client) return;

    const subscription = client.onMessage('update', (event: RHFUpdateEvent) => {
      const { snapshot } = event;
      setSnapshots((prev) => {
        const next = new Map(prev);
        next.set(snapshot.id, snapshot);
        return next;
      });
      setSelectedFormId((prev) => prev ?? snapshot.id);
    });

    return () => {
      subscription.remove();
    };
  }, [client]);

  const selectedSnapshot = selectedFormId ? snapshots.get(selectedFormId) ?? null : null;
  const formOptions = [...snapshots.entries()].map(([id, snap], index) => ({
    id,
    label: `Form ${index + 1}`,
    fieldCount: Object.keys(snap.formValues).length,
  }));

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
        <span className="text-sm font-medium text-gray-200">React Hook Form</span>
        <div className="flex-1" />
        {formOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="form-select" className="text-xs text-gray-400">
              Form:
            </label>
            <select
              id="form-select"
              value={selectedFormId ?? ''}
              onChange={(e) => setSelectedFormId(e.target.value)}
              className="h-8 px-2 text-xs bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {formOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} ({opt.fieldCount} fields)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedSnapshot && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-gray-800">
          <FormStateBar formState={selectedSnapshot.formState} />
        </div>
      )}

      <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 w-full pl-8 pr-3 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <main className="flex flex-1 min-h-0 overflow-auto">
        {selectedSnapshot ? (
          <FieldTable snapshot={selectedSnapshot} searchTerm={searchTerm} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center w-full">
            <h2 className="text-xl font-semibold text-gray-200 mb-2">
              React Hook Form Inspector
            </h2>
            <p className="text-gray-400 text-sm">
              Call <code className="text-blue-400">useRozeniteRHFPlugin({'{ control }'})</code> in your form component
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
