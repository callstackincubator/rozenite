import { useMemo } from 'react';
import { Text } from 'react-native';
import {
  Button,
  Card,
  Field,
  Input,
  KeyValueList,
  PluginHeader,
  Row,
  Screen,
  Switch,
} from '../components/ui';
import { useControlsPluginStore } from '../stores/controlsPluginStore';
import { useTheme } from '../theme/useTheme';

export const ControlsPluginScreen = () => {
  const { theme } = useTheme();
  const counter = useControlsPluginStore((state) => state.counter);
  const releaseLabel = useControlsPluginStore((state) => state.releaseLabel);
  const selectedEnvironment = useControlsPluginStore((state) => state.selectedEnvironment);
  const status = useControlsPluginStore((state) => state.status);
  const lastActionAt = useControlsPluginStore((state) => state.lastActionAt);
  const notes = useControlsPluginStore((state) => state.notes);
  const featureFlags = useControlsPluginStore((state) => state.featureFlags);
  const updateReleaseLabel = useControlsPluginStore((state) => state.updateReleaseLabel);
  const selectEnvironment = useControlsPluginStore((state) => state.selectEnvironment);
  const toggleFlag = useControlsPluginStore((state) => state.toggleFlag);
  const incrementCounter = useControlsPluginStore((state) => state.incrementCounter);
  const markSynced = useControlsPluginStore((state) => state.markSynced);
  const addCheckpoint = useControlsPluginStore((state) => state.addCheckpoint);
  const resetDemo = useControlsPluginStore((state) => state.resetDemo);

  const diagnostics = useMemo(
    () => [
      ['Status', status],
      ['Counter', String(counter)],
      ['Environment', selectedEnvironment],
      ['Release label', releaseLabel],
      ['Last action', lastActionAt ?? 'No actions yet'],
    ],
    [counter, lastActionAt, releaseLabel, selectedEnvironment, status],
  );

  return (
    <Screen>
      <PluginHeader
        title="Controls"
        subtitle="Change state here or from DevTools — the panel mirrors the device."
      />

      <KeyValueList items={diagnostics.map(([label, value]) => ({ label, value }))} />

      <Card>
        {(Object.entries(featureFlags) as [keyof typeof featureFlags, boolean][]).map(
          ([flag, enabled]) => (
            <Row key={flag}>
              <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSize.sm }}>
                {flag}
              </Text>
              <Switch
                value={enabled}
                accessibilityLabel={flag}
                onValueChange={(nextValue) => toggleFlag(flag, nextValue)}
              />
            </Row>
          ),
        )}
      </Card>

      <Card>
        <Field label="Environment">
          <Row wrap>
            {(['local', 'staging', 'production'] as const).map((environment) => (
              <Button
                key={environment}
                label={environment}
                accessibilityLabel={`Select ${environment} environment`}
                size="compact"
                variant={selectedEnvironment === environment ? 'default' : 'secondary'}
                onPress={() => selectEnvironment(environment)}
              />
            ))}
          </Row>
        </Field>
        <Field label="Release label">
          <Input
            accessibilityLabel="Release label"
            value={releaseLabel}
            onChangeText={updateReleaseLabel}
            placeholder="build-001"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Field>
      </Card>

      <Card>
        <Row wrap>
          <Button label="Increment counter" onPress={incrementCounter} />
          <Button label="Mark synced" variant="secondary" onPress={markSynced} />
          <Button label="Add checkpoint" variant="secondary" onPress={addCheckpoint} />
          <Button label="Reset demo" variant="destructive" onPress={resetDemo} />
        </Row>
      </Card>

      <Card>
        <Field label="Recent checkpoints">
          {notes.length === 0 ? (
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSize.xs }}>
              No checkpoints yet.
            </Text>
          ) : (
            notes.map((note) => (
              <Text
                key={note}
                style={{ color: theme.colors.foreground, fontSize: theme.fontSize.xs }}
              >
                {note}
              </Text>
            ))
          )}
        </Field>
      </Card>
    </Screen>
  );
};
