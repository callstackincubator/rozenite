import { useMemo, useState } from '@lynx-js/react';
import { createSection, useRozeniteControlsPlugin } from '@rozenite/controls-plugin';

import { Button, Group, Row } from '../src/ui.jsx';

/**
 * Minimal Controls playground: one section the DevTools panel can read and
 * write, plus the same state rendered in the app so a remote change is
 * visible on the device.
 */
export function ControlsPlayground() {
  const [counter, setCounter] = useState(0);
  const [label, setLabel] = useState('lynx');
  const [enabled, setEnabled] = useState(false);

  const sections = useMemo(
    () => [
      createSection({
        id: 'lynx-demo',
        title: 'Lynx Demo',
        items: [
          { id: 'counter', type: 'text' as const, title: 'Counter', value: String(counter) },
          {
            id: 'label',
            type: 'input' as const,
            title: 'Label',
            value: label,
            onUpdate: setLabel,
          },
          {
            id: 'enabled',
            type: 'toggle' as const,
            title: 'Enabled',
            value: enabled,
            onUpdate: setEnabled,
          },
          {
            id: 'increment',
            type: 'button' as const,
            title: 'Increment',
            onPress: () => setCounter((value) => value + 1),
          },
        ],
      }),
    ],
    [counter, label, enabled],
  );

  useRozeniteControlsPlugin({ sections });

  return (
    <Group title="Controls">
      <Row label="Counter" value={String(counter)} />
      <Row label="Label" value={label} />
      <Row label="Enabled" value={enabled ? 'on' : 'off'} />
      <Row
        label="Increment"
        last
        trailing={<Button label="+1" onTap={() => setCounter((value) => value + 1)} />}
      />
    </Group>
  );
}
