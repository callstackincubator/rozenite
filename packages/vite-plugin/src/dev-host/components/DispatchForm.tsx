import { useState, type FormEvent } from 'react';
import { StatefulMenu } from 'baseui/menu/index.js';
import { StatefulPopover, TRIGGER_TYPE } from 'baseui/popover/index.js';
import type { DevHostFlowEntry, DevHostFlowRunState, DevHostTemplateEntry } from '../types.js';
import { ClearIcon, PresetsIcon, SendIcon } from './icons.js';
import { FlowList } from './FlowList.js';
import { ScrollArea } from './ui/ScrollArea.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs.js';

type PresetMenuItem = {
  label: string;
  template: DevHostTemplateEntry;
};

type DispatchFormProps = {
  commandType: string;
  commandPayload: string;
  flows: DevHostFlowEntry[];
  flowRuns: DevHostFlowRunState[];
  hasRunningFlow: (flowName: string) => boolean;
  templates: DevHostTemplateEntry[];
  canDispatch: boolean;
  onRunFlow: (flow: DevHostFlowEntry) => void;
  onStopFlow: (runId: string) => void;
  onCommandTypeChange: (value: string) => void;
  onCommandPayloadChange: (value: string) => void;
  onApplyTemplate: (template: DevHostTemplateEntry) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export const DispatchForm = ({
  commandType,
  commandPayload,
  flows,
  flowRuns,
  hasRunningFlow,
  templates,
  canDispatch,
  onRunFlow,
  onStopFlow,
  onCommandTypeChange,
  onCommandPayloadChange,
  onApplyTemplate,
  onReset,
  onSubmit,
}: DispatchFormProps) => {
  const [activeTab, setActiveTab] = useState<'dispatch' | 'flows'>('dispatch');
  const presetItems: PresetMenuItem[] = templates.map((template) => ({
    label: template.displayName,
    template,
  }));

  return (
    <div className="rz-pane">
      <div className="rz-sidebar">
        <div className="rz-sidebar-header">
          <div className="rz-sidebar-title">Actions</div>
        </div>

        <ScrollArea className="rz-sidebar-scroll">
          <Tabs className="rz-action-tabs" value={activeTab} onValueChange={(value) => setActiveTab(value as 'dispatch' | 'flows')}>
            <div className="rz-command-form">
              <div className="rz-action-tabs-header">
                <TabsList aria-label="Action modes">
                  <TabsTrigger value="dispatch">Dispatch</TabsTrigger>
                  <TabsTrigger value="flows" disabled={flows.length === 0}>
                    Flows
                  </TabsTrigger>
                </TabsList>

                {templates.length > 0 && activeTab === 'dispatch' ? (
                  <StatefulPopover
                    triggerType={TRIGGER_TYPE.click}
                    placement="bottomRight"
                    accessibilityType="menu"
                    dismissOnClickOutside
                    dismissOnEsc
                    focusLock={false}
                    autoFocus={false}
                    showArrow={false}
                    content={({ close }: { close: () => void }) => (
                      <div className="rz-baseui-preset-menu">
                        <StatefulMenu
                          items={presetItems}
                          onItemSelect={({ item }: { item: PresetMenuItem }) => {
                            onApplyTemplate(item.template);
                            close();
                          }}
                          overrides={{
                            List: {
                              style: {
                                backgroundColor: '#111111',
                                color: '#ffffff',
                                borderRadius: '8px',
                                minWidth: '220px',
                                maxWidth: 'min(320px, calc(100vw - 24px))',
                                paddingTop: '6px',
                                paddingBottom: '6px',
                                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
                              },
                            },
                            Option: {
                              props: {
                                getItemLabel: (item: PresetMenuItem) => item.label,
                              },
                              style: ({ $isHighlighted }: { $isHighlighted?: boolean }) => ({
                                backgroundColor: $isHighlighted ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                color: '#ffffff',
                                fontSize: '13px',
                                lineHeight: '1.4',
                                paddingTop: '8px',
                                paddingRight: '10px',
                                paddingBottom: '8px',
                                paddingLeft: '10px',
                              }),
                            },
                          }}
                        />
                      </div>
                    )}
                    overrides={{
                      Body: {
                        style: {
                          zIndex: 20,
                        },
                      },
                      Inner: {
                        style: {
                          backgroundColor: 'transparent',
                        },
                      },
                    }}
                  >
                    <button
                      type="button"
                      className="rz-preset-icon-button"
                      aria-label="Open presets"
                      title="Presets"
                    >
                      <PresetsIcon />
                    </button>
                  </StatefulPopover>
                ) : null}
              </div>

              <TabsContent value="dispatch" className="rz-action-tab-panel">
                <form className="rz-action-form" onSubmit={onSubmit}>
                  <div className="rz-field">
                    <label className="rz-label" htmlFor="command-type">
                      Command
                    </label>
                    <input
                      id="command-type"
                      className="rz-input"
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
                    <textarea
                      id="command-payload"
                      className="rz-textarea"
                      value={commandPayload}
                      onChange={(event) => onCommandPayloadChange(event.currentTarget.value)}
                      placeholder='{"example": true}'
                      spellCheck={false}
                    />
                  </div>

                  <div className="rz-button-row">
                    <button
                      type="button"
                      className="rz-sidebar-close"
                      aria-label="Reset dispatcher"
                      title="Reset dispatcher"
                      onClick={onReset}
                    >
                      <ClearIcon />
                    </button>

                    <button
                      type="submit"
                      className="rz-sidebar-close rz-sidebar-action-primary"
                      aria-label="Dispatch message"
                      title="Dispatch message"
                      disabled={!canDispatch}
                    >
                      <SendIcon />
                    </button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="flows" className="rz-action-tab-panel">
                <FlowList
                  flows={flows}
                  flowRuns={flowRuns}
                  hasRunningFlow={hasRunningFlow}
                  onRunFlow={onRunFlow}
                  onStopFlow={onStopFlow}
                />
              </TabsContent>
            </div>
          </Tabs>
        </ScrollArea>
      </div>
    </div>
  );
};
