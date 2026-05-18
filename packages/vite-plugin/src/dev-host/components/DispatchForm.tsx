import type { FormEvent } from 'react';
import type { DevHostTemplateEntry } from '../types.js';
import { ClearIcon, SendIcon } from './icons.js';
import { ScrollArea } from './ui/ScrollArea.js';

type DispatchFormProps = {
  commandType: string;
  commandPayload: string;
  templates: DevHostTemplateEntry[];
  canDispatch: boolean;
  onCommandTypeChange: (value: string) => void;
  onCommandPayloadChange: (value: string) => void;
  onApplyTemplate: (template: DevHostTemplateEntry) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export const DispatchForm = ({
  commandType,
  commandPayload,
  templates,
  canDispatch,
  onCommandTypeChange,
  onCommandPayloadChange,
  onApplyTemplate,
  onReset,
  onSubmit,
}: DispatchFormProps) => {
  return (
    <div className="rz-pane">
      <div className="rz-sidebar">
        <div className="rz-sidebar-header">
          <div className="rz-sidebar-title">Dispatch Message</div>
        </div>

        <ScrollArea className="rz-sidebar-scroll">
          <form className="rz-command-form" onSubmit={onSubmit}>
            {templates.length > 0 ? (
              <div className="rz-field">
                <div className="rz-label">Templates</div>
                <div className="rz-template-list">
                  {templates.map((template, index) => (
                    <button
                      key={`${template.label}-${index}`}
                      type="button"
                      className="rz-template-button"
                      onClick={() => onApplyTemplate(template)}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

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
        </ScrollArea>
      </div>
    </div>
  );
};
