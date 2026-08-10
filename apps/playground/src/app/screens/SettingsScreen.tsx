import { useState } from 'react';
import {
  Button,
  Card,
  Field,
  Input,
  KeyValueRow,
  PluginHeader,
  Row,
  Screen,
} from '../components/ui';
import { useSettingsStore } from '../stores/settingsStore';

export const SettingsScreen = () => {
  const throttleMs = useSettingsStore((state) => state.settings.tanstackQuery.throttleMs);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const [draft, setDraft] = useState(String(throttleMs));

  return (
    <Screen>
      <PluginHeader title="Settings" subtitle="Playground-local settings that plugins can read." />

      <Card>
        <KeyValueRow label="TanStack Query throttle" value={`${throttleMs}ms`} />
        <Field
          label="Throttle (ms)"
          helperText="Stored locally; read by future TanStack Query DevTools throttling."
        >
          <Row>
            <Input
              accessibilityLabel="TanStack Query throttle in milliseconds"
              value={draft}
              onChangeText={setDraft}
              keyboardType="numeric"
              style={{ flex: 1 }}
            />
            <Button
              label="Apply"
              onPress={() => updateSettings('tanstackQuery', { throttleMs: Number(draft) || 0 })}
            />
          </Row>
        </Field>
      </Card>
    </Screen>
  );
};
