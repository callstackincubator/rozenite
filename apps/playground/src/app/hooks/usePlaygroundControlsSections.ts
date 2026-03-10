import { createSection } from '@rozenite/controls-plugin';
import { useMemo } from 'react';
import { useControlsPluginStore } from '../stores/controlsPluginStore';

export const usePlaygroundControlsSections = () => {
  const counter = useControlsPluginStore((state) => state.counter);
  const releaseLabel = useControlsPluginStore((state) => state.releaseLabel);
  const selectedEnvironment = useControlsPluginStore(
    (state) => state.selectedEnvironment
  );
  const status = useControlsPluginStore((state) => state.status);
  const lastActionAt = useControlsPluginStore((state) => state.lastActionAt);
  const notes = useControlsPluginStore((state) => state.notes);
  const featureFlags = useControlsPluginStore((state) => state.featureFlags);
  const updateReleaseLabel = useControlsPluginStore(
    (state) => state.updateReleaseLabel
  );
  const selectEnvironment = useControlsPluginStore(
    (state) => state.selectEnvironment
  );
  const toggleFlag = useControlsPluginStore((state) => state.toggleFlag);
  const incrementCounter = useControlsPluginStore((state) => state.incrementCounter);
  const markSynced = useControlsPluginStore((state) => state.markSynced);
  const addCheckpoint = useControlsPluginStore((state) => state.addCheckpoint);
  const resetDemo = useControlsPluginStore((state) => state.resetDemo);

  return useMemo(
    () => [
      createSection({
        id: 'controls-status',
        title: status === 'synced' ? 'Sync Status' : 'Runtime Status',
        description:
          'This section reorders items when reverseDiagnostics changes, which makes HMR and full snapshot replacement easy to verify.',
        items: featureFlags.reverseDiagnostics
          ? [
              {
                id: 'last-action',
                type: 'text' as const,
                title: 'Last Action',
                value: lastActionAt ?? 'No actions yet',
              },
              {
                id: 'counter',
                type: 'text' as const,
                title: 'Counter',
                value: String(counter),
              },
              {
                id: 'status',
                type: 'text' as const,
                title: 'Status',
                value: status,
              },
              {
                id: 'environment',
                type: 'text' as const,
                title: 'Environment',
                value: selectedEnvironment,
              },
              {
                id: 'release-label',
                type: 'text' as const,
                title: 'Release Label',
                value: releaseLabel,
              },
            ]
          : [
              {
                id: 'status',
                type: 'text' as const,
                title: 'Status',
                value: status,
              },
              {
                id: 'counter',
                type: 'text' as const,
                title: 'Counter',
                value: String(counter),
              },
              {
                id: 'environment',
                type: 'text' as const,
                title: 'Environment',
                value: selectedEnvironment,
              },
              {
                id: 'release-label',
                type: 'text' as const,
                title: 'Release Label',
                value: releaseLabel,
              },
              {
                id: 'last-action',
                type: 'text' as const,
                title: 'Last Action',
                value: lastActionAt ?? 'No actions yet',
              },
            ],
      }),
      createSection({
        id: 'feature-flags',
        title: 'Feature Flags',
        description: 'These toggles are handled on the device and mirrored into DevTools.',
        items: [
          {
            id: 'verbose-logging',
            type: 'toggle' as const,
            title: 'Verbose Logging',
            value: featureFlags.verboseLogging,
            description: 'Changes status to armed when enabled.',
            onUpdate: (nextValue: boolean) => toggleFlag('verboseLogging', nextValue),
          },
          {
            id: 'mock-latency',
            type: 'toggle' as const,
            title: 'Mock Latency',
            value: featureFlags.mockLatency,
            description: 'Pure state toggle for validating round-trips.',
            validate: (nextValue: boolean) =>
              status === 'synced' && nextValue
                ? {
                    valid: false,
                    message:
                      'Disable synced status before enabling mock latency.',
                  }
                : { valid: true },
            onUpdate: (nextValue: boolean) => toggleFlag('mockLatency', nextValue),
          },
          {
            id: 'reverse-diagnostics',
            type: 'toggle' as const,
            title: 'Reverse Diagnostics',
            value: featureFlags.reverseDiagnostics,
            description: 'Reorders the diagnostics section to prove full snapshot replacement.',
            onUpdate: (nextValue: boolean) => toggleFlag('reverseDiagnostics', nextValue),
          },
          {
            id: 'blocked-toggle',
            type: 'toggle' as const,
            title: 'Blocked Toggle',
            value: false,
            description:
              'This toggle is intentionally rejected to make validation errors easy to test.',
            validate: (nextValue: boolean) =>
              nextValue
                ? {
                    valid: false,
                    message: 'This demo toggle cannot be enabled.',
                  }
                : { valid: true },
            onUpdate: () => undefined,
          },
          {
            id: 'environment-selector',
            type: 'select' as const,
            title: 'Environment',
            value: selectedEnvironment,
            description: 'Choose the backend target directly from DevTools.',
            options: [
              { label: 'Local', value: 'local' },
              { label: 'Staging', value: 'staging' },
              { label: 'Production', value: 'production' },
            ],
            validate: (nextValue: string) =>
              counter > 0 && nextValue === 'production'
                ? {
                    valid: false,
                    message:
                      'Reset the counter before switching to production.',
                  }
                : { valid: true },
            onUpdate: (nextValue: string) =>
              selectEnvironment(
                nextValue as 'local' | 'staging' | 'production'
              ),
          },
          {
            id: 'release-label-input',
            type: 'input' as const,
            title: 'Release Label',
            value: releaseLabel,
            placeholder: 'build-001',
            applyLabel: 'Apply',
            description:
              'Apply is enabled only after editing. Labels must be at least 3 characters and contain no spaces.',
            validate: (nextValue: string) =>
              nextValue.trim().length < 3
                ? {
                    valid: false,
                    message: 'Release label must be at least 3 characters.',
                  }
                : nextValue.includes(' ')
                  ? {
                      valid: false,
                      message: 'Release label cannot contain spaces.',
                    }
                  : { valid: true },
            onUpdate: (nextValue: string) => updateReleaseLabel(nextValue),
          },
        ],
      }),
      createSection({
        id: 'actions',
        title: 'Actions',
        description: `Recent checkpoints tracked: ${notes.length}`,
        items: [
          {
            id: 'increment-counter',
            type: 'button' as const,
            title: 'Increment Counter',
            actionLabel: 'Increment',
            onPress: incrementCounter,
          },
          {
            id: 'mark-synced',
            type: 'button' as const,
            title: 'Mark Synced',
            actionLabel: 'Sync',
            onPress: markSynced,
          },
          {
            id: 'add-checkpoint',
            type: 'button' as const,
            title: 'Add Checkpoint',
            actionLabel: 'Add',
            onPress: addCheckpoint,
          },
          {
            id: 'reset-demo',
            type: 'button' as const,
            title: 'Reset Demo',
            actionLabel: 'Reset',
            onPress: resetDemo,
          },
        ],
      }),
    ],
    [
      addCheckpoint,
      counter,
      featureFlags.mockLatency,
      featureFlags.reverseDiagnostics,
      featureFlags.verboseLogging,
      incrementCounter,
      lastActionAt,
      markSynced,
      notes.length,
      releaseLabel,
      resetDemo,
      selectEnvironment,
      selectedEnvironment,
      status,
      toggleFlag,
      updateReleaseLabel,
    ]
  );
};
