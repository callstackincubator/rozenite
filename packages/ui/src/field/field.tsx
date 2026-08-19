import { Field as FieldPrimitive } from '@base-ui/react/field';
import { cn } from '../utils/cn';
import { fieldSurface } from '../utils/control-surfaces';
import type { Size } from '../tokens/size';

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

export type FieldControlProps = Omit<FieldPrimitive.Control.Props, 'size'> & {
  /** @default 'md' */
  size?: Size;
};

function FieldControl({ className, size = 'md', ...props }: FieldControlProps) {
  return (
    <FieldPrimitive.Control
      data-slot="field-control"
      className={cn(fieldSurface({ size }), className)}
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
      className={cn('text-xs text-danger', className)}
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
