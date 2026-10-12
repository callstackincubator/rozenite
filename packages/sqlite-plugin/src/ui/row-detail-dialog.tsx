import { Button, Dialog, JsonInspector } from '@rozenite/ui';

type RowDetailDialogProps = {
  open: boolean;
  title: string;
  value: unknown;
  onOpenChange: (open: boolean) => void;
};

export const RowDetailDialog = ({ open, title, value, onOpenChange }: RowDetailDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <Dialog.Content className="max-w-3xl" aria-label={title}>
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>Inspect the selected row in full detail.</Dialog.Description>
      </Dialog.Header>

      <div className="max-h-[60vh] overflow-auto border border-border bg-muted p-3">
        <JsonInspector
          data={value}
          defaultExpandedDepth={2}
          className="[&_[data-slot=json-inspector-leaf]>span:first-child:not(:last-child)]:shrink-0 [&_[data-slot=json-inspector-leaf]>span:last-child]:min-w-0 [&_[data-slot=json-inspector-leaf]>span:last-child]:break-all"
        />
      </div>

      <Dialog.Footer>
        <Dialog.Close render={<Button tone="neutral" variant="outline" />}>Close</Dialog.Close>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog>
);
