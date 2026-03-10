import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useControlsPluginStore } from '../stores/controlsPluginStore';

export const ControlsPluginScreen = () => {
  const insets = useSafeAreaInsets();
  const counter = useControlsPluginStore((state) => state.counter);
  const selectedEnvironment = useControlsPluginStore(
    (state) => state.selectedEnvironment
  );
  const status = useControlsPluginStore((state) => state.status);
  const lastActionAt = useControlsPluginStore((state) => state.lastActionAt);
  const notes = useControlsPluginStore((state) => state.notes);
  const featureFlags = useControlsPluginStore((state) => state.featureFlags);
  const selectEnvironment = useControlsPluginStore(
    (state) => state.selectEnvironment
  );
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
      ['Last action', lastActionAt ?? 'No actions yet'],
    ],
    [counter, lastActionAt, selectedEnvironment, status]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        },
      ]}
    >
      <Text style={styles.title}>Controls Plugin Demo</Text>
      <Text style={styles.subtitle}>
        Change state locally and from DevTools. The Controls panel should always mirror
        this screen because the device owns the source of truth.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Diagnostics</Text>
        {diagnostics.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Feature Flags</Text>
        {(
          Object.entries(featureFlags) as Array<
            [keyof typeof featureFlags, boolean]
          >
        ).map(([flag, enabled]) => (
          <View key={flag} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>{flag}</Text>
              <Text style={styles.helperText}>
                Toggle locally or from DevTools to validate two-way updates.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={(nextValue) => toggleFlag(flag, nextValue)}
              trackColor={{ false: '#374151', true: '#8232FF' }}
              thumbColor="#ffffff"
            />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Environment</Text>
        <Text style={styles.helperText}>
          Change it here or from the DevTools select control.
        </Text>
        <View style={styles.buttonRow}>
          {(['local', 'staging', 'production'] as const).map((environment) => (
            <DemoButton
              key={environment}
              label={environment}
              onPress={() => selectEnvironment(environment)}
              variant={
                selectedEnvironment === environment ? 'primary' : 'secondary'
              }
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Actions</Text>
        <View style={styles.buttonRow}>
          <DemoButton label="Increment Counter" onPress={incrementCounter} />
          <DemoButton label="Mark Synced" onPress={markSynced} />
        </View>
        <View style={styles.buttonRow}>
          <DemoButton label="Add Checkpoint" onPress={addCheckpoint} />
          <DemoButton label="Reset Demo" onPress={resetDemo} variant="secondary" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Checkpoints</Text>
        {notes.length === 0 ? (
          <Text style={styles.helperText}>No checkpoints yet.</Text>
        ) : (
          notes.map((note) => (
            <Text key={note} style={styles.note}>
              {note}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const DemoButton = ({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) => (
  <Pressable
    style={[styles.button, variant === 'secondary' && styles.secondaryButton]}
    onPress={onPress}
  >
    <Text
      style={[styles.buttonLabel, variant === 'secondary' && styles.secondaryButtonLabel]}
    >
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  value: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#8232FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonLabel: {
    color: '#d1d5db',
  },
  note: {
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 18,
  },
});
