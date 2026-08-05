import { Badge, Button, Dialog, JsonInspector } from '@rozenite/ui';
import { useMemo } from 'react';
import { Edit3, Info } from 'lucide-react';
import type { StorageEntry } from '../shared/types';
import { bytesToHexdump } from './binary';
import { formatValue } from './format-value';

export type EntryDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (entry: StorageEntry) => void;
  entry: StorageEntry | null;
};

export const jsonSafeParse = (
  value: string,
): Record<string, unknown> | unknown[] | null => {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }

    return null;
  } catch {
    return null;
  }
};

export const EntryDetailDialog = ({
  open,
  onOpenChange,
  onEdit,
  entry,
}: EntryDetailDialogProps) => {
  const isStringValue = entry?.type === 'string';
  const stringValue = isStringValue ? entry.value : '';
  const jsonValue = useMemo(
    () => (isStringValue ? jsonSafeParse(stringValue) : null),
    [isStringValue, stringValue],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-2xl">
        <Dialog.Header>
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <Dialog.Title>Entry Details</Dialog.Title>
          </div>
        </Dialog.Header>

        {entry && (
          <div className="flex max-h-[70vh] flex-col gap-4 overflow-auto">
            <div>
              <div className="mb-1 text-sm font-medium text-foreground">
                Key
              </div>
              <div className="w-full break-all rounded-md border border-input bg-muted px-3 py-2 font-mono text-sm text-foreground">
                {entry.key}
              </div>
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-foreground">
                Type
              </div>
              <Badge variant="outline">{entry.type}</Badge>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-1 text-sm font-medium text-foreground">
                Value
              </div>
              <div className="max-h-96 overflow-auto rounded-md border border-input bg-muted p-3">
                {jsonValue ? (
                  <JsonInspector data={jsonValue} />
                ) : entry.type === 'buffer' ? (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs text-muted-foreground">
                      {entry.value.length}{' '}
                      {entry.value.length === 1 ? 'byte' : 'bytes'}
                    </div>
                    <pre className="overflow-auto whitespace-pre font-mono text-xs leading-snug text-foreground">
                      {bytesToHexdump(entry.value)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-sm">{formatValue(entry)}</div>
                )}
              </div>
            </div>
          </div>
        )}

        <Dialog.Footer>
          {entry && onEdit && (
            <Button variant="outline" onClick={() => onEdit(entry)}>
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          <Dialog.Close render={<Button />}>Close</Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
};
