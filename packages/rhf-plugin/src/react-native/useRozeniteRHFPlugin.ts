import get from 'lodash/get';
import { useEffect, useId, useRef } from 'react';
import type { Control, FieldValues } from 'react-hook-form';
import { useFormState, useWatch } from 'react-hook-form';
import equal from 'fast-deep-equal';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { RHFEventMap } from '../shared/messaging';
import type { FieldError, FormSnapshot } from '../shared/types';
import { nestToFlat, proxyToObject } from './utils';

const PLUGIN_ID = '@rozenite/rhf-plugin';

export type UseRozeniteRHFPluginOptions<T extends FieldValues> = {
  control: Control<T>;
  id?: string;
};

export const useRozeniteRHFPlugin = <T extends FieldValues>({
  control,
  id: providedId,
}: UseRozeniteRHFPluginOptions<T>) => {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  const nestedFormValues = useWatch({ control });
  const formState = useFormState({ control });

  const client = useRozeniteDevToolsClient<RHFEventMap>({ pluginId: PLUGIN_ID });

  const previousSnapshotRef = useRef<FormSnapshot | null>(null);

  useEffect(() => {
    if (!client) {
      return;
    }

    const {
      errors: nestedErrors,
      dirtyFields: nestedDirtyFields,
      touchedFields: nestedTouchedFields,
      ...formStatus
    } = proxyToObject(formState as unknown as Record<string, unknown>);

    const flatFieldNames = [...(control as unknown as { _names: { mount: Set<string> } })._names.mount];

    const formValues = nestToFlat<unknown>(flatFieldNames, nestedFormValues as object, '');
    const dirtyFields = nestToFlat<boolean>(flatFieldNames, nestedDirtyFields as object, false);
    const touchedFields = nestToFlat<boolean>(flatFieldNames, nestedTouchedFields as object, false);
    const flatErrors = nestToFlat<FieldError>(flatFieldNames, nestedErrors as object);

    const errors = Object.entries(flatErrors).reduce(
      (prev, [key, value]) => {
        prev[key] = {
          type: value?.type,
          message: value?.message,
        };
        return prev;
      },
      {} as Record<string, FieldError>
    );

    const nativeFields = flatFieldNames.reduce(
      (prev, name) => {
        const field = get(
          (control as unknown as { _fields: Record<string, unknown> })._fields,
          name
        ) as { _f?: { ref?: { type?: string } } } | undefined;
        prev[name] = field?._f?.ref?.type;
        return prev;
      },
      {} as Record<string, string | undefined>
    );

    const snapshot: FormSnapshot = {
      id,
      formValues,
      formState: {
        errors,
        dirtyFields,
        touchedFields,
        nativeFields,
        submitCount: (formStatus.submitCount as number) ?? 0,
        isSubmitted: (formStatus.isSubmitted as boolean) ?? false,
        isSubmitting: (formStatus.isSubmitting as boolean) ?? false,
        isSubmitSuccessful: (formStatus.isSubmitSuccessful as boolean) ?? false,
        isValid: (formStatus.isValid as boolean) ?? false,
        isValidating: (formStatus.isValidating as boolean) ?? false,
        isDirty: (formStatus.isDirty as boolean) ?? false,
      },
    };

    if (equal(previousSnapshotRef.current, snapshot)) {
      return;
    }

    previousSnapshotRef.current = snapshot;

    client.send('update', {
      type: 'update',
      snapshot,
    });
  });

  useEffect(() => {
    if (!client) {
      return;
    }
    return () => {
      client.send('unmount', { type: 'unmount', id });
    };
  }, [client, id]);
};
