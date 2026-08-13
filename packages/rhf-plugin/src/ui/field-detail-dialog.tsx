import { Badge, DescriptionList, Dialog, JsonInspector } from '@rozenite/ui';
import { FormInput } from 'lucide-react';
import type { FieldError, FormSnapshot } from '../shared/types';
import { formatValue } from './format-value';

export type FieldDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string | null;
  snapshot: FormSnapshot | null;
};

const isInspectable = (value: unknown): boolean => value !== null && typeof value === 'object';

export function FieldDetailDialog({ open, onOpenChange, name, snapshot }: FieldDetailDialogProps) {
  const value = name && snapshot ? snapshot.formValues[name] : undefined;
  const error: FieldError | undefined =
    name && snapshot ? snapshot.formState.errors[name] : undefined;
  const dirty = name && snapshot ? Boolean(snapshot.formState.dirtyFields[name]) : false;
  const touched = name && snapshot ? Boolean(snapshot.formState.touchedFields[name]) : false;
  const type = name && snapshot ? snapshot.formState.nativeFields[name] : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-lg">
        <Dialog.Header>
          <div className="flex items-center gap-2">
            <FormInput className="h-4 w-4 text-muted-foreground" />
            <Dialog.Title className="break-all font-mono">{name}</Dialog.Title>
          </div>
        </Dialog.Header>

        {name && snapshot && (
          <div className="flex max-h-[70vh] flex-col gap-4 overflow-auto">
            <div>
              <div className="mb-1 text-sm font-medium text-foreground">Value</div>
              <div className="max-h-64 overflow-auto rounded-md border border-input bg-muted p-3">
                {isInspectable(value) ? (
                  <JsonInspector data={value} />
                ) : (
                  <span className="break-all font-mono text-sm text-foreground">
                    {formatValue(value)}
                  </span>
                )}
              </div>
            </div>

            <DescriptionList>
              <DescriptionList.Item label="Type">
                {type ?? <span className="text-muted-foreground">unknown</span>}
              </DescriptionList.Item>
              <DescriptionList.Item label="State">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={dirty ? 'default' : 'outline'}>
                    {dirty ? 'dirty' : 'pristine'}
                  </Badge>
                  <Badge variant={touched ? 'default' : 'outline'}>
                    {touched ? 'touched' : 'untouched'}
                  </Badge>
                </div>
              </DescriptionList.Item>
              <DescriptionList.Item label="Error">
                {error?.type || error?.message ? (
                  <div className="flex flex-col gap-1">
                    {error.type && <Badge variant="secondary">{error.type}</Badge>}
                    {error.message && (
                      <span className="text-sm text-destructive">{error.message}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">none</span>
                )}
              </DescriptionList.Item>
            </DescriptionList>
          </div>
        )}
      </Dialog.Content>
    </Dialog>
  );
}
