import { Field as FieldPrimitive } from '@base-ui/react/field';
import { cn } from '../utils/cn';

export type FieldProps = FieldPrimitive.Root.Props;

function FieldRoot({ className, ...props }: FieldProps) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn('flex flex-col gap-1.5', className)}
      {...props}
    />
  );
}

export type FieldLabelProps = FieldPrimitive.Label.Props;

function FieldLabel({ className, ...props }: FieldLabelProps) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn('text-sm font-medium text-foreground', className)}
      {...props}
    />
  );
}

export type FieldControlProps = FieldPrimitive.Control.Props;

function FieldControl({ className, ...props }: FieldControlProps) {
  return (
    <FieldPrimitive.Control
      data-slot="field-control"
      className={cn(
        'h-8 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs',
        'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
        'placeholder:text-muted-foreground disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export type FieldDescriptionProps = FieldPrimitive.Description.Props;

function FieldDescription({ className, ...props }: FieldDescriptionProps) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

export type FieldErrorProps = FieldPrimitive.Error.Props;

function FieldError({ className, ...props }: FieldErrorProps) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      className={cn('text-xs text-destructive', className)}
      {...props}
    />
  );
}

/** A labeled form field grouping control, description, and validation text. */
export const Field = Object.assign(FieldRoot, {
  Label: FieldLabel,
  Control: FieldControl,
  Description: FieldDescription,
  Error: FieldError,
});
