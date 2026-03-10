import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo, useRef } from 'react';
import type {
  ControlsEventMap,
  ControlsInvokeActionEvent,
} from '../shared/messaging';
import type { RozeniteControlsPluginOptions } from '../shared/types';
import {
  buildActionRegistry,
  getActionRegistryKey,
  serializeSections,
} from '../shared/serialization';

export const useRozeniteControlsPlugin = ({
  sections,
}: RozeniteControlsPluginOptions) => {
  const client = useRozeniteDevToolsClient<ControlsEventMap>({
    pluginId: '@rozenite/controls-plugin',
  });

  const snapshot = useMemo(() => serializeSections(sections), [sections]);
  const actionRegistry = useMemo(() => buildActionRegistry(sections), [sections]);
  const actionRegistryRef = useRef(actionRegistry);

  useEffect(() => {
    actionRegistryRef.current = actionRegistry;
  }, [actionRegistry]);

  useEffect(() => {
    if (!client) {
      return;
    }

    client.send('snapshot', {
      type: 'snapshot',
      sections: snapshot,
    });
  }, [client, snapshot]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const handleInvokeAction = async ({
      sectionId,
      itemId,
      action,
      value,
    }: ControlsInvokeActionEvent) => {
      const key = getActionRegistryKey(sectionId, itemId);
      const entry = actionRegistryRef.current.get(key);

      if (!entry) {
        console.warn(
          `[Rozenite] Controls Plugin: Action target not found for ${sectionId}/${itemId}.`
        );
        return;
      }

      try {
        if (action === 'toggle') {
          if (entry.type !== 'toggle' || typeof value !== 'boolean') {
            console.warn(
              `[Rozenite] Controls Plugin: Invalid toggle action payload for ${sectionId}/${itemId}.`
            );
            return;
          }

          await entry.onToggle(value);
          return;
        }

        if (entry.type !== 'button') {
          console.warn(
            `[Rozenite] Controls Plugin: Invalid press action payload for ${sectionId}/${itemId}.`
          );
          return;
        }

        await entry.onPress();
      } catch (error) {
        console.warn(
          `[Rozenite] Controls Plugin: Action failed for ${sectionId}/${itemId}.`,
          error
        );
      }
    };

    const subscriptions = [
      client.onMessage('get-snapshot', () => {
        client.send('snapshot', {
          type: 'snapshot',
          sections: snapshot,
        });
      }),
      client.onMessage('invoke-action', (event: ControlsInvokeActionEvent) => {
        void handleInvokeAction(event);
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [client, snapshot]);

  return client;
};
