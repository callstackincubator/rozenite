import { Button, Input, Select, Tabs, Textarea } from '@rozenite/ui';
import { RotateCcw, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type {
  DevHostFlowEntry,
  DevHostFlowRunState,
  DevHostPresetEntry,
} from '../types.js';
import { FlowList } from './FlowList.js';

type DispatchFormProps = {
  commandType: string;
  commandPayload: string;
  flows: DevHostFlowEntry[];
  flowRuns: DevHostFlowRunState[];
  hasRunningFlow: (flowName: string) => boolean;
  presets: DevHostPresetEntry[];
  canDispatch: boolean;
  onRunFlow: (flow: DevHostFlowEntry) => void;
  onStopFlow: (runId: string) => void;
  onCommandTypeChange: (value: string) => void;
  onCommandPayloadChange: (value: string) => void;
  onApplyPreset: (preset: DevHostPresetEntry) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export const DispatchForm = ({
  commandType,
  commandPayload,
  flows,
  flowRuns,
  hasRunningFlow,
  presets,
  canDispatch,
  onRunFlow,
  onStopFlow,
  onCommandTypeChange,
  onCommandPayloadChange,
  onApplyPreset,
  onReset,
  onSubmit,
}: DispatchFormProps) => {
  const [activeTab, setActiveTab] = useState<'dispatch' | 'flows'>('dispatch');

  return (
    <section className="dev-host-pane">
      <header className="dev-host-pane-header">
        <h2 className="dev-host-pane-title">Actions</h2>
      </header>

      <Tabs
        className="flex min-h-0 flex-1 flex-col"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'dispatch' | 'flows')}
      >
        <div className="dev-host-tabs-header">
          <Tabs.List aria-label="Action modes">
            <Tabs.Tab value="dispatch">Dispatch</Tabs.Tab>
            <Tabs.Tab value="flows">Flows</Tabs.Tab>
          </Tabs.List>

          {activeTab === 'dispatch' ? (
            <Select
              value={null}
              onValueChange={(value) => {
                const preset = presets.find((item) => item.name === value);
                if (preset) {
                  onApplyPreset(preset);
                }
              }}
            >
              <Select.Trigger
                className="w-auto"
                aria-label={
                  presets.length > 0 ? 'Open presets' : 'No presets available'
                }
                disabled={presets.length === 0}
                title={presets.length > 0 ? 'Presets' : 'No presets available'}
              >
                <Select.Value>Presets</Select.Value>
              </Select.Trigger>
              <Select.Content align="end">
                {presets.map((preset) => (
                  <Select.Item key={preset.name} value={preset.name}>
                    {preset.displayName}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          ) : null}
        </div>

        <Tabs.Panel value="dispatch" className="dev-host-tab-panel">
          <form className="dev-host-form" onSubmit={onSubmit}>
            <label className="dev-host-field">
              <span className="dev-host-label">Command</span>
              <Input
                value={commandType}
                onChange={(event) =>
                  onCommandTypeChange(event.currentTarget.value)
                }
                placeholder="get-snapshot"
                spellCheck={false}
              />
            </label>

            <label className="dev-host-field">
              <span className="dev-host-label">Payload</span>
              <Textarea
                value={commandPayload}
                onChange={(event) =>
                  onCommandPayloadChange(event.currentTarget.value)
                }
                placeholder='{"example": true}'
                spellCheck={false}
              />
            </label>

            <div className="dev-host-actions">
              <Button
                variant="outline"
                size="icon"
                onClick={onReset}
                aria-label="Reset dispatcher"
                title="Reset dispatcher"
              >
                <RotateCcw />
              </Button>
              <Button
                type="submit"
                size="icon"
                disabled={!canDispatch}
                aria-label="Dispatch message"
                title="Dispatch message"
              >
                <Send />
              </Button>
            </div>
          </form>
        </Tabs.Panel>

        <Tabs.Panel value="flows" className="dev-host-tab-panel">
          <FlowList
            flows={flows}
            flowRuns={flowRuns}
            hasRunningFlow={hasRunningFlow}
            onRunFlow={onRunFlow}
            onStopFlow={onStopFlow}
          />
        </Tabs.Panel>
      </Tabs>
    </section>
  );
};
