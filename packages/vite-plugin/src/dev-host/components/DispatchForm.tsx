import { useState, type FormEvent } from 'react';
import type { DevHostFlowEntry, DevHostFlowRunState, DevHostPresetEntry } from '../types.js';
import { ClearIcon, PresetsIcon, SendIcon } from './icons.js';
import { FlowList } from './FlowList.js';
import { DropdownMenu, type DropdownMenuItem } from './ui/DropdownMenu.js';
import { IconButton } from './ui/IconButton.js';
import { Input } from './ui/Input.js';
import { ScrollArea } from './ui/ScrollArea.js';
import { Textarea } from './ui/Textarea.js';
import { ToggleGroup } from './ui/ToggleGroup.js';

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
  const presetItems: DropdownMenuItem<DevHostPresetEntry>[] = presets.map((preset) => ({
    id: preset.displayName,
    label: preset.displayName,
    item: preset,
  }));
  const presetButton = (
    <IconButton
      type="button"
      variant="default"
      aria-label={presets.length > 0 ? 'Open presets' : 'No presets available'}
      title={presets.length > 0 ? 'Presets' : 'No presets available'}
      disabled={presets.length === 0}
      overrides={{
        BaseButton: {
          style: {
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            color: 'rgba(255, 255, 255, 0.88)',
          },
        },
      }}
    >
      <PresetsIcon />
    </IconButton>
  );

  return (
    <div className="rz-pane">
      <div className="rz-sidebar">
        <div className="rz-sidebar-header">
          <div className="rz-sidebar-title">Actions</div>
        </div>

        <ScrollArea className="rz-sidebar-scroll">
          <div className="rz-action-tabs rz-command-form">
            <div className="rz-action-tabs-header">
              <ToggleGroup
                aria-label="Action modes"
                value={activeTab}
                onChange={(value) => setActiveTab(value as 'dispatch' | 'flows')}
                options={[
                  { key: 'dispatch', label: 'Dispatch' },
                  { key: 'flows', label: 'Flows' },
                ]}
              />

              {activeTab === 'dispatch'
                ? presets.length > 0
                  ? <DropdownMenu items={presetItems} onSelect={onApplyPreset}>{presetButton}</DropdownMenu>
                  : presetButton
                : null}
            </div>

            {activeTab === 'dispatch' ? (
              <div className="rz-action-tab-panel">
                <form className="rz-action-form" onSubmit={onSubmit}>
                  <div className="rz-field">
                    <label className="rz-label" htmlFor="command-type">
                      Command
                    </label>
                    <Input
                      id="command-type"
                      value={commandType}
                      onChange={(event) => onCommandTypeChange(event.currentTarget.value)}
                      placeholder="get-snapshot"
                      spellCheck={false}
                    />
                  </div>

                  <div className="rz-field">
                    <label className="rz-label" htmlFor="command-payload">
                      Payload
                    </label>
                    <Textarea
                      id="command-payload"
                      value={commandPayload}
                      onChange={(event) => onCommandPayloadChange(event.currentTarget.value)}
                      placeholder='{"example": true}'
                      spellCheck={false}
                    />
                  </div>

                  <div className="rz-button-row">
                    <IconButton
                      type="button"
                      variant="default"
                      aria-label="Reset dispatcher"
                      title="Reset dispatcher"
                      onClick={onReset}
                    >
                      <ClearIcon />
                    </IconButton>

                    <IconButton
                      type="submit"
                      variant="primary"
                      aria-label="Dispatch message"
                      title="Dispatch message"
                      disabled={!canDispatch}
                    >
                      <SendIcon />
                    </IconButton>
                  </div>
                </form>
              </div>
            ) : null}

            {activeTab === 'flows' ? (
              <div className="rz-action-tab-panel">
                <FlowList
                  flows={flows}
                  flowRuns={flowRuns}
                  hasRunningFlow={hasRunningFlow}
                  onRunFlow={onRunFlow}
                  onStopFlow={onStopFlow}
                />
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
