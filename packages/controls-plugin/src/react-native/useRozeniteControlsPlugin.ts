import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ControlsEventMap,
  ControlsInvokeActionEvent,
  ControlsUpdateRequestEvent,
} from '../shared/messaging';
import type { RozeniteControlsPluginOptionsInput } from '../shared/types';
import {
  buildActionRegistry,
  getActionRegistryKey,
  serializeSections,
  validateValue,
} from '../shared/serialization';
import { useControlsAgentTools } from './useControlsAgentTools';
import { controlsRegistry } from './controlsRegistry';

export const useRozeniteControlsPlugin = (
  optionsInput: RozeniteControlsPluginOptionsInput,
) => {
  const client = useRozeniteDevToolsClient<ControlsEventMap>({
    pluginId: '@rozenite/controls-plugin',
  });
  const registrationIdRef = useRef<symbol>(Symbol('rozenite-controls'));
  const [ownerVersion, setOwnerVersion] = useState(0);
  const registrationId = registrationIdRef.current;

  useEffect(() => {
    const unsubscribe = controlsRegistry.subscribe(() => {
      setOwnerVersion((version) => version + 1);
    });

    setOwnerVersion((version) => version + 1);

    return unsubscribe;
  }, []);

  useEffect(() => {
    return () => {
      controlsRegistry.delete(registrationId);
    };
  }, [registrationId]);

  useEffect(() => {
    controlsRegistry.set(registrationId, optionsInput);
  }, [optionsInput, registrationId]);

  const isRegistryOwner = useMemo(
    () =>
      controlsRegistry.isOwner(registrationId, {
        id: registrationId,
        input: optionsInput,
      }),
    [optionsInput, ownerVersion, registrationId],
  );

  useControlsAgentTools(
    () => controlsRegistry.getOptions().sections,
    isRegistryOwner,
  );

  useEffect(() => {
    if (!client) {
      return;
    }

    client.send('snapshot', {
      type: 'snapshot',
      sections: serializeSections(controlsRegistry.getOptions().sections),
    });
  }, [client, optionsInput, ownerVersion]);

  useEffect(() => {
    if (!client || !isRegistryOwner) {
      return;
    }

    const handleUpdateRequest = async ({
      requestId,
      sectionId,
      itemId,
      value,
    }: ControlsUpdateRequestEvent) => {
      const key = getActionRegistryKey(sectionId, itemId);
      const entry = buildActionRegistry(
        controlsRegistry.getOptions().sections,
      ).get(key);

      if (!entry || entry.type === 'button') {
        client.send('update-result', {
          type: 'update-result',
          requestId,
          sectionId,
          itemId,
          status: 'error',
          message: 'Update target not found.',
        });
        return;
      }

      try {
        if (entry.type === 'toggle') {
          if (typeof value !== 'boolean') {
            client.send('update-result', {
              type: 'update-result',
              requestId,
              sectionId,
              itemId,
              status: 'error',
              message: 'Invalid toggle value.',
            });
            return;
          }

          const result = validateValue(entry.validate, value);
          if (!result.valid) {
            client.send('update-result', {
              type: 'update-result',
              requestId,
              sectionId,
              itemId,
              status: 'error',
              message: result.message,
            });
            return;
          }

          await entry.onUpdate(value);
          client.send('update-result', {
            type: 'update-result',
            requestId,
            sectionId,
            itemId,
            status: 'ok',
          });
          return;
        }

        if (typeof value !== 'string') {
          client.send('update-result', {
            type: 'update-result',
            requestId,
            sectionId,
            itemId,
            status: 'error',
            message: `Invalid ${entry.type} value.`,
          });
          return;
        }

        const result = validateValue(entry.validate, value);
        if (!result.valid) {
          client.send('update-result', {
            type: 'update-result',
            requestId,
            sectionId,
            itemId,
            status: 'error',
            message: result.message,
          });
          return;
        }

        await entry.onUpdate(value);
        client.send('update-result', {
          type: 'update-result',
          requestId,
          sectionId,
          itemId,
          status: 'ok',
        });
      } catch (error) {
        console.warn(
          `[Rozenite] Controls Plugin: Update failed for ${sectionId}/${itemId}.`,
          error,
        );
        client.send('update-result', {
          type: 'update-result',
          requestId,
          sectionId,
          itemId,
          status: 'error',
          message: 'Update failed on the device.',
        });
      }
    };

    const handleInvokeAction = async ({
      sectionId,
      itemId,
      action,
    }: ControlsInvokeActionEvent) => {
      if (action !== 'press') {
        console.warn(
          `[Rozenite] Controls Plugin: Unsupported action "${action}" for ${sectionId}/${itemId}.`,
        );
        return;
      }

      const key = getActionRegistryKey(sectionId, itemId);
      const entry = buildActionRegistry(
        controlsRegistry.getOptions().sections,
      ).get(key);

      if (!entry) {
        console.warn(
          `[Rozenite] Controls Plugin: Action target not found for ${sectionId}/${itemId}.`,
        );
        return;
      }

      try {
        if (entry.type !== 'button') {
          console.warn(
            `[Rozenite] Controls Plugin: Invalid press action payload for ${sectionId}/${itemId}.`,
          );
          return;
        }

        await entry.onPress();
      } catch (error) {
        console.warn(
          `[Rozenite] Controls Plugin: Action failed for ${sectionId}/${itemId}.`,
          error,
        );
      }
    };

    const subscriptions = [
      client.onMessage('get-snapshot', () => {
        client.send('snapshot', {
          type: 'snapshot',
          sections: serializeSections(controlsRegistry.getOptions().sections),
        });
      }),
      client.onMessage(
        'update-request',
        (event: ControlsUpdateRequestEvent) => {
          void handleUpdateRequest(event);
        },
      ),
      client.onMessage('invoke-action', (event: ControlsInvokeActionEvent) => {
        void handleInvokeAction(event);
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [client, isRegistryOwner]);

  return client;
};
