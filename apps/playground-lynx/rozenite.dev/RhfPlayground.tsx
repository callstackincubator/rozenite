import { useController, useForm } from 'react-hook-form';
import { useRozeniteRHFPlugin } from '@rozenite/rhf-plugin';

import { Group, Row } from '../src/ui.jsx';

type DemoForm = {
  email: string;
};

/**
 * Minimal React Hook Form playground: one registered, validated field, so the
 * panel has a form whose value, dirty and error state it can watch, and which
 * it can reset remotely.
 */
export function RhfPlayground() {
  const { control, reset } = useForm<DemoForm>({
    defaultValues: { email: '' },
    mode: 'onChange',
  });

  // `useController` registers the field with the form. Without a registered
  // field the panel finds the form but reports no fields to inspect.
  const { field, fieldState } = useController({
    control,
    name: 'email',
    rules: {
      required: 'Email is required',
      pattern: { value: /.+@.+\..+/, message: 'Must be an email address' },
    },
  });

  useRozeniteRHFPlugin({ control, id: 'lynx-demo', reset });

  return (
    <Group title="React Hook Form">
      <Row label="Value" value={field.value || '-'} />
      <Row label="Error" value={fieldState.error?.message ?? 'none'} />
      <Row
        label="Email"
        last
        trailing={
          <input
            className="Input"
            type="email"
            placeholder="you@example.com"
            bindinput={(event) => field.onChange(event.detail.value)}
            bindblur={() => field.onBlur()}
          />
        }
      />
    </Group>
  );
}
